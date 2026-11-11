import { describe, expect, it } from "vitest";
import { activityLine } from "../lib/activity";
import {
  buildNotificationPayload,
  notificationText,
  reminderText,
  toPublicListing,
} from "../convex/lib/notifications";
import { publicErrorMessage } from "../convex/lib/text";

describe("public listings", () => {
  it("keeps only the name and category", () => {
    const listing = toPublicListing({
      name: "Hedge trimmer",
      category: "garden",
      ownerId: "user_123",
      description: "Stored behind the house",
      condition: "good",
    });
    expect(listing).toEqual({ name: "Hedge trimmer", category: "garden" });
    expect(Object.keys(listing)).toEqual(["name", "category"]);
  });
});

describe("notification payloads", () => {
  const payload = buildNotificationPayload({
    requestId: "req_1",
    status: "pending",
    updatedAt: 20,
    toolName: "Hedge trimmer",
    startDate: "2026-11-12",
    endDate: "2026-11-14",
    recipient: { role: "lender", name: "Ada", email: "ada@example.com" },
    counterpartyName: "Sam",
  });

  it("sends the recipient address and nothing else about the account", () => {
    expect(Object.keys(payload).sort()).toEqual([
      "counterpartyName",
      "endDate",
      "event",
      "idempotencyKey",
      "recipient",
      "requestId",
      "startDate",
      "status",
      "toolName",
    ]);
    expect(payload.recipient).toEqual({
      role: "lender",
      name: "Ada",
      email: "ada@example.com",
    });
    expect(JSON.stringify(payload)).not.toContain("description");
    expect(JSON.stringify(payload)).not.toContain("clerk");
  });

  it("keeps the delivered sentence free of the email address", () => {
    const text = notificationText(payload);
    expect(text).toBe(
      "Ada, Sam asked to borrow Hedge trimmer from 2026-11-12 to 2026-11-14.",
    );
    expect(text).not.toContain("@");
    expect(
      reminderText({
        borrowerName: "Sam",
        toolName: "Hedge trimmer",
        dueDate: "2026-11-10",
      }),
    ).toBe(
      "Sam, Hedge trimmer was due back on 2026-11-10. Please return it or message the owner.",
    );
  });
});

describe("activity copy", () => {
  const now = Date.parse("2026-11-11T12:00:00.000Z");

  it("formats the reminder line the board shows", () => {
    expect(activityLine("Reminder sent", now, now)).toBe("Reminder sent today");
    expect(activityLine("Reminder sent", now - 2 * 24 * 60 * 60 * 1000, now)).toBe(
      "Reminder sent 2 days ago",
    );
    expect(activityLine("Reminder sent", now - 24 * 60 * 60 * 1000, now)).toBe(
      "Reminder sent 1 day ago",
    );
  });
});

describe("stored errors", () => {
  it("drops signatures and control characters", () => {
    const cleaned = publicErrorMessage(
      "delivery failed v1=abcdef0123456789abcdef\nnext",
    );
    expect(cleaned).not.toContain("abcdef0123456789");
    expect(cleaned).toContain("v1=[redacted]");
    expect(cleaned).not.toContain("\n");
  });
});
