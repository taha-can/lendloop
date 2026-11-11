import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { HeaderFrame } from "@/components/shell-fallback";
import { buttonVariants } from "@/components/ui/button";
import { isClerkConfigured } from "@/lib/server-config";

export function SiteHeader() {
  const clerkReady = isClerkConfigured();
  return (
    <HeaderFrame
      actions={
        clerkReady ? (
          <AuthControls />
        ) : (
          <Link
            href="/sign-in"
            className={buttonVariants({ size: "lg", className: "h-10 px-3" })}
          >
            Sign in to lend or borrow
          </Link>
        )
      }
    />
  );
}

async function AuthControls() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="redirect" forceRedirectUrl="/board">
          <button
            className={buttonVariants({ size: "lg", className: "h-10 px-3" })}
          >
            Sign in to lend or borrow
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Link
          href="/board"
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "h-10 px-3",
          })}
        >
          Open the board
        </Link>
        <UserButton />
      </Show>
    </>
  );
}
