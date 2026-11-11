import { QueryBoundary } from "@/components/query-boundary";
import { RequestList } from "@/components/request-list";

export const metadata = { title: "My requests" };

export default function RequestsPage() {
  return (
    <section className="grid gap-4">
      <h1 className="text-3xl">My requests</h1>
      <QueryBoundary>
        <RequestList view="mine" />
      </QueryBoundary>
    </section>
  );
}
