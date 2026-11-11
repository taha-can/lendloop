export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/70 px-5 py-8">
      <h2 className="font-heading text-2xl">{title}</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="h-28 animate-pulse rounded-2xl bg-muted" aria-hidden />
  );
}
