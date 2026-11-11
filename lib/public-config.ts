export function convexUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (!parsed.hostname.endsWith(".convex.cloud")) return null;
    if (parsed.hostname.includes("placeholder")) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isConvexConfigured(): boolean {
  return convexUrl() !== null;
}
