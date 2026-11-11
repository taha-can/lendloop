import { describe, expect, it } from "vitest";
import {
  availabilityFor,
  blocksListingDelete,
  dateRangeIssue,
  isOverdue,
  rangesOverlap,
  reminderDateAllowed,
} from "../convex/lib/dates";

describe("availability", () => {
  const today = "2026-11-11";

  it("treats an inclusive overlap as on loan, ahead of a future reservation", () => {
    expect(
      availabilityFor(today, [
        { status: "approved", startDate: "2026-11-20", endDate: "2026-11-22" },
        { status: "approved", startDate: "2026-11-11", endDate: "2026-11-11" },
        { status: "pending", startDate: "2026-11-01", endDate: "2026-11-30" },
      ]),
    ).toBe("on_loan");
  });

  it("marks a future approval as reserved and ignores returned loans", () => {
    expect(
      availabilityFor(today, [
        { status: "returned", startDate: "2026-11-01", endDate: "2026-11-20" },
        { status: "approved", startDate: "2026-11-12", endDate: "2026-11-13" },
      ]),
    ).toBe("reserved");
    expect(availabilityFor(today, [])).toBe("available");
  });

  it("counts a loan overdue only after the end date", () => {
    expect(
      isOverdue(today, {
        status: "approved",
        startDate: "2026-11-01",
        endDate: "2026-11-11",
      }),
    ).toBe(false);
    expect(
      isOverdue(today, {
        status: "approved",
        startDate: "2026-11-01",
        endDate: "2026-11-10",
      }),
    ).toBe(true);
  });
});

describe("date rules", () => {
  it("overlaps when ranges touch", () => {
    expect(rangesOverlap("2026-11-01", "2026-11-05", "2026-11-05", "2026-11-08")).toBe(
      true,
    );
    expect(rangesOverlap("2026-11-01", "2026-11-04", "2026-11-05", "2026-11-08")).toBe(
      false,
    );
  });

  it("rejects past, backwards, and over-long ranges", () => {
    expect(dateRangeIssue("2026-11-10", "2026-11-12", "2026-11-11")).toBe("past");
    expect(dateRangeIssue("2026-11-12", "2026-11-11", "2026-11-11")).toBe("order");
    expect(dateRangeIssue("2026-11-11", "2026-12-20", "2026-11-11")).toBe("too_long");
    expect(dateRangeIssue("2026-11-11", "2026-11-11", "2026-11-11")).toBeNull();
    expect(dateRangeIssue("nope", "2026-11-11", "2026-11-11")).toBe("invalid");
  });

  it("allows a reminder dated today or yesterday", () => {
    expect(reminderDateAllowed("2026-11-11", "2026-11-11")).toBe(true);
    expect(reminderDateAllowed("2026-11-10", "2026-11-11")).toBe(true);
    expect(reminderDateAllowed("2026-11-09", "2026-11-11")).toBe(false);
  });

  it("blocks owner deletion while a request is still open", () => {
    expect(blocksListingDelete([{ status: "declined" }, { status: "returned" }])).toBe(
      false,
    );
    expect(blocksListingDelete([{ status: "pending" }])).toBe(true);
    expect(blocksListingDelete([{ status: "approved" }])).toBe(true);
  });
});
