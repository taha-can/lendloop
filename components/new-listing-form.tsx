"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ListingForm } from "@/components/listing-form";

export function NewListingForm() {
  const create = useMutation(api.tools.create);
  return (
    <ListingForm
      submitLabel="Put it on the board"
      onSubmit={(values) => create(values)}
    />
  );
}
