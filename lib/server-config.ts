export function isClerkConfigured(): boolean {
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const secret = process.env.CLERK_SECRET_KEY ?? "";
  return (
    /^pk_(test|live)_/.test(publishable) &&
    !publishable.includes("placeholder") &&
    /^sk_(test|live)_/.test(secret) &&
    !secret.includes("placeholder")
  );
}
