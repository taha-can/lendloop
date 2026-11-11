"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CONDITION_LABELS,
  CONDITIONS,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  NAME_MAX,
  NAME_MIN,
  type Category,
  type Condition,
} from "@/convex/lib/constants";
import { cleanLine, cleanMultiline } from "@/convex/lib/text";
import { useAction } from "@/components/use-action";

type Values = {
  name: string;
  category: Category;
  condition: Condition;
  description: string;
};

export function ListingForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Values;
  submitLabel: string;
  onSubmit: (values: Values) => Promise<unknown>;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<Category>(
    initial?.category ?? "garden",
  );
  const [condition, setCondition] = useState<Condition>(
    initial?.condition ?? "good",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const cleanName = cleanLine(name, NAME_MIN, NAME_MAX);
    const cleanDescription = cleanMultiline(
      description,
      DESCRIPTION_MIN,
      DESCRIPTION_MAX,
    );
    if (!cleanName) {
      setFormError(
        `Give the tool a name between ${NAME_MIN} and ${NAME_MAX} characters.`,
      );
      return;
    }
    if (!cleanDescription) {
      setFormError(
        `Add a short description between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters.`,
      );
      return;
    }
    setFormError(null);
    const ok = await run(
      "save",
      () =>
        onSubmit({
          name: cleanName,
          category,
          condition,
          description: cleanDescription,
        }),
      initial ? "Listing updated." : "Listing is on the board.",
    );
    if (ok && !initial) router.push("/board/mine");
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-xl gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="tool-name">Name</Label>
        <Input
          id="tool-name"
          value={name}
          maxLength={NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          placeholder="Hedge trimmer"
          required
          className="h-10"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="tool-category">Category</Label>
          <Select
            value={category}
            items={CATEGORY_LABELS}
            onValueChange={(value) => {
              if (value) setCategory(value as Category);
            }}
          >
            <SelectTrigger id="tool-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {CATEGORY_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tool-condition">Condition</Label>
          <Select
            value={condition}
            items={CONDITION_LABELS}
            onValueChange={(value) => {
              if (value) setCondition(value as Condition);
            }}
          >
            <SelectTrigger id="tool-condition" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {CONDITION_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tool-description">Short description</Label>
        <Textarea
          id="tool-description"
          value={description}
          maxLength={DESCRIPTION_MAX}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Corded, 18 inch blade. Lives in the shed. Please return it clean."
          rows={4}
          required
        />
      </div>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-10 w-fit px-4" disabled={pending !== null}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
