"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CategoryIcon } from "@/components/category-icon";
import { CardSkeleton, EmptyState } from "@/components/empty-state";
import { CATEGORY_LABELS, type Category } from "@/convex/lib/constants";

export function PublicCatalog() {
  const tools = useQuery(api.tools.listPublic);
  if (tools === undefined) {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }
  if (tools.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          title="Nothing is available right now"
          body="When a neighbor lists a tool that is not already on loan, it shows up here with just the name and category."
        />
      </div>
    );
  }
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool, index) => (
        <li
          key={`${tool.category}-${tool.name}-${index}`}
          className="rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10"
        >
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <CategoryIcon category={tool.category as Category} />
            {CATEGORY_LABELS[tool.category as Category]}
          </p>
          <h3 className="mt-2 font-heading text-xl">{tool.name}</h3>
        </li>
      ))}
    </ul>
  );
}
