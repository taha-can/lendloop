import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function HeaderFrame({ actions }: { actions: React.ReactNode }) {
  return (
    <header className="border-b border-border/80 bg-background/90">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground"
          >
            ↻
          </span>
          <span className="font-heading text-xl tracking-tight">LendLoop</span>
        </Link>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}

export function ShellFallback() {
  return (
    <HeaderFrame
      actions={
        <span className={buttonVariants({ variant: "outline", size: "lg" })}>
          Sign in to lend or borrow
        </span>
      }
    />
  );
}
