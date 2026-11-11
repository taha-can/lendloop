"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { readableError } from "@/lib/errors";

export function UserSync() {
  const { isLoaded, isSignedIn } = useAuth();
  const ensure = useMutation(api.users.ensure);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void ensure({})
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(readableError(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [ensure, isLoaded, isSignedIn]);

  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm">
      {error}
    </p>
  );
}
