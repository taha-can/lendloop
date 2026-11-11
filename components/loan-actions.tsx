"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";

type Permissions = {
  decide: boolean;
  cancel: boolean;
  markReturned: boolean;
};

export function LoanActions({
  requestId,
  permissions,
}: {
  requestId: Id<"requests">;
  permissions: Permissions;
}) {
  const decide = useMutation(api.requests.decide);
  const cancel = useMutation(api.requests.cancel);
  const markReturned = useMutation(api.requests.markReturned);
  const { pending, run } = useAction();
  const busy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {permissions.decide ? (
        <>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(
                "approve",
                () => decide({ requestId, decision: "approved" }),
                "Request approved.",
              )
            }
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(
                "decline",
                () => decide({ requestId, decision: "declined" }),
                "Request declined.",
              )
            }
          >
            Decline
          </Button>
        </>
      ) : null}
      {permissions.cancel ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(
              "cancel",
              () => cancel({ requestId }),
              "Request cancelled.",
            )
          }
        >
          Cancel request
        </Button>
      ) : null}
      {permissions.markReturned ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            void run(
              "return",
              () => markReturned({ requestId }),
              "Marked as returned.",
            )
          }
        >
          Mark returned
        </Button>
      ) : null}
    </div>
  );
}
