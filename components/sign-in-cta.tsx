import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { buttonVariants } from "@/components/ui/button";
import { isClerkConfigured } from "@/lib/server-config";

export function SignInCta() {
  if (!isClerkConfigured()) {
    return (
      <Link
        href="/sign-in"
        className={buttonVariants({ size: "lg", className: "h-10 px-4" })}
      >
        Sign in to lend or borrow
      </Link>
    );
  }
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="redirect" forceRedirectUrl="/board">
          <button
            className={buttonVariants({ size: "lg", className: "h-10 px-4" })}
          >
            Sign in to lend or borrow
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Link
          href="/board"
          className={buttonVariants({ size: "lg", className: "h-10 px-4" })}
        >
          Open the board
        </Link>
      </Show>
    </>
  );
}
