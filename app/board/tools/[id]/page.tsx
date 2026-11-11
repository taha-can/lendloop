import { QueryBoundary } from "@/components/query-boundary";
import { ToolDetail } from "@/components/tool-detail";

export default async function ToolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <QueryBoundary>
      <ToolDetail toolId={id} />
    </QueryBoundary>
  );
}
