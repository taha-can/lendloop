import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  LISTING_CAP,
  NAME_MAX,
  NAME_MIN,
  type RequestStatus,
} from "./lib/constants";
import {
  availabilityFor,
  blocksListingDelete,
  utcToday,
} from "./lib/dates";
import { enqueueNotification } from "./lib/enqueue";
import { eventsForLoans, latestByLoan } from "./lib/events";
import { asActor, requireUser } from "./lib/guards";
import { toPublicListing } from "./lib/notifications";
import {
  canAdminRemoveListing,
  canBorrowTool,
  canCancelRequest,
  canDecideRequest,
  canDeleteListing,
  canEditListing,
  canMarkReturned,
  canViewLoan,
} from "./lib/rbac";
import { cleanLine, cleanMultiline } from "./lib/text";
import { categoryValidator, conditionValidator } from "./lib/validators";

function requestPermissions(
  actor: ReturnType<typeof asActor>,
  request: { lenderId: string; borrowerId: string; status: RequestStatus },
) {
  return {
    decide: request.status === "pending" && canDecideRequest(actor, request.lenderId),
    cancel: request.status === "pending" && canCancelRequest(actor, request.borrowerId),
    markReturned:
      request.status === "approved" && canMarkReturned(actor, request),
  };
}

function shapeRequest(
  request: Doc<"requests">,
  actor: ReturnType<typeof asActor>,
  names: Map<string, Doc<"users">>,
  activity: Map<string, { summary: string; createdAt: number }>,
  toolName: string,
) {
  return {
    id: request._id,
    toolId: request.toolId,
    toolName,
    startDate: request.startDate,
    endDate: request.endDate,
    status: request.status,
    borrowerName: names.get(request.borrowerId)?.name ?? "Neighbor",
    lenderName: names.get(request.lenderId)?.name ?? "Neighbor",
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    activity: activity.get(request._id) ?? null,
    permissions: requestPermissions(actor, request),
  };
}

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const today = utcToday();
    const tools = await ctx.db.query("tools").collect();
    const approved = await ctx.db
      .query("requests")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    return tools
      .filter((tool) => !tool.removedAt)
      .filter(
        (tool) =>
          availabilityFor(
            today,
            approved.filter((request) => request.toolId === tool._id),
          ) === "available",
      )
      .map((tool) => toPublicListing(tool))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, LISTING_CAP);
  },
});

export const listBoard = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const actor = asActor(user);
    const today = utcToday();
    const tools = (await ctx.db.query("tools").collect()).filter(
      (tool) => !tool.removedAt,
    );
    const approved = await ctx.db
      .query("requests")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const owners = await Promise.all(
      [...new Set(tools.map((tool) => tool.ownerId))].map((id) =>
        ctx.db.get(id),
      ),
    );
    const ownerById = new Map(
      owners.filter((owner) => owner !== null).map((owner) => [owner._id, owner]),
    );

    return tools
      .map((tool) => {
        const owner = ownerById.get(tool.ownerId);
        const availability = availabilityFor(
          today,
          approved.filter((request) => request.toolId === tool._id),
        );
        return {
          id: tool._id,
          name: tool.name,
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          availability,
          ownerName: owner?.name ?? "Neighbor",
          ownerTrusted: owner?.trustedLender ?? false,
          isMine: tool.ownerId === user._id,
          permissions: {
            edit: canEditListing(actor, tool.ownerId),
            delete: canDeleteListing(actor, tool.ownerId),
            adminRemove: canAdminRemoveListing(actor),
            request: canBorrowTool(actor, tool.ownerId),
          },
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, LISTING_CAP);
  },
});

export const get = query({
  args: { toolId: v.id("tools") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const actor = asActor(user);
    const tool = await ctx.db.get(args.toolId);
    if (!tool || (tool.removedAt && tool.ownerId !== user._id && !canAdminRemoveListing(actor))) {
      throw new ConvexError("That listing is not on the board.");
    }
    const owner = await ctx.db.get(tool.ownerId);
    const requests = await ctx.db
      .query("requests")
      .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
      .collect();
    const visible = requests.filter((request) => canViewLoan(actor, request));
    const today = utcToday();
    const names = new Map<string, Doc<"users">>();
    if (owner) names.set(owner._id, owner);
    const people = await Promise.all(
      [...new Set(visible.flatMap((request) => [request.borrowerId, request.lenderId]))].map(
        (id) => ctx.db.get(id),
      ),
    );
    for (const person of people) {
      if (person) names.set(person._id, person);
    }
    const visibleIds = visible.map((request) => request._id);
    const activity = await latestByLoan(ctx, visibleIds);
    const events = await eventsForLoans(ctx, visibleIds, 10);

    return {
      id: tool._id,
      name: tool.name,
      category: tool.category,
      condition: tool.condition,
      description: tool.description,
      removed: Boolean(tool.removedAt),
      availability: availabilityFor(
        today,
        requests.filter((request) => request.status === "approved"),
      ),
      ownerName: owner?.name ?? "Neighbor",
      ownerTrusted: owner?.trustedLender ?? false,
      isMine: tool.ownerId === user._id,
      permissions: {
        edit: !tool.removedAt && canEditListing(actor, tool.ownerId),
        delete: !tool.removedAt && canDeleteListing(actor, tool.ownerId),
        adminRemove: !tool.removedAt && canAdminRemoveListing(actor),
        request: !tool.removedAt && canBorrowTool(actor, tool.ownerId),
      },
      requests: visible
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((request) =>
          shapeRequest(request, actor, names, activity, tool.name),
        ),
      activity: events.slice(0, 30),
    };
  },
});

function listingInput(args: {
  name: string;
  description: string;
}) {
  const name = cleanLine(args.name, NAME_MIN, NAME_MAX);
  const description = cleanMultiline(
    args.description,
    DESCRIPTION_MIN,
    DESCRIPTION_MAX,
  );
  if (!name) {
    throw new ConvexError(
      `Give the tool a name between ${NAME_MIN} and ${NAME_MAX} characters.`,
    );
  }
  if (!description) {
    throw new ConvexError(
      `Add a short description between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters.`,
    );
  }
  return { name, description };
}

export const create = mutation({
  args: {
    name: v.string(),
    category: categoryValidator,
    condition: conditionValidator,
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { name, description } = listingInput(args);
    const now = Date.now();
    return await ctx.db.insert("tools", {
      ownerId: user._id,
      name,
      category: args.category,
      condition: args.condition,
      description,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    toolId: v.id("tools"),
    name: v.string(),
    category: categoryValidator,
    condition: conditionValidator,
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.removedAt) {
      throw new ConvexError("That listing is not on the board.");
    }
    if (!canEditListing(asActor(user), tool.ownerId)) {
      throw new ConvexError("You can only edit your own listings.");
    }
    const { name, description } = listingInput(args);
    await ctx.db.patch(tool._id, {
      name,
      category: args.category,
      condition: args.condition,
      description,
      updatedAt: Date.now(),
    });
  },
});

async function cancelPendingForRemoval(
  ctx: MutationCtx,
  tool: Doc<"tools">,
) {
  const pending = (
    await ctx.db
      .query("requests")
      .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
      .collect()
  ).filter((request) => request.status === "pending");
  const now = Date.now();
  for (const request of pending) {
    await ctx.db.patch(request._id, { status: "cancelled", updatedAt: now });
    const borrower = await ctx.db.get(request.borrowerId);
    const lender = await ctx.db.get(request.lenderId);
    if (!borrower || !lender) continue;
    await enqueueNotification(ctx, {
      requestId: request._id,
      status: "cancelled",
      updatedAt: now,
      toolName: tool.name,
      startDate: request.startDate,
      endDate: request.endDate,
      recipient: {
        role: "borrower",
        name: borrower.name,
        email: borrower.email,
      },
      counterpartyName: lender.name,
      summary: "Cancellation sent to the borrower",
    });
  }
}

export const removeOwn = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.removedAt) {
      throw new ConvexError("That listing is not on the board.");
    }
    if (!canDeleteListing(asActor(user), tool.ownerId)) {
      throw new ConvexError("You can only remove your own listings.");
    }
    const requests = await ctx.db
      .query("requests")
      .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
      .collect();
    if (blocksListingDelete(requests)) {
      throw new ConvexError(
        "Decline open requests and wait for active loans to come back before removing this listing.",
      );
    }
    await ctx.db.patch(tool._id, { removedAt: Date.now(), updatedAt: Date.now() });
  },
});

export const removeAny = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!canAdminRemoveListing(asActor(user))) {
      throw new ConvexError("You need an admin role to remove someone else's listing.");
    }
    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.removedAt) {
      throw new ConvexError("That listing is not on the board.");
    }
    await ctx.db.patch(tool._id, {
      removedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await cancelPendingForRemoval(ctx, tool);
  },
});
