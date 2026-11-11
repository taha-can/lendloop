import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { latestByLoan } from "./lib/events";
import { asActor, getCurrentUser, requireAdmin } from "./lib/guards";
import { canSetTrustedLender, isAdmin } from "./lib/rbac";

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const admin = await getCurrentUser(ctx);
    if (!admin || !isAdmin(asActor(admin))) return null;
    const [users, tools, requests, events] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("tools").collect(),
      ctx.db.query("requests").collect(),
      ctx.db
        .query("automationEvents")
        .withIndex("by_created")
        .order("desc")
        .take(40),
    ]);
    const userName = new Map(users.map((user) => [user._id, user]));
    const toolName = new Map(tools.map((tool) => [tool._id, tool]));
    const loans = requests
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 200);
    const latest = await latestByLoan(
      ctx,
      loans.map((request) => request._id),
    );

    return {
      loans: loans.map((request) => ({
          id: request._id,
          toolName: toolName.get(request.toolId)?.name ?? "Removed tool",
          borrowerName: userName.get(request.borrowerId)?.name ?? "Neighbor",
          lenderName: userName.get(request.lenderId)?.name ?? "Neighbor",
          startDate: request.startDate,
          endDate: request.endDate,
          status: request.status,
          activity: latest.get(request._id) ?? null,
        })),
      listings: tools
        .filter((tool) => !tool.removedAt)
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 200)
        .map((tool) => ({
          id: tool._id,
          name: tool.name,
          category: tool.category,
          ownerName: userName.get(tool.ownerId)?.name ?? "Neighbor",
        })),
      lenders: users
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((user) => ({
          id: user._id,
          name: user.name,
          email: user.email,
          trustedLender: user.trustedLender,
          listings: tools.filter(
            (tool) => tool.ownerId === user._id && !tool.removedAt,
          ).length,
        })),
      activity: events.map((event) => ({
        id: event._id,
        loanId: event.loanId ?? null,
        kind: event.kind,
        summary: event.summary,
        createdAt: event.createdAt,
      })),
    };
  },
});

export const setTrusted = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!canSetTrustedLender(asActor(admin))) {
      throw new ConvexError("You need an admin role to do that.");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError("That neighbor doesn't have an account yet.");
    }
    await ctx.db.patch(target._id, { trustedLender: args.trusted });
  },
});
