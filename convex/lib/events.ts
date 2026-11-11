import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function latestByLoan(
  ctx: QueryCtx,
  loanIds: Id<"requests">[],
) {
  const unique = [...new Set(loanIds)];
  const rows = await Promise.all(
    unique.map(async (loanId) => {
      const event = await ctx.db
        .query("automationEvents")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .order("desc")
        .first();
      return [loanId, event] as const;
    }),
  );
  const map = new Map<string, { summary: string; createdAt: number }>();
  for (const [loanId, event] of rows) {
    if (!event) continue;
    map.set(loanId, { summary: event.summary, createdAt: event.createdAt });
  }
  return map;
}

export async function eventsForLoans(
  ctx: QueryCtx,
  loanIds: Id<"requests">[],
  limitPerLoan: number,
) {
  const unique = [...new Set(loanIds)];
  const groups = await Promise.all(
    unique.map((loanId) =>
      ctx.db
        .query("automationEvents")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .order("desc")
        .take(limitPerLoan),
    ),
  );
  return groups
    .flat()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((event) => ({
      id: event._id,
      loanId: event.loanId ?? null,
      kind: event.kind,
      summary: event.summary,
      createdAt: event.createdAt,
    }));
}
