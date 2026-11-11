import { QueryBoundary } from "@/components/query-boundary";
import { RequestList } from "@/components/request-list";

export const metadata = { title: "Incoming requests" };

export default function IncomingPage() {
  return (
    <section className="grid gap-4">
      <h1 className="text-3xl">Incoming requests</h1>
      <QueryBoundary>
        <RequestList view="incoming" />
      </QueryBoundary>
    </section>
  );
}
