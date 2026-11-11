import { httpRouter } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { MAX_HTTP_BODY } from "./lib/constants";
import {
  PATHS,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  sealPayload,
  usableSecret,
  verifyRequest,
} from "./lib/hmac";

const http = httpRouter();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function tooLarge(request: Request, raw?: string) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_HTTP_BODY) return true;
  return raw !== undefined && raw.length > MAX_HTTP_BODY;
}

function rejected(error: unknown) {
  const data =
    typeof error === "object" && error !== null && "data" in error
      ? (error as { data: unknown }).data
      : undefined;
  const message =
    error instanceof ConvexError && typeof error.data === "string"
      ? error.data
      : typeof data === "string"
        ? data
        : null;
  if (!message) {
    console.error("Automation endpoint failed");
    return json({ error: "request failed" }, 500);
  }
  const status = message === "Loan not found." ? 404 : 400;
  return json({ error: message }, status);
}

async function signedResponse(
  method: string,
  path: string,
  payload: unknown,
  status = 200,
) {
  const secret = usableSecret(process.env.LENDLOOP_OUTBOUND_WEBHOOK_SECRET);
  if (!secret) {
    return json({ error: "webhook signing is not configured" }, 503);
  }
  const envelope = await sealPayload({ secret, method, path, payload });
  return json(envelope, status);
}

async function authorize(
  request: Request,
  method: "GET" | "POST",
  path: string,
  body: string,
) {
  const secret = usableSecret(process.env.LENDLOOP_INBOUND_WEBHOOK_SECRET);
  if (!secret) {
    return json({ error: "webhook signing is not configured" }, 503);
  }
  const verified = await verifyRequest({
    secret,
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature: request.headers.get(SIGNATURE_HEADER),
    method,
    path,
    body,
  });
  if (!verified.ok) {
    console.error(`Rejected ${method} ${path}: ${verified.reason}`);
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

http.route({
  path: PATHS.overdue,
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const denied = await authorize(request, "GET", PATHS.overdue, "");
    if (denied) return denied;
    const payload = await ctx.runQuery(internal.automation.listOverdue, {});
    return await signedResponse("GET", PATHS.overdue, payload);
  }),
});

http.route({
  path: PATHS.claim,
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (tooLarge(request)) return json({ error: "payload too large" }, 413);
    const raw = await request.text();
    if (tooLarge(request, raw)) return json({ error: "payload too large" }, 413);
    const denied = await authorize(request, "POST", PATHS.claim, raw);
    if (denied) return denied;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    if (!isRecord(parsed)) return json({ error: "invalid json" }, 400);
    const idempotencyKey = asString(parsed.idempotencyKey);
    if (!idempotencyKey) return json({ error: "idempotencyKey is required" }, 400);
    try {
      const result = await ctx.runMutation(internal.automation.claimOutbox, {
        idempotencyKey,
      });
      return await signedResponse("POST", PATHS.claim, result);
    } catch (error) {
      return rejected(error);
    }
  }),
});

http.route({
  path: PATHS.complete,
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (tooLarge(request)) return json({ error: "payload too large" }, 413);
    const raw = await request.text();
    if (tooLarge(request, raw)) return json({ error: "payload too large" }, 413);
    const denied = await authorize(request, "POST", PATHS.complete, raw);
    if (denied) return denied;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    if (!isRecord(parsed)) return json({ error: "invalid json" }, 400);
    const idempotencyKey = asString(parsed.idempotencyKey);
    if (!idempotencyKey) return json({ error: "idempotencyKey is required" }, 400);
    try {
      const result = await ctx.runMutation(internal.automation.completeOutbox, {
        idempotencyKey,
      });
      return await signedResponse("POST", PATHS.complete, result);
    } catch (error) {
      return rejected(error);
    }
  }),
});

http.route({
  path: PATHS.reminders,
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (tooLarge(request)) return json({ error: "payload too large" }, 413);
    const raw = await request.text();
    if (tooLarge(request, raw)) return json({ error: "payload too large" }, 413);
    const denied = await authorize(request, "POST", PATHS.reminders, raw);
    if (denied) return denied;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    if (!isRecord(parsed)) return json({ error: "invalid json" }, 400);
    const phase = parsed.phase;
    const idempotencyKey = asString(parsed.idempotencyKey);
    const loanId = asString(parsed.loanId);
    const reminderDate = asString(parsed.reminderDate);
    if (
      (phase !== "claim" && phase !== "complete" && phase !== "fail") ||
      !idempotencyKey ||
      !loanId ||
      !reminderDate
    ) {
      return json({ error: "reminder payload is incomplete" }, 400);
    }
    const message = asString(parsed.message) ?? undefined;
    try {
      const result = await ctx.runMutation(internal.automation.writeReminder, {
        phase,
        idempotencyKey,
        loanId,
        reminderDate,
        message,
      });
      return await signedResponse("POST", PATHS.reminders, result);
    } catch (error) {
      return rejected(error);
    }
  }),
});

http.route({
  path: PATHS.failure,
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (tooLarge(request)) return json({ error: "payload too large" }, 413);
    const raw = await request.text();
    if (tooLarge(request, raw)) return json({ error: "payload too large" }, 413);
    const denied = await authorize(request, "POST", PATHS.failure, raw);
    if (denied) return denied;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    if (!isRecord(parsed)) return json({ error: "invalid json" }, 400);
    const idempotencyKey = asString(parsed.idempotencyKey);
    const message = asString(parsed.message);
    if (!idempotencyKey || !message) {
      return json({ error: "failure payload is incomplete" }, 400);
    }
    try {
      const result = await ctx.runMutation(internal.automation.recordFailure, {
        idempotencyKey,
        message,
        loanId: asString(parsed.loanId) ?? undefined,
        outboxKey: asString(parsed.outboxKey) ?? undefined,
      });
      return await signedResponse("POST", PATHS.failure, result);
    } catch (error) {
      return rejected(error);
    }
  }),
});

export default http;
