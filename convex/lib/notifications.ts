import type { RequestStatus } from "./constants";
import { notifyKey } from "./idempotency";

export type RecipientRole = "lender" | "borrower";

export type NotificationPayload = {
  event: "borrow_request.created" | "borrow_request.updated";
  idempotencyKey: string;
  requestId: string;
  toolName: string;
  startDate: string;
  endDate: string;
  status: RequestStatus;
  recipient: {
    role: RecipientRole;
    name: string;
    email: string;
  };
  counterpartyName: string;
};

export function notificationAudience(args: {
  status: RequestStatus;
  actorIsBorrower: boolean;
}): RecipientRole | null {
  switch (args.status) {
    case "pending":
    case "cancelled":
      return "lender";
    case "approved":
    case "declined":
      return "borrower";
    case "returned":
      return args.actorIsBorrower ? "lender" : "borrower";
    default:
      return null;
  }
}

export function notificationSummary(
  status: RequestStatus,
  recipient: RecipientRole,
): string {
  switch (status) {
    case "pending":
      return "Borrow request sent to the lender";
    case "approved":
      return "Approval sent to the borrower";
    case "declined":
      return "Decline sent to the borrower";
    case "cancelled":
      return "Cancellation sent to the lender";
    case "returned":
      return recipient === "lender"
        ? "Return notice sent to the lender"
        : "Return notice sent to the borrower";
  }
}

export function buildNotificationPayload(args: {
  requestId: string;
  status: RequestStatus;
  updatedAt: number;
  toolName: string;
  startDate: string;
  endDate: string;
  recipient: { role: RecipientRole; name: string; email: string };
  counterpartyName: string;
}): NotificationPayload {
  return {
    event:
      args.status === "pending"
        ? "borrow_request.created"
        : "borrow_request.updated",
    idempotencyKey: notifyKey(args.requestId, args.status, args.updatedAt),
    requestId: args.requestId,
    toolName: args.toolName,
    startDate: args.startDate,
    endDate: args.endDate,
    status: args.status,
    recipient: {
      role: args.recipient.role,
      name: args.recipient.name,
      email: args.recipient.email,
    },
    counterpartyName: args.counterpartyName,
  };
}

export function notificationText(payload: NotificationPayload): string {
  const who = payload.recipient.name;
  const other = payload.counterpartyName;
  const tool = payload.toolName;
  const range = `${payload.startDate} to ${payload.endDate}`;
  switch (payload.status) {
    case "pending":
      return `${who}, ${other} asked to borrow ${tool} from ${range}.`;
    case "approved":
      return `${who}, ${other} approved your request for ${tool} (${range}).`;
    case "declined":
      return `${who}, ${other} declined your request for ${tool} (${range}).`;
    case "cancelled":
      return `${who}, the request for ${tool} (${range}) was cancelled.`;
    case "returned":
      return `${who}, ${other} marked ${tool} as returned.`;
  }
}

export function reminderText(loan: {
  borrowerName: string;
  toolName: string;
  dueDate: string;
}): string {
  return `${loan.borrowerName}, ${loan.toolName} was due back on ${loan.dueDate}. Please return it or message the owner.`;
}

export function toPublicListing<T extends { name: string; category: string }>(
  tool: T,
): { name: string; category: T["category"] } {
  return { name: tool.name, category: tool.category };
}
