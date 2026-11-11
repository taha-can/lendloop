import { describe, expect, it } from "vitest";
import {
  REMINDER_RETRY_MS,
  decideOutboxClaim,
  decideOutboxComplete,
  decideOutboxFail,
  decideReminder,
  isFailureKey,
  isNotifyKey,
  notifyKey,
  overdueKey,
} from "../convex/lib/idempotency";

const now = 1_700_000_000_000;

describe("reminder decisions", () => {
  it("claims once, ignores a fresh duplicate, and allows a stale retry", () => {
    expect(decideReminder(null, "claim", now)).toEqual({
      action: "insert",
      status: "pending",
      send: true,
    });
    expect(
      decideReminder({ status: "pending", updatedAt: now - 1000 }, "claim", now),
    ).toEqual({ action: "noop", status: "pending", send: false });
    expect(
      decideReminder(
        { status: "pending", updatedAt: now - REMINDER_RETRY_MS },
        "claim",
        now,
      ),
    ).toEqual({ action: "update", status: "pending", send: true });
  });

  it("does not send again after a reminder was sent", () => {
    expect(
      decideReminder({ status: "sent", updatedAt: now }, "claim", now),
    ).toEqual({ action: "noop", status: "sent", send: false });
    expect(
      decideReminder({ status: "sent", updatedAt: now }, "complete", now),
    ).toEqual({ action: "noop", status: "sent", send: false });
  });

  it("does not downgrade a sent reminder to failed", () => {
    expect(
      decideReminder({ status: "sent", updatedAt: now }, "fail", now),
    ).toEqual({ action: "noop", status: "sent", send: false });
  });

  it("records success after a failed attempt", () => {
    expect(
      decideReminder({ status: "failed", updatedAt: now }, "claim", now),
    ).toEqual({ action: "update", status: "pending", send: true });
    expect(
      decideReminder({ status: "failed", updatedAt: now }, "complete", now),
    ).toEqual({ action: "update", status: "sent", send: false });
  });

  it("builds stable keys and rejects keys that do not match the scheme", () => {
    const key = notifyKey("jd7abc", "pending", 1_700_000_000_000);
    expect(key).toBe("notify:jd7abc:pending:1700000000000");
    expect(isNotifyKey(key)).toBe(true);
    expect(isNotifyKey("notify:jd7abc:pending:10")).toBe(false);
    expect(isNotifyKey(`event:${key}:failed`)).toBe(false);
    expect(isFailureKey(`event:${key}:failed`)).toBe(true);
    expect(isFailureKey("n8n-error:4821")).toBe(true);
    expect(isFailureKey("event:overdue:loan:2026-11-11:sent")).toBe(false);
    expect(overdueKey("loan1", "2026-11-11")).toBe("overdue:loan1:2026-11-11");
  });
});

describe("outbox decisions", () => {
  it("claims pending work and refuses a fresh in-progress claim", () => {
    expect(decideOutboxClaim({ status: "pending", updatedAt: now }, now)).toEqual({
      claim: true,
    });
    expect(
      decideOutboxClaim({ status: "processing", updatedAt: now }, now),
    ).toEqual({ claim: false });
    expect(decideOutboxClaim({ status: "delivered", updatedAt: now }, now)).toEqual({
      claim: false,
    });
    expect(decideOutboxClaim(null, now)).toEqual({ claim: false });
  });

  it("treats completion as idempotent and refuses to fail a delivery", () => {
    expect(decideOutboxComplete("delivered")).toBe("noop");
    expect(decideOutboxComplete("processing")).toBe("deliver");
    expect(decideOutboxFail("delivered")).toBe("noop");
    expect(decideOutboxFail("failed")).toBe("noop");
    expect(decideOutboxFail("processing")).toBe("fail");
  });
});
