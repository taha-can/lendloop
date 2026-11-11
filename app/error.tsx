"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="content"
      className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-3 px-4 py-16"
    >
      <h1 className="text-3xl">Something went sideways</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        The page did not finish loading. Your listings are still stored. Try again, and if it keeps happening, check the server logs.
      </p>
      <Button className="w-fit" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  );
}
