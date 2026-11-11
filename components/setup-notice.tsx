import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function SetupNotice({
  topic = "the live board",
  showHomeLink = true,
}: {
  topic?: string;
  showHomeLink?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/80 px-5 py-6">
      <h2 className="font-heading text-2xl">Connect LendLoop to run {topic}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        The app is ready. Add Clerk and Convex keys from the README, then
        restart the dev server. Until then, sign-in and the live tool list stay
        offline so nothing pretends to be a real neighbor.
      </p>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm leading-6">
        <li>Copy <code>.env.example</code> to <code>.env.local</code>.</li>
        <li>Fill the Clerk and Convex values, including the JWT template.</li>
        <li>Run <code>npx convex dev</code> and set the Convex environment variables.</li>
      </ol>
      {showHomeLink ? (
        <Link
          href="/"
          className={buttonVariants({
            variant: "outline",
            className: "mt-4 h-9 px-3",
          })}
        >
          Back to the board
        </Link>
      ) : null}
    </div>
  );
}
