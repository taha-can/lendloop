import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  categoryValidator,
  conditionValidator,
  eventKindValidator,
  outboxStatusValidator,
  reminderStatusValidator,
  requestStatusValidator,
} from "./lib/validators";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    trustedLender: v.boolean(),
  }).index("by_clerkId", ["clerkId"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: categoryValidator,
    condition: conditionValidator,
    description: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    removedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),

  requests: defineTable({
    toolId: v.id("tools"),
    borrowerId: v.id("users"),
    lenderId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    status: requestStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
    returnedAt: v.optional(v.number()),
  })
    .index("by_tool", ["toolId"])
    .index("by_borrower", ["borrowerId"])
    .index("by_lender", ["lenderId"])
    .index("by_status", ["status"]),

  reminders: defineTable({
    loanId: v.id("requests"),
    reminderDate: v.string(),
    idempotencyKey: v.string(),
    status: reminderStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["idempotencyKey"])
    .index("by_loan", ["loanId"]),

  outbox: defineTable({
    idempotencyKey: v.string(),
    loanId: v.id("requests"),
    kind: v.union(
      v.literal("request_notified"),
      v.literal("status_notified"),
    ),
    status: outboxStatusValidator,
    summary: v.string(),
    payload: v.string(),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["idempotencyKey"])
    .index("by_status", ["status"]),

  automationEvents: defineTable({
    loanId: v.optional(v.id("requests")),
    kind: eventKindValidator,
    summary: v.string(),
    idempotencyKey: v.string(),
    createdAt: v.number(),
  })
    .index("by_key", ["idempotencyKey"])
    .index("by_loan", ["loanId"])
    .index("by_created", ["createdAt"]),
});
