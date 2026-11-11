import { cn } from "@/lib/utils";
import {
  AVAILABILITY_LABELS,
  STATUS_LABELS,
} from "@/convex/lib/constants";

const tones: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-950",
  on_loan: "bg-orange-100 text-orange-950",
  reserved: "bg-sky-100 text-sky-950",
  pending: "bg-amber-100 text-amber-950",
  approved: "bg-emerald-100 text-emerald-950",
  declined: "bg-stone-200 text-stone-700",
  returned: "bg-stone-200 text-stone-700",
  cancelled: "bg-stone-200 text-stone-700",
};

export function StatusBadge({ value }: { value: string }) {
  const label =
    AVAILABILITY_LABELS[value as keyof typeof AVAILABILITY_LABELS] ??
    STATUS_LABELS[value as keyof typeof STATUS_LABELS] ??
    value;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
        tones[value] ?? "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function TrustedBadge() {
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-accent px-2 text-xs font-medium text-accent-foreground">
      Trusted lender
    </span>
  );
}
