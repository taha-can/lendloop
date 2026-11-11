import { describe, expect, it } from "vitest";
import {
  openEnvelope,
  sealPayload,
  signRequest,
  stableStringify,
  usableSecret,
  verifyRequest,
} from "../convex/lib/hmac";

const secret = "outbound-secret-value";
const other = "inbound-secret-value";
const now = 1_700_000_000_000;

describe("canonical json", () => {
  it("sorts keys and ignores insertion order", () => {
    expect(stableStringify({ b: 1, a: { d: true, c: "ok" } })).toBe(
      stableStringify({ a: { c: "ok", d: true }, b: 1 }),
    );
  });
});

describe("request signatures", () => {
  it("accepts a signature it just created", async () => {
    const body = stableStringify({ hello: "neighbor" });
    const signature = await signRequest({
      secret,
      timestamp: String(now),
      method: "post",
      path: "/overdue",
      body,
    });
    const result = await verifyRequest({
      secret,
      timestamp: String(now),
      signature,
      method: "POST",
      path: "/overdue",
      body,
      now,
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a different secret, path, body, or clock", async () => {
    const body = stableStringify({ loanId: "abc" });
    const signature = await signRequest({
      secret,
      timestamp: String(now),
      method: "POST",
      path: "/reminders",
      body,
    });
    expect(
      await verifyRequest({
        secret: other,
        timestamp: String(now),
        signature,
        method: "POST",
        path: "/reminders",
        body,
        now,
      }),
    ).toEqual({ ok: false, reason: "mismatch" });
    expect(
      await verifyRequest({
        secret,
        timestamp: String(now),
        signature,
        method: "POST",
        path: "/overdue",
        body,
        now,
      }),
    ).toEqual({ ok: false, reason: "mismatch" });
    expect(
      await verifyRequest({
        secret,
        timestamp: String(now),
        signature,
        method: "POST",
        path: "/reminders",
        body: stableStringify({ loanId: "changed" }),
        now,
      }),
    ).toEqual({ ok: false, reason: "mismatch" });
    expect(
      await verifyRequest({
        secret,
        timestamp: String(now - 10 * 60 * 1000),
        signature,
        method: "POST",
        path: "/reminders",
        body,
        now,
      }),
    ).toEqual({ ok: false, reason: "stale" });
  });

  it("rejects missing and malformed signatures without throwing", async () => {
    expect(
      await verifyRequest({
        secret,
        timestamp: null,
        signature: null,
        method: "GET",
        path: "/overdue",
        body: "",
        now,
      }),
    ).toEqual({ ok: false, reason: "missing" });
    expect(
      await verifyRequest({
        secret,
        timestamp: "nope",
        signature: "v1=abc",
        method: "GET",
        path: "/overdue",
        body: "",
        now,
      }),
    ).toEqual({ ok: false, reason: "malformed" });
    expect(
      await verifyRequest({
        secret,
        timestamp: String(now),
        signature: "v0=abcd",
        method: "GET",
        path: "/overdue",
        body: "",
        now,
      }),
    ).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("response envelopes", () => {
  it("round-trips a payload and rejects a swapped signature", async () => {
    const envelope = await sealPayload({
      secret,
      method: "GET",
      path: "/overdue",
      payload: { asOf: "2026-11-11", loans: [] },
      now,
    });
    expect(
      await openEnvelope({
        secret,
        method: "GET",
        path: "/overdue",
        envelope,
        now,
      }),
    ).toEqual({ ok: true, payload: envelope.payload });
    expect(
      await openEnvelope({
        secret: other,
        method: "GET",
        path: "/overdue",
        envelope,
        now,
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("secret shape", () => {
  it("refuses short secrets", () => {
    expect(usableSecret(undefined)).toBeNull();
    expect(usableSecret("short")).toBeNull();
    expect(usableSecret("long-enough-secret")).toBe("long-enough-secret");
  });
});
