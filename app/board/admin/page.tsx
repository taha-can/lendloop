import { AdminPanel } from "@/components/admin-panel";
import { QueryBoundary } from "@/components/query-boundary";

export const metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-3xl">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Remove a listing, review every loan, or mark a neighbor as a trusted lender.
        </p>
      </div>
      <QueryBoundary>
        <AdminPanel />
      </QueryBoundary>
    </section>
  );
}
