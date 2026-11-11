import { MAX_LOAN_DAYS } from "./constants";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function addDays(isoDate: string, days: number): string {
  const match = DATE_PATTERN.exec(isoDate);
  if (!match) {
    throw new Error("Expected an ISO date");
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  return Math.round((endMs - startMs) / 86_400_000);
}

export function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA <= endB && startB <= endA;
}

export type DatedLoan = {
  status: string;
  startDate: string;
  endDate: string;
};

export function availabilityFor(
  today: string,
  loans: DatedLoan[],
): "available" | "on_loan" | "reserved" {
  const approved = loans.filter((loan) => loan.status === "approved");
  if (
    approved.some((loan) => loan.startDate <= today && today <= loan.endDate)
  ) {
    return "on_loan";
  }
  if (approved.some((loan) => loan.startDate > today)) {
    return "reserved";
  }
  return "available";
}

export function isOverdue(today: string, loan: DatedLoan): boolean {
  return loan.status === "approved" && loan.endDate < today;
}

export type DateRangeIssue =
  | "invalid"
  | "order"
  | "past"
  | "too_long"
  | null;

export function dateRangeIssue(
  startDate: string,
  endDate: string,
  today: string,
): DateRangeIssue {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return "invalid";
  if (startDate > endDate) return "order";
  if (startDate < today) return "past";
  if (daysBetween(startDate, endDate) > MAX_LOAN_DAYS) return "too_long";
  return null;
}

export function dateRangeMessage(issue: Exclude<DateRangeIssue, null>): string {
  switch (issue) {
    case "invalid":
      return "Choose a real start and end date.";
    case "order":
      return "The end date has to be on or after the start date.";
    case "past":
      return "Loans can start today, not in the past.";
    case "too_long":
      return `Neighborhood loans run for at most ${MAX_LOAN_DAYS} days.`;
  }
}

export function reminderDateAllowed(reminderDate: string, today: string): boolean {
  if (!isIsoDate(reminderDate) || !isIsoDate(today)) return false;
  return reminderDate === today || reminderDate === addDays(today, -1);
}

export function blocksListingDelete(loans: { status: string }[]): boolean {
  return loans.some(
    (loan) => loan.status === "pending" || loan.status === "approved",
  );
}
