export type ReminderStatus = "pending" | "sent" | "failed";
export type ReminderPhase = "claim" | "complete" | "fail";

export type ReminderDecision =
  | { action: "insert"; status: ReminderStatus; send: boolean }
  | { action: "update"; status: ReminderStatus; send: boolean }
  | { action: "noop"; status: ReminderStatus; send: boolean };

export function overdueKey(loanId: string, day: string): string {
  return `overdue:${loanId}:${day}`;
}

export function notifyKey(
  requestId: string,
  status: string,
  updatedAt: number,
): string {
  return `notify:${requestId}:${status}:${updatedAt}`;
}

const NOTIFY_KEY =
  /^notify:[A-Za-z0-9]+:(?:pending|approved|declined|returned|cancelled):\d{10,16}$/;
const FAILURE_KEY =
  /^(?:n8n-error:[A-Za-z0-9_.:-]{1,80}|event:[A-Za-z0-9_.:-]{1,160}:failed)$/;

export function isNotifyKey(key: string): boolean {
  return key.length <= 200 && NOTIFY_KEY.test(key);
}

export function isFailureKey(key: string): boolean {
  return key.length <= 220 && FAILURE_KEY.test(key);
}

export function decideReminder(
  existing: { status: ReminderStatus; updatedAt: number } | null,
  phase: ReminderPhase,
  now: number,
): ReminderDecision {
  if (!existing) {
    if (phase === "claim") {
      return { action: "insert", status: "pending", send: true };
    }
    if (phase === "complete") {
      return { action: "insert", status: "sent", send: false };
    }
    return { action: "insert", status: "failed", send: false };
  }

  if (phase === "claim") {
    if (existing.status === "sent") {
      return { action: "noop", status: "sent", send: false };
    }
    if (existing.status === "pending") {
      if (now - existing.updatedAt >= REMINDER_RETRY_MS) {
        return { action: "update", status: "pending", send: true };
      }
      return { action: "noop", status: "pending", send: false };
    }
    return { action: "update", status: "pending", send: true };
  }

  if (phase === "complete") {
    if (existing.status === "sent") {
      return { action: "noop", status: "sent", send: false };
    }
    return { action: "update", status: "sent", send: false };
  }

  if (existing.status === "sent" || existing.status === "failed") {
    return { action: "noop", status: existing.status, send: false };
  }
  return { action: "update", status: "failed", send: false };
}

export type OutboxStatus = "pending" | "processing" | "delivered" | "failed";

export const RECLAIM_PENDING_MS = 2 * 60 * 1000;
export const RECLAIM_PROCESSING_MS = 15 * 60 * 1000;
export const RECLAIM_FAILED_MS = 5 * 60 * 1000;
export const REMINDER_RETRY_MS = 10 * 60 * 1000;

export function canReclaim(
  status: OutboxStatus,
  updatedAt: number,
  now: number,
): boolean {
  const age = now - updatedAt;
  if (status === "pending") return age >= RECLAIM_PENDING_MS;
  if (status === "processing") return age >= RECLAIM_PROCESSING_MS;
  if (status === "failed") return age >= RECLAIM_FAILED_MS;
  return false;
}

export function decideOutboxClaim(
  existing: { status: OutboxStatus; updatedAt: number } | null,
  now: number,
): { claim: boolean } {
  if (!existing) return { claim: false };
  if (existing.status === "delivered") return { claim: false };
  if (existing.status === "pending" || existing.status === "failed") {
    return { claim: true };
  }
  if (canReclaim(existing.status, existing.updatedAt, now)) {
    return { claim: true };
  }
  return { claim: false };
}

export function decideOutboxComplete(
  status: OutboxStatus,
): "deliver" | "noop" {
  return status === "delivered" ? "noop" : "deliver";
}

export function decideOutboxFail(status: OutboxStatus): "fail" | "noop" {
  if (status === "delivered" || status === "failed") return "noop";
  return "fail";
}
