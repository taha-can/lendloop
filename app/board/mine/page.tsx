import { QueryBoundary } from "@/components/query-boundary";
import { ToolBoard } from "@/components/tool-board";

export const metadata = { title: "My listings" };

export default function MinePage() {
  return (
    <section className="grid gap-4">
      <h1 className="text-3xl">My listings</h1>
      <QueryBoundary>
        <ToolBoard mineOnly />
      </QueryBoundary>
    </section>
  );
}
