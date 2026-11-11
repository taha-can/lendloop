"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { readableError } from "@/lib/errors";

type State = { error: Error | null };

export class QueryBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4"
      >
        <p className="font-medium">The board could not load.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {readableError(this.state.error)}
        </p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </Button>
      </div>
    );
  }
}
