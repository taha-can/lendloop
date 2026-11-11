import { MIN_SECRET_LENGTH } from "./constants";

const encoder = new TextEncoder();

export const SIGNATURE_PREFIX = "v1=";
export const MAX_SKEW_MS = 5 * 60 * 1000;
export const TIMESTAMP_HEADER = "x-lendloop-timestamp";
export const SIGNATURE_HEADER = "x-lendloop-signature";

export const PATHS = {
  overdue: "/overdue",
  reminders: "/reminders",
  claim: "/automation/claim",
  complete: "/automation/complete",
  failure: "/automation/failure",
} as const;

export function usableSecret(secret: string | undefined): string | null {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return secret;
}

export function stableStringify(value: unknown): string {
  if (value === undefined) {
    throw new Error("Cannot encode undefined");
  }
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) {
      throw new Error("Cannot encode value");
    }
    return encoded;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toHex(digest);
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return toHex(signature);
}

export async function signRequest(args: {
  secret: string;
  timestamp: string;
  method: string;
  path: string;
  body: string;
}): Promise<string> {
  const bodyHash = await sha256Hex(args.body);
  const canonical = `${args.timestamp}.${args.method.toUpperCase()}.${args.path}.${bodyHash}`;
  const mac = await hmacHex(args.secret, canonical);
  return `${SIGNATURE_PREFIX}${mac}`;
}

function timingSafeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length, 1);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return mismatch === 0;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "stale" | "mismatch" | "malformed" };

export async function verifyRequest(args: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  method: string;
  path: string;
  body: string;
  now?: number;
}): Promise<VerifyResult> {
  if (!args.secret || !args.timestamp || !args.signature) {
    return { ok: false, reason: "missing" };
  }
  if (!/^\d{10,16}$/.test(args.timestamp)) {
    return { ok: false, reason: "malformed" };
  }
  if (
    !args.signature.startsWith(SIGNATURE_PREFIX) ||
    args.signature.length > 80
  ) {
    return { ok: false, reason: "malformed" };
  }
  const now = args.now ?? Date.now();
  const timestamp = Number(args.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > MAX_SKEW_MS) {
    return { ok: false, reason: "stale" };
  }
  const expected = await signRequest({
    secret: args.secret,
    timestamp: args.timestamp,
    method: args.method,
    path: args.path,
    body: args.body,
  });
  if (!timingSafeEqual(expected, args.signature)) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true };
}

export type Envelope = {
  timestamp: string;
  signature: string;
  payload: unknown;
};

export async function sealPayload(args: {
  secret: string;
  method: string;
  path: string;
  payload: unknown;
  now?: number;
}): Promise<Envelope> {
  const timestamp = String(args.now ?? Date.now());
  const body = stableStringify(args.payload);
  const signature = await signRequest({
    secret: args.secret,
    timestamp,
    method: args.method,
    path: args.path,
    body,
  });
  return { timestamp, signature, payload: args.payload };
}

export async function openEnvelope(args: {
  secret: string;
  method: string;
  path: string;
  envelope: { timestamp?: unknown; signature?: unknown; payload?: unknown };
  now?: number;
}): Promise<{ ok: true; payload: unknown } | VerifyResult> {
  if (
    typeof args.envelope.timestamp !== "string" ||
    typeof args.envelope.signature !== "string"
  ) {
    return { ok: false, reason: "malformed" };
  }
  const result = await verifyRequest({
    secret: args.secret,
    timestamp: args.envelope.timestamp,
    signature: args.envelope.signature,
    method: args.method,
    path: args.path,
    body: stableStringify(args.envelope.payload ?? null),
    now: args.now,
  });
  if (!result.ok) return result;
  return { ok: true, payload: args.envelope.payload };
}
