import { QueryBoundary } from "@/components/query-boundary";
import { ToolBoard } from "@/components/tool-board";

export default function BoardPage() {
  return (
    <QueryBoundary>
      <ToolBoard />
    </QueryBoundary>
  );
}
