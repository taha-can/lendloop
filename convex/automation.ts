import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { isOverdue, reminderDateAllowed, utcToday } from "./lib/dates";
import { signRequest, usableSecret } from "./lib/hmac";
import {
  canReclaim,
  decideOutboxClaim,
  decideOutboxComplete,
  decideOutboxFail,
  decideReminder,
  isFailureKey,
  isNotifyKey,
  overdueKey,
} from "./lib/idempotency";
import { publicErrorMessage } from "./lib/text";
import { reminderPhaseValidator } from "./lib/validators";

const LOAN_CAP = 100;

async function recordEvent(
  ctx: MutationCtx,
  event: {
    loanId?: Id<"requests">;
    kind: Doc<"automationEvents">["kind"];
    summary: string;
    idempotencyKey: string;
    createdAt: number;
  },
) {
  const existing = await ctx.db
    .query("automationEvents")
    .withIndex("by_key", (q) => q.eq("idempotencyKey", event.idempotencyKey))
    .unique();
  if (existing) return;
  await ctx.db.insert("automationEvents", event);
}

function failureSummary(message: string): string {
  const cleaned = publicErrorMessage(message);
  if (!cleaned || cleaned.includes("@")) {
    return "Notification could not be sent";
  }
  return cleaned;
}

export const getOutbox = internalQuery({
  args: { outboxId: v.id("outbox") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.outboxId);
  },
});

export const listOverdue = internalQuery({
  args: {},
  handler: async (ctx) => {
    const today = utcToday();
    const approved = await ctx.db
      .query("requests")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const overdue = approved.filter((loan) => isOverdue(today, loan));
    const reminders = await ctx.db.query("reminders").collect();
    const alreadySent = new Set(
      reminders
        .filter(
          (reminder) =>
            reminder.status === "sent" && reminder.reminderDate === today,
        )
        .map((reminder) => reminder.loanId),
    );
    const loans = [];
    for (const loan of overdue) {
      if (alreadySent.has(loan._id) || loans.length >= LOAN_CAP) continue;
      const [tool, borrower] = await Promise.all([
        ctx.db.get(loan.toolId),
        ctx.db.get(loan.borrowerId),
      ]);
      if (!tool || !borrower?.email) continue;
      loans.push({
        loanId: loan._id,
        idempotencyKey: overdueKey(loan._id, today),
        toolName: tool.name,
        dueDate: loan.endDate,
        borrowerName: borrower.name,
        borrowerEmail: borrower.email,
      });
    }
    return { asOf: today, loans };
  },
});

export const noteAttempt = internalMutation({
  args: { outboxId: v.id("outbox") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.outboxId);
    if (!row || row.status === "delivered") return;
    await ctx.db.patch(row._id, {
      attempts: row.attempts + 1,
      updatedAt: Date.now(),
    });
  },
});

export const markOutboxFailed = internalMutation({
  args: { outboxId: v.id("outbox"), message: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.outboxId);
    if (!row || row.status === "delivered") return;
    const decision = decideOutboxFail(row.status);
    const now = Date.now();
    if (decision === "fail") {
      await ctx.db.patch(row._id, {
        status: "failed",
        lastError: publicErrorMessage(args.message),
        updatedAt: now,
      });
    }
    await recordEvent(ctx, {
      loanId: row.loanId,
      kind: "delivery_failed",
      summary: failureSummary(args.message),
      idempotencyKey: `event:${row.idempotencyKey}:failed`,
      createdAt: now,
    });
  },
});

export const claimOutbox = internalMutation({
  args: { idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    if (!isNotifyKey(args.idempotencyKey)) {
      throw new ConvexError("Unknown notification.");
    }
    const row = await ctx.db
      .query("outbox")
      .withIndex("by_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .unique();
    const now = Date.now();
    const decision = decideOutboxClaim(row, now);
    if (!row || !decision.claim) {
      return { send: false, status: row?.status ?? "missing" };
    }
    await ctx.db.patch(row._id, { status: "processing", updatedAt: now });
    return { send: true, status: "processing" as const };
  },
});

export const completeOutbox = internalMutation({
  args: { idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    if (!isNotifyKey(args.idempotencyKey)) {
      throw new ConvexError("Unknown notification.");
    }
    const row = await ctx.db
      .query("outbox")
      .withIndex("by_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .unique();
    if (!row) throw new ConvexError("Notification not found.");
    const now = Date.now();
    if (decideOutboxComplete(row.status) === "deliver") {
      await ctx.db.patch(row._id, {
        status: "delivered",
        updatedAt: now,
        lastError: undefined,
      });
    }
    await recordEvent(ctx, {
      loanId: row.loanId,
      kind: row.kind,
      summary: row.summary,
      idempotencyKey: `event:${row.idempotencyKey}:delivered`,
      createdAt: now,
    });
    return { ok: true };
  },
});

export const writeReminder = internalMutation({
  args: {
    phase: reminderPhaseValidator,
    idempotencyKey: v.string(),
    loanId: v.string(),
    reminderDate: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const loanId = ctx.db.normalizeId("requests", args.loanId);
    if (!loanId) throw new ConvexError("Loan not found.");
    const loan = await ctx.db.get(loanId);
    if (!loan) throw new ConvexError("Loan not found.");
    const today = utcToday();
    if (!reminderDateAllowed(args.reminderDate, today)) {
      throw new ConvexError("That reminder date is outside the allowed window.");
    }
    if (args.idempotencyKey !== overdueKey(loanId, args.reminderDate)) {
      throw new ConvexError("The idempotency key does not match this loan.");
    }
    if (args.phase === "claim" && !isOverdue(today, loan)) {
      return { send: false, status: "not_due" as const };
    }

    const existing = await ctx.db
      .query("reminders")
      .withIndex("by_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .unique();
    const now = Date.now();
    const decision = decideReminder(
      existing
        ? { status: existing.status, updatedAt: existing.updatedAt }
        : null,
      args.phase,
      now,
    );
    if (!existing && decision.action === "insert") {
      await ctx.db.insert("reminders", {
        loanId,
        reminderDate: args.reminderDate,
        idempotencyKey: args.idempotencyKey,
        status: decision.status,
        createdAt: now,
        updatedAt: now,
      });
    } else if (existing && decision.action === "update") {
      await ctx.db.patch(existing._id, {
        status: decision.status,
        updatedAt: now,
      });
    }

    if (args.phase === "complete" && decision.status === "sent") {
      await recordEvent(ctx, {
        loanId,
        kind: "reminder_sent",
        summary: "Reminder sent",
        idempotencyKey: `event:${args.idempotencyKey}:sent`,
        createdAt: now,
      });
    }
    if (args.phase === "fail" && decision.status === "failed") {
      await recordEvent(ctx, {
        loanId,
        kind: "reminder_failed",
        summary: failureSummary(args.message ?? "Reminder could not be sent"),
        idempotencyKey: `event:${args.idempotencyKey}:failed`,
        createdAt: now,
      });
    }
    return { send: decision.send, status: decision.status };
  },
});

export const recordFailure = internalMutation({
  args: {
    idempotencyKey: v.string(),
    message: v.string(),
    loanId: v.optional(v.string()),
    outboxKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isFailureKey(args.idempotencyKey)) {
      throw new ConvexError("Unknown failure report.");
    }
    if (args.outboxKey && !isNotifyKey(args.outboxKey)) {
      throw new ConvexError("Unknown notification.");
    }
    const now = Date.now();
    let loanId: Id<"requests"> | undefined;
    if (args.loanId) {
      loanId = ctx.db.normalizeId("requests", args.loanId) ?? undefined;
    }
    if (args.outboxKey) {
      const row = await ctx.db
        .query("outbox")
        .withIndex("by_key", (q) => q.eq("idempotencyKey", args.outboxKey!))
        .unique();
      if (row && decideOutboxFail(row.status) === "fail") {
        await ctx.db.patch(row._id, {
          status: "failed",
          lastError: publicErrorMessage(args.message),
          updatedAt: now,
        });
        loanId = row.loanId;
      }
    }
    await recordEvent(ctx, {
      loanId,
      kind: "delivery_failed",
      summary: failureSummary(args.message),
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
    });
    return { ok: true };
  },
});

export const dispatch = internalAction({
  args: { outboxId: v.id("outbox") },
  handler: async (ctx, args) => {
    const row = await ctx.runQuery(internal.automation.getOutbox, {
      outboxId: args.outboxId,
    });
    if (!row || row.status === "delivered") return;

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const secret = usableSecret(process.env.LENDLOOP_OUTBOUND_WEBHOOK_SECRET);
    if (!webhookUrl || !secret) {
      await ctx.runMutation(internal.automation.markOutboxFailed, {
        outboxId: args.outboxId,
        message: "Notification webhook is not configured.",
      });
      return;
    }

    let target: URL;
    try {
      target = new URL(webhookUrl);
    } catch {
      await ctx.runMutation(internal.automation.markOutboxFailed, {
        outboxId: args.outboxId,
        message: "Notification webhook URL is invalid.",
      });
      return;
    }

    const timestamp = Date.now().toString();
    const signature = await signRequest({
      secret,
      timestamp,
      method: "POST",
      path: target.pathname,
      body: row.payload,
    });
    await ctx.runMutation(internal.automation.noteAttempt, {
      outboxId: args.outboxId,
    });

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lendloop-timestamp": timestamp,
        "x-lendloop-signature": signature,
      },
      body: row.payload,
    });
    if (!response.ok) {
      throw new Error(`n8n webhook returned ${response.status}`);
    }
  },
});

export const retryPending = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const groups = await Promise.all(
      (["pending", "processing", "failed"] as const).map((status) =>
        ctx.db
          .query("outbox")
          .withIndex("by_status", (q) => q.eq("status", status))
          .take(40),
      ),
    );
    for (const row of groups.flat()) {
      if (!canReclaim(row.status, row.updatedAt, now)) continue;
      await ctx.scheduler.runAfter(0, internal.automation.dispatch, {
        outboxId: row._id,
      });
    }
  },
});
