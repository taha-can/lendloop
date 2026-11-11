import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { DAILY_REQUEST_LIMIT, type RequestStatus } from "./lib/constants";
import {
  dateRangeIssue,
  dateRangeMessage,
  rangesOverlap,
  utcToday,
} from "./lib/dates";
import { enqueueNotification } from "./lib/enqueue";
import { latestByLoan } from "./lib/events";
import { asActor, requireUser } from "./lib/guards";
import type { RecipientRole } from "./lib/notifications";
import { notificationAudience } from "./lib/notifications";
import {
  canBorrowTool,
  canCancelRequest,
  canDecideRequest,
  canMarkReturned,
  withinDailyLimit,
} from "./lib/rbac";

function permissionsFor(
  actor: ReturnType<typeof asActor>,
  request: { lenderId: string; borrowerId: string; status: RequestStatus },
) {
  return {
    decide:
      request.status === "pending" && canDecideRequest(actor, request.lenderId),
    cancel:
      request.status === "pending" &&
      canCancelRequest(actor, request.borrowerId),
    markReturned:
      request.status === "approved" && canMarkReturned(actor, request),
  };
}

async function presentRequests(
  ctx: QueryCtx,
  actor: ReturnType<typeof asActor>,
  requests: Doc<"requests">[],
) {
  const toolIds = [...new Set(requests.map((request) => request.toolId))];
  const userIds = [
    ...new Set(
      requests.flatMap((request) => [request.borrowerId, request.lenderId]),
    ),
  ];
  const [tools, users, activity] = await Promise.all([
    Promise.all(toolIds.map((id) => ctx.db.get(id))),
    Promise.all(userIds.map((id) => ctx.db.get(id))),
    latestByLoan(
      ctx,
      requests.map((request) => request._id),
    ),
  ]);
  const toolName = new Map(
    tools.filter((tool) => tool !== null).map((tool) => [tool._id, tool.name]),
  );
  const userName = new Map(
    users.filter((user) => user !== null).map((user) => [user._id, user.name]),
  );

  return requests
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((request) => ({
      id: request._id,
      toolId: request.toolId,
      toolName: toolName.get(request.toolId) ?? "Removed tool",
      startDate: request.startDate,
      endDate: request.endDate,
      status: request.status,
      borrowerName: userName.get(request.borrowerId) ?? "Neighbor",
      lenderName: userName.get(request.lenderId) ?? "Neighbor",
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      activity: activity.get(request._id) ?? null,
      permissions: permissionsFor(actor, request),
    }));
}

async function notify(
  ctx: MutationCtx,
  request: Doc<"requests">,
  toolName: string,
  status: RequestStatus,
  updatedAt: number,
  actorIsBorrower: boolean,
  recipientRole?: RecipientRole,
) {
  const role =
    recipientRole ??
    notificationAudience({ status, actorIsBorrower });
  if (!role) return;
  const borrower = await ctx.db.get(request.borrowerId);
  const lender = await ctx.db.get(request.lenderId);
  if (!borrower || !lender) return;
  const recipient = role === "lender" ? lender : borrower;
  const counterparty = role === "lender" ? borrower : lender;
  await enqueueNotification(ctx, {
    requestId: request._id,
    status,
    updatedAt,
    toolName,
    startDate: request.startDate,
    endDate: request.endDate,
    recipient: { role, name: recipient.name, email: recipient.email },
    counterpartyName: counterparty.name,
  });
}

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const requests = await ctx.db
      .query("requests")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .collect();
    return await presentRequests(ctx, asActor(user), requests);
  },
});

export const incoming = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const requests = (
      await ctx.db
        .query("requests")
        .withIndex("by_lender", (q) => q.eq("lenderId", user._id))
        .collect()
    ).filter(
      (request) => request.status === "pending" || request.status === "approved",
    );
    return await presentRequests(ctx, asActor(user), requests);
  },
});

export const create = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const actor = asActor(user);
    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.removedAt) {
      throw new ConvexError("That listing is not on the board.");
    }
    if (!canBorrowTool(actor, tool.ownerId)) {
      throw new ConvexError("You can't borrow your own tool.");
    }
    const today = utcToday();
    const issue = dateRangeIssue(args.startDate, args.endDate, today);
    if (issue) throw new ConvexError(dateRangeMessage(issue));

    const existing = await ctx.db
      .query("requests")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .collect();
    const dayStart = Date.parse(`${today}T00:00:00.000Z`);
    const todaysCount = existing.filter(
      (request) => request.createdAt >= dayStart,
    ).length;
    if (!withinDailyLimit(todaysCount, DAILY_REQUEST_LIMIT)) {
      throw new ConvexError(
        `You can send ${DAILY_REQUEST_LIMIT} borrow requests a day.`,
      );
    }

    const onTool = await ctx.db
      .query("requests")
      .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
      .collect();
    const duplicate = onTool.some(
      (request) =>
        request.borrowerId === user._id &&
        (request.status === "pending" || request.status === "approved") &&
        rangesOverlap(
          request.startDate,
          request.endDate,
          args.startDate,
          args.endDate,
        ),
    );
    if (duplicate) {
      throw new ConvexError(
        "You already have an open request for this tool on those dates.",
      );
    }

    const now = Date.now();
    const requestId = await ctx.db.insert("requests", {
      toolId: tool._id,
      borrowerId: user._id,
      lenderId: tool.ownerId,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    const request = await ctx.db.get(requestId);
    if (!request) throw new ConvexError("The request could not be saved.");
    await notify(ctx, request, tool.name, "pending", now, true);
    return requestId;
  },
});

export const decide = mutation({
  args: {
    requestId: v.id("requests"),
    decision: v.union(v.literal("approved"), v.literal("declined")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("That request is gone.");
    if (!canDecideRequest(asActor(user), request.lenderId)) {
      throw new ConvexError("Only the owner can approve or decline this request.");
    }
    if (request.status !== "pending") {
      throw new ConvexError("This request has already been answered.");
    }
    const tool = await ctx.db.get(request.toolId);
    if (!tool || tool.removedAt) {
      throw new ConvexError("That listing is not on the board.");
    }
    if (args.decision === "approved") {
      const approved = (
        await ctx.db
          .query("requests")
          .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
          .collect()
      ).filter((loan) => loan.status === "approved" && loan._id !== request._id);
      const conflict = approved.some((loan) =>
        rangesOverlap(
          loan.startDate,
          loan.endDate,
          request.startDate,
          request.endDate,
        ),
      );
      if (conflict) {
        throw new ConvexError(
          "Those dates overlap a loan you already approved.",
        );
      }
    }
    const now = Date.now();
    await ctx.db.patch(request._id, { status: args.decision, updatedAt: now });
    const updated = await ctx.db.get(request._id);
    if (!updated) return;
    await notify(ctx, updated, tool.name, args.decision, now, false);
  },
});

export const cancel = mutation({
  args: { requestId: v.id("requests") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("That request is gone.");
    if (!canCancelRequest(asActor(user), request.borrowerId)) {
      throw new ConvexError("You can only cancel your own requests.");
    }
    if (request.status !== "pending") {
      throw new ConvexError("Only a pending request can be cancelled.");
    }
    const tool = await ctx.db.get(request.toolId);
    const now = Date.now();
    await ctx.db.patch(request._id, { status: "cancelled", updatedAt: now });
    const updated = await ctx.db.get(request._id);
    if (!updated || !tool) return;
    await notify(ctx, updated, tool.name, "cancelled", now, true);
  },
});

export const markReturned = mutation({
  args: { requestId: v.id("requests") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("That loan is gone.");
    if (!canMarkReturned(asActor(user), request)) {
      throw new ConvexError("Only the people on this loan can mark it returned.");
    }
    if (request.status !== "approved") {
      throw new ConvexError("Only an approved loan can be marked returned.");
    }
    const tool = await ctx.db.get(request.toolId);
    const now = Date.now();
    await ctx.db.patch(request._id, {
      status: "returned",
      updatedAt: now,
      returnedAt: now,
    });
    const updated = await ctx.db.get(request._id);
    if (!updated || !tool) return;
    await notify(
      ctx,
      updated,
      tool.name,
      "returned",
      now,
      user._id === request.borrowerId,
    );
  },
});
