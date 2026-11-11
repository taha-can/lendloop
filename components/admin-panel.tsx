"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ActivityLine } from "@/components/activity-list";
import { CardSkeleton, EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";

export function AdminPanel() {
  const overview = useQuery(api.admin.overview);
  const setTrusted = useMutation(api.admin.setTrusted);
  const removeAny = useMutation(api.tools.removeAny);
  const { pending, run } = useAction();

  if (overview === undefined) return <CardSkeleton />;
  if (overview === null) {
    return (
      <EmptyState
        title="Admin only"
        body="This view is for people listed in ADMIN_EMAILS or already marked admin."
      />
    );
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h2 className="font-heading text-2xl">Lenders</h2>
        <ul className="grid gap-2">
          {overview.lenders.map((lender) => (
            <li
              key={lender.id}
              className="flex flex-col gap-2 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{lender.name}</p>
                <p className="text-sm text-muted-foreground">
                  {lender.email} · {lender.listings} active{" "}
                  {lender.listings === 1 ? "listing" : "listings"}
                </p>
              </div>
              <Button
                variant={lender.trustedLender ? "outline" : "default"}
                size="sm"
                disabled={pending !== null}
                onClick={() =>
                  void run(
                    lender.id,
                    () =>
                      setTrusted({
                        userId: lender.id,
                        trusted: !lender.trustedLender,
                      }),
                    lender.trustedLender
                      ? "Trusted lender status removed."
                      : "Marked as a trusted lender.",
                  )
                }
              >
                {lender.trustedLender ? "Remove trusted" : "Mark trusted"}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="font-heading text-2xl">Listings</h2>
        {overview.listings.length === 0 ? (
          <EmptyState
            title="No active listings"
            body="Removed listings stay out of this list. Loans against them remain below."
          />
        ) : (
          <ul className="grid gap-2">
            {overview.listings.map((listing) => (
              <li
                key={listing.id}
                className="flex flex-col gap-2 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{listing.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {listing.ownerName} · {listing.category.replaceAll("_", " ")}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pending !== null}
                  onClick={() =>
                    void run(
                      listing.id,
                      () => removeAny({ toolId: listing.id }),
                      "Listing removed.",
                    )
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-heading text-2xl">All loans</h2>
        <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Tool</th>
                <th className="px-3 py-2 font-medium">Borrower</th>
                <th className="px-3 py-2 font-medium">Lender</th>
                <th className="px-3 py-2 font-medium">Dates</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Automation</th>
              </tr>
            </thead>
            <tbody>
              {overview.loans.map((loan) => (
                <tr key={loan.id} className="border-t border-border">
                  <td className="px-3 py-2">{loan.toolName}</td>
                  <td className="px-3 py-2">{loan.borrowerName}</td>
                  <td className="px-3 py-2">{loan.lenderName}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {loan.startDate} – {loan.endDate}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge value={loan.status} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {loan.activity ? (
                      <ActivityLine
                        summary={loan.activity.summary}
                        createdAt={loan.activity.createdAt}
                      />
                    ) : (
                      "None yet"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-2">
        <h2 className="font-heading text-2xl">Recent automation</h2>
        {overview.activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Notifications and reminders will show up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {overview.activity.map((event) => (
              <li key={event.id} className="text-sm">
                <ActivityLine summary={event.summary} createdAt={event.createdAt} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
