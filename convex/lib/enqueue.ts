import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { RequestStatus } from "./constants";
import { stableStringify } from "./hmac";
import { notificationSummary, buildNotificationPayload } from "./notifications";
import type { RecipientRole } from "./notifications";

export async function enqueueNotification(
  ctx: MutationCtx,
  args: {
    requestId: Id<"requests">;
    status: RequestStatus;
    updatedAt: number;
    toolName: string;
    startDate: string;
    endDate: string;
    recipient: { role: RecipientRole; name: string; email: string };
    counterpartyName: string;
    summary?: string;
  },
) {
  const payload = buildNotificationPayload({
    requestId: args.requestId,
    status: args.status,
    updatedAt: args.updatedAt,
    toolName: args.toolName,
    startDate: args.startDate,
    endDate: args.endDate,
    recipient: args.recipient,
    counterpartyName: args.counterpartyName,
  });
  const existing = await ctx.db
    .query("outbox")
    .withIndex("by_key", (q) => q.eq("idempotencyKey", payload.idempotencyKey))
    .unique();
  if (existing) return;

  const summary =
    args.summary ??
    notificationSummary(args.status, args.recipient.role);
  const outboxId = await ctx.db.insert("outbox", {
    idempotencyKey: payload.idempotencyKey,
    loanId: args.requestId,
    kind: args.status === "pending" ? "request_notified" : "status_notified",
    status: "pending",
    summary,
    payload: stableStringify(payload),
    attempts: 0,
    createdAt: args.updatedAt,
    updatedAt: args.updatedAt,
  });
  await ctx.scheduler.runAfter(0, internal.automation.dispatch, { outboxId });
}
