import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { Suspense } from "react";
import { ShellFallback } from "@/components/shell-fallback";
import { RootProviders } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "LendLoop",
    template: "%s · LendLoop",
  },
  description:
    "Borrow what you need. Lend what you don't. A neighborhood board for tools you already own.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} h-full`}
      style={{ colorScheme: "light" }}
    >
      <body className="flex min-h-full flex-col antialiased">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow"
        >
          Skip to content
        </a>
        <Suspense fallback={<ShellFallback />}>
          <RootProviders>
            <SiteHeader />
            <div className="flex flex-1 flex-col">{children}</div>
          </RootProviders>
        </Suspense>
      </body>
    </html>
  );
}
