"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

const links = [
  { href: "/board", label: "All tools" },
  { href: "/board/mine", label: "My listings" },
  { href: "/board/requests", label: "My requests" },
  { href: "/board/incoming", label: "Incoming" },
];

export function BoardNav() {
  const pathname = usePathname();
  const me = useQuery(api.users.me);
  const items =
    me?.role === "admin"
      ? [...links, { href: "/board/admin", label: "Admin" }]
      : links;

  return (
    <nav aria-label="Board" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {items.map((item) => {
        const active =
          item.href === "/board"
            ? pathname === "/board"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
