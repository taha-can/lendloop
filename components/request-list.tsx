"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ActivityLine } from "@/components/activity-list";
import { CardSkeleton, EmptyState } from "@/components/empty-state";
import { LoanActions } from "@/components/loan-actions";
import { StatusBadge } from "@/components/status-badge";

export function RequestList({
  view,
}: {
  view: "mine" | "incoming";
}) {
  const requests = useQuery(
    view === "mine" ? api.requests.mine : api.requests.incoming,
  );
  if (requests === undefined) return <CardSkeleton />;
  if (requests.length === 0) {
    return (
      <EmptyState
        title={view === "mine" ? "No requests yet" : "Nothing waiting on you"}
        body={
          view === "mine"
            ? "When you ask to borrow something, it shows up here with the dates and whatever the automation has done."
            : "Approve or decline requests for your tools, and mark a loan returned when it comes home."
        }
      />
    );
  }
  return (
    <ul className="grid gap-3">
      {requests.map((request) => (
        <li
          key={request.id}
          className="rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link
                href={`/board/tools/${request.toolId}`}
                className="font-heading text-xl hover:underline"
              >
                {request.toolName}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">
                {request.startDate} to {request.endDate}
                {view === "incoming"
                  ? ` · ${request.borrowerName}`
                  : ` · ${request.lenderName}`}
              </p>
            </div>
            <StatusBadge value={request.status} />
          </div>
          {request.activity ? (
            <p className="mt-2 text-sm text-muted-foreground">
              <ActivityLine
                summary={request.activity.summary}
                createdAt={request.activity.createdAt}
              />
            </p>
          ) : null}
          <div className="mt-3">
            <LoanActions requestId={request.id} permissions={request.permissions} />
          </div>
        </li>
      ))}
    </ul>
  );
}
