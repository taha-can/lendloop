"use client";

import { useState } from "react";
import { toast } from "sonner";
import { readableError } from "@/lib/errors";

export function useAction() {
  const [pending, setPending] = useState<string | null>(null);

  async function run(
    key: string,
    action: () => Promise<unknown>,
    success?: string,
  ) {
    setPending(key);
    try {
      await action();
      if (success) toast.success(success);
      return true;
    } catch (error) {
      toast.error(readableError(error));
      return false;
    } finally {
      setPending(null);
    }
  }

  return { pending, run };
}
