"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ActivityLine, ActivityList } from "@/components/activity-list";
import { BorrowDialog } from "@/components/borrow-dialog";
import { CardSkeleton } from "@/components/empty-state";
import { ListingForm } from "@/components/listing-form";
import { LoanActions } from "@/components/loan-actions";
import { StatusBadge, TrustedBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
} from "@/convex/lib/constants";
import { useAction } from "@/components/use-action";
import { useRouter } from "next/navigation";

export function ToolDetail({ toolId }: { toolId: string }) {
  const tool = useQuery(api.tools.get, {
    toolId: toolId as Id<"tools">,
  });
  const update = useMutation(api.tools.update);
  const removeOwn = useMutation(api.tools.removeOwn);
  const removeAny = useMutation(api.tools.removeAny);
  const { pending, run } = useAction();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"own" | "admin" | null>(null);

  if (tool === undefined) return <CardSkeleton />;
  if (tool === null) return null;

  return (
    <article className="grid gap-6">
      <header className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          {CATEGORY_LABELS[tool.category]} · {CONDITION_LABELS[tool.condition]}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-4xl">{tool.name}</h1>
          {tool.removed ? (
            <span className="inline-flex h-5 items-center rounded-full bg-stone-200 px-2 text-xs font-medium text-stone-700">
              Removed
            </span>
          ) : (
            <StatusBadge value={tool.availability} />
          )}
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{tool.isMine ? "Your listing" : tool.ownerName}</span>
          {tool.ownerTrusted ? <TrustedBadge /> : null}
        </p>
      </header>

      {tool.removed ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm">
          This listing was taken off the board.
        </p>
      ) : null}

      <p className="max-w-2xl text-base leading-7 whitespace-pre-wrap">
        {tool.description}
      </p>

      <div className="flex flex-wrap gap-2">
        {tool.permissions.request ? <BorrowDialog toolId={tool.id} /> : null}
        {tool.permissions.edit ? (
          <Button variant="outline" onClick={() => setEditing((value) => !value)}>
            {editing ? "Close editor" : "Edit listing"}
          </Button>
        ) : null}
        {tool.permissions.delete ? (
          <Button variant="outline" onClick={() => setConfirm("own")}>
            Remove listing
          </Button>
        ) : null}
        {tool.permissions.adminRemove && !tool.isMine ? (
          <Button variant="destructive" onClick={() => setConfirm("admin")}>
            Remove as admin
          </Button>
        ) : null}
      </div>

      {editing && tool.permissions.edit ? (
        <ListingForm
          initial={{
            name: tool.name,
            category: tool.category,
            condition: tool.condition,
            description: tool.description,
          }}
          submitLabel="Save changes"
          onSubmit={(values) => update({ toolId: tool.id, ...values })}
        />
      ) : null}

      {tool.requests.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="font-heading text-2xl">Requests</h2>
          <ul className="grid gap-3">
            {tool.requests.map((request) => (
              <li
                key={request.id}
                className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {request.borrowerName} · {request.startDate} to {request.endDate}
                  </p>
                  <StatusBadge value={request.status} />
                </div>
                {request.activity ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    <ActivityLine
                      summary={request.activity.summary}
                      createdAt={request.activity.createdAt}
                    />
                  </p>
                ) : null}
                <div className="mt-3">
                  <LoanActions
                    requestId={request.id}
                    permissions={request.permissions}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-2">
        <h2 className="font-heading text-2xl">Automation</h2>
        <ActivityList events={tool.activity} />
      </section>

      <Dialog open={confirm !== null} onOpenChange={() => setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "admin" ? "Remove this listing?" : "Take this listing down?"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "admin"
                ? "Pending requests are cancelled and the borrower is notified. Approved loans stay on the record until someone marks them returned."
                : "You can remove a listing once open requests are settled and nothing is still out on loan."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant={confirm === "admin" ? "destructive" : "default"}
              disabled={pending !== null}
              onClick={() =>
                void run("remove", async () => {
                  if (confirm === "admin") {
                    await removeAny({ toolId: tool.id });
                  } else {
                    await removeOwn({ toolId: tool.id });
                  }
                  setConfirm(null);
                  router.push("/board");
                }, "Listing removed.")
              }
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
