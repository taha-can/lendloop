import { v } from "convex/values";

export const categoryValidator = v.union(
  v.literal("power_tools"),
  v.literal("garden"),
  v.literal("kitchen"),
  v.literal("camping"),
  v.literal("automotive"),
  v.literal("cleaning"),
  v.literal("other"),
);

export const conditionValidator = v.union(
  v.literal("excellent"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("worn"),
);

export const requestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("returned"),
  v.literal("cancelled"),
);

export const reminderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("sent"),
  v.literal("failed"),
);

export const reminderPhaseValidator = v.union(
  v.literal("claim"),
  v.literal("complete"),
  v.literal("fail"),
);

export const outboxStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("delivered"),
  v.literal("failed"),
);

export const eventKindValidator = v.union(
  v.literal("request_notified"),
  v.literal("status_notified"),
  v.literal("reminder_sent"),
  v.literal("reminder_failed"),
  v.literal("delivery_failed"),
);
