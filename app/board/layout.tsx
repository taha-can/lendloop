import Link from "next/link";
import { BoardNav } from "@/components/board-nav";
import { SetupNotice } from "@/components/setup-notice";
import { UserSync } from "@/components/user-sync";
import { buttonVariants } from "@/components/ui/button";
import { isConvexConfigured } from "@/lib/public-config";
import { isClerkConfigured } from "@/lib/server-config";

export const metadata = { title: "Board" };

export default function BoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isClerkConfigured() || !isConvexConfigured()) {
    return (
      <main id="content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <SetupNotice topic="the signed-in board" />
      </main>
    );
  }
  return (
    <div
      id="content"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6"
    >
      <UserSync />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BoardNav />
        <Link
          href="/board/tools/new"
          className={buttonVariants({ size: "lg", className: "h-9 px-3" })}
        >
          List a tool
        </Link>
      </div>
      {children}
    </div>
  );
}
