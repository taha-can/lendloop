export function readableError(error: unknown): string {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data: unknown }).data;
    if (typeof data === "string" && data.length > 0 && data.length < 240) {
      return data;
    }
  }
  return "Something went wrong. Try again in a moment.";
}
