import { SignInCta } from "@/components/sign-in-cta";
import { PublicCatalog } from "@/components/public-catalog";
import { QueryBoundary } from "@/components/query-boundary";
import { SetupNotice } from "@/components/setup-notice";
import { isConvexConfigured } from "@/lib/public-config";

export default function HomePage() {
  const live = isConvexConfigured();
  return (
    <main
      id="content"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12"
    >
      <section className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Neighborhood tool board</p>
        <h1 className="mt-2 text-4xl leading-tight text-balance sm:text-5xl">
          Borrow what you need. Lend what you don&apos;t.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          Ladders, mixers, tents, and the drill that comes out twice a year.
          List what you can spare, and ask a neighbor before you buy another one.
        </p>
        <div className="mt-6">
          <SignInCta />
        </div>
      </section>
      <section className="mt-12" aria-labelledby="available-heading">
        <h2 id="available-heading" className="text-2xl">
          Available right now
        </h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
          Names and categories only. Owner details stay off this page.
        </p>
        {live ? (
          <QueryBoundary>
            <PublicCatalog />
          </QueryBoundary>
        ) : (
          <div className="mt-4">
            <SetupNotice topic="live listings" showHomeLink={false} />
          </div>
        )}
      </section>
    </main>
  );
}
