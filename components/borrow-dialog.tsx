"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_LOAN_DAYS } from "@/convex/lib/constants";
import { addDays, dateRangeIssue, dateRangeMessage, isIsoDate } from "@/convex/lib/dates";
import { useAction } from "@/components/use-action";

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

export function BorrowDialog({ toolId }: { toolId: Id<"tools"> }) {
  const create = useMutation(api.requests.create);
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(todayValue);
  const [endDate, setEndDate] = useState(addDays(todayValue(), 2));
  const [formError, setFormError] = useState<string | null>(null);
  const maxEnd = isIsoDate(startDate) ? addDays(startDate, MAX_LOAN_DAYS) : undefined;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const issue = dateRangeIssue(startDate, endDate, todayValue());
    if (issue) {
      setFormError(dateRangeMessage(issue));
      return;
    }
    setFormError(null);
    const ok = await run(
      "borrow",
      () => create({ toolId, startDate, endDate }),
      "Request sent to the owner.",
    );
    if (ok) setOpen(false);
  }

  return (
    <>
      <Button className="h-10 px-4" size="lg" onClick={() => setOpen(true)}>
        Request to borrow
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request this tool</DialogTitle>
            <DialogDescription>
              The owner approves before the dates are reserved. Loans run up to{" "}
              {MAX_LOAN_DAYS} days.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="start-date">From</Label>
              <Input
                id="start-date"
                type="date"
                required
                min={todayValue()}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="end-date">Until</Label>
              <Input
                id="end-date"
                type="date"
                required
                min={startDate}
                max={maxEnd}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-10"
              />
            </div>
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={pending !== null}>
                {pending ? "Sending…" : "Send request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
