"use client";

import { useState } from "react";
import { activityLine } from "@/lib/activity";

export function ActivityLine({
  summary,
  createdAt,
}: {
  summary: string;
  createdAt: number;
}) {
  const [now] = useState(() => Date.now());
  return <span>{activityLine(summary, createdAt, now)}</span>;
}

export function ActivityList({
  events,
}: {
  events: { id: string; summary: string; createdAt: number }[];
}) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No automation activity yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {events.map((event) => (
        <li key={event.id} className="text-sm">
          <ActivityLine summary={event.summary} createdAt={event.createdAt} />
        </li>
      ))}
    </ul>
  );
}
