import { NewListingForm } from "@/components/new-listing-form";

export const metadata = { title: "List a tool" };

export default function NewToolPage() {
  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-3xl">List a tool</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
          Say what it is, what shape it is in, and anything a borrower should know.
          You approve each request before the tool is reserved.
        </p>
      </div>
      <NewListingForm />
    </section>
  );
}
