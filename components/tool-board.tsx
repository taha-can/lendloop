"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CategoryIcon } from "@/components/category-icon";
import { CardSkeleton, EmptyState } from "@/components/empty-state";
import { StatusBadge, TrustedBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
} from "@/convex/lib/constants";

export function ToolBoard({ mineOnly = false }: { mineOnly?: boolean }) {
  const tools = useQuery(api.tools.listBoard);
  const [category, setCategory] = useState<Category | "all">("all");
  const visible = useMemo(() => {
    if (!tools) return [];
    return tools.filter((tool) => {
      if (mineOnly && !tool.isMine) return false;
      if (category !== "all" && tool.category !== category) return false;
      return true;
    });
  }, [tools, mineOnly, category]);

  if (tools === undefined) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div
        role="group"
        aria-label="Filter by category"
        className="flex gap-1 overflow-x-auto pb-1"
      >
        <FilterChip
          active={category === "all"}
          onClick={() => setCategory("all")}
          label="All"
        />
        {CATEGORIES.map((item) => (
          <FilterChip
            key={item}
            active={category === item}
            onClick={() => setCategory(item)}
            label={CATEGORY_LABELS[item]}
          />
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState
          title={mineOnly ? "You have not listed a tool yet" : "No tools in this view"}
          body={
            mineOnly
              ? "List something that spends most of the year in a cupboard. Neighbors can ask before you hand it over."
              : "Try another category, or check back after someone lists a tool."
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((tool) => (
            <li key={tool.id}>
              <Link
                href={`/board/tools/${tool.id}`}
                className="block rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10 transition hover:ring-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    <CategoryIcon category={tool.category} />
                    {CATEGORY_LABELS[tool.category]}
                  </p>
                  <StatusBadge value={tool.availability} />
                </div>
                <h2 className="mt-2 font-heading text-xl">{tool.name}</h2>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{tool.isMine ? "Your listing" : tool.ownerName}</span>
                  {tool.ownerTrusted ? <TrustedBadge /> : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-sm",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
