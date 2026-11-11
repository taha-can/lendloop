const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

export function cleanLine(
  value: string,
  min: number,
  max: number,
): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < min || trimmed.length > max) return null;
  if (CONTROL.test(trimmed)) return null;
  return trimmed;
}

export function cleanMultiline(
  value: string,
  min: number,
  max: number,
): string | null {
  const trimmed = value.replace(/\r\n/g, "\n").trim();
  if (trimmed.length < min || trimmed.length > max) return null;
  if (CONTROL.test(trimmed)) return null;
  return trimmed;
}

export function publicErrorMessage(input: string): string {
  const cleaned = input.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  const redacted = cleaned.replace(/v1=[a-f0-9]{16,}/gi, "v1=[redacted]");
  return redacted.slice(0, 300);
}
