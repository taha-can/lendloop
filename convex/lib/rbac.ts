export type Role = "admin" | "user";

export type Actor = {
  id: string;
  role: Role;
};

export function isAdmin(actor: Actor): boolean {
  return actor.role === "admin";
}

export function canEditListing(actor: Actor, ownerId: string): boolean {
  return actor.id === ownerId;
}

export function canDeleteListing(actor: Actor, ownerId: string): boolean {
  return actor.id === ownerId;
}

export function canAdminRemoveListing(actor: Actor): boolean {
  return isAdmin(actor);
}

export function canSetTrustedLender(actor: Actor): boolean {
  return isAdmin(actor);
}

export function canViewAllLoans(actor: Actor): boolean {
  return isAdmin(actor);
}

export function canBorrowTool(actor: Actor, ownerId: string): boolean {
  return actor.id !== ownerId;
}

export function canDecideRequest(actor: Actor, lenderId: string): boolean {
  return actor.id === lenderId;
}

export function canCancelRequest(actor: Actor, borrowerId: string): boolean {
  return actor.id === borrowerId;
}

export function canMarkReturned(
  actor: Actor,
  loan: { lenderId: string; borrowerId: string },
): boolean {
  return actor.id === loan.lenderId || actor.id === loan.borrowerId;
}

export function canViewLoan(
  actor: Actor,
  loan: { lenderId: string; borrowerId: string },
): boolean {
  return isAdmin(actor) || canMarkReturned(actor, loan);
}

export function roleForEmail(
  email: string,
  existingRole: Role | null,
  adminEmails: string,
): Role {
  if (existingRole === "admin") return "admin";
  const allow = adminEmails
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.trim().toLowerCase()) ? "admin" : "user";
}

export function withinDailyLimit(count: number, limit: number): boolean {
  return count < limit;
}
