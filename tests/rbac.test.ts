import { describe, expect, it } from "vitest";
import {
  canAdminRemoveListing,
  canBorrowTool,
  canCancelRequest,
  canDecideRequest,
  canDeleteListing,
  canEditListing,
  canMarkReturned,
  canSetTrustedLender,
  canViewAllLoans,
  canViewLoan,
  roleForEmail,
  withinDailyLimit,
  type Actor,
} from "../convex/lib/rbac";

const owner: Actor = { id: "owner", role: "user" };
const borrower: Actor = { id: "borrower", role: "user" };
const stranger: Actor = { id: "stranger", role: "user" };
const admin: Actor = { id: "admin", role: "admin" };
const loan = { lenderId: "owner", borrowerId: "borrower" };

describe("listing permissions", () => {
  it("lets the owner edit and delete only their listing", () => {
    expect(canEditListing(owner, "owner")).toBe(true);
    expect(canEditListing(stranger, "owner")).toBe(false);
    expect(canEditListing(admin, "owner")).toBe(false);
    expect(canDeleteListing(owner, "owner")).toBe(true);
    expect(canDeleteListing(borrower, "owner")).toBe(false);
  });

  it("lets only an admin remove someone else's listing", () => {
    expect(canAdminRemoveListing(admin)).toBe(true);
    expect(canAdminRemoveListing(owner)).toBe(false);
  });

  it("stops a neighbor from borrowing their own tool", () => {
    expect(canBorrowTool(borrower, "owner")).toBe(true);
    expect(canBorrowTool(owner, "owner")).toBe(false);
  });
});

describe("loan permissions", () => {
  it("lets only the lender approve or decline", () => {
    expect(canDecideRequest(owner, "owner")).toBe(true);
    expect(canDecideRequest(admin, "owner")).toBe(false);
    expect(canDecideRequest(borrower, "owner")).toBe(false);
  });

  it("lets only the borrower cancel", () => {
    expect(canCancelRequest(borrower, "borrower")).toBe(true);
    expect(canCancelRequest(owner, "borrower")).toBe(false);
    expect(canCancelRequest(admin, "borrower")).toBe(false);
  });

  it("lets either party mark a loan returned, and lets admin view without acting", () => {
    expect(canMarkReturned(owner, loan)).toBe(true);
    expect(canMarkReturned(borrower, loan)).toBe(true);
    expect(canMarkReturned(stranger, loan)).toBe(false);
    expect(canMarkReturned(admin, loan)).toBe(false);
    expect(canViewLoan(admin, loan)).toBe(true);
    expect(canViewLoan(stranger, loan)).toBe(false);
    expect(canViewAllLoans(admin)).toBe(true);
    expect(canViewAllLoans(owner)).toBe(false);
  });
});

describe("roles", () => {
  it("promotes allow-listed emails and does not demote an existing admin", () => {
    expect(roleForEmail("Ada@Example.com", null, "ada@example.com")).toBe("admin");
    expect(roleForEmail("sam@example.com", null, "ada@example.com")).toBe("user");
    expect(roleForEmail("sam@example.com", "admin", "")).toBe("admin");
  });

  it("limits how many requests one person can send in a day", () => {
    expect(withinDailyLimit(11, 12)).toBe(true);
    expect(withinDailyLimit(12, 12)).toBe(false);
  });

  it("reserves trusted-lender changes for admins", () => {
    expect(canSetTrustedLender(admin)).toBe(true);
    expect(canSetTrustedLender(owner)).toBe(false);
  });
});
