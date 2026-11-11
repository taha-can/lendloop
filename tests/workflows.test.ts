import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { signRequest, stableStringify } from "../convex/lib/hmac";
import { buildWorkflows } from "../scripts/build-n8n-workflows.mjs";

const root = path.resolve(import.meta.dirname, "..");
const workflowDir = path.join(root, "n8n/workflows");

function workflowSource() {
  return JSON.stringify(buildWorkflows());
}

describe("n8n exports", () => {
  const built = buildWorkflows();

  it("matches the files checked into the repo", () => {
    for (const [filename, value] of Object.entries(built)) {
      const saved = readFileSync(path.join(workflowDir, filename), "utf8");
      expect(saved).toBe(`${JSON.stringify(value, null, 2)}\n`);
    }
  });

  it("keeps secrets out of the export", () => {
    const source = workflowSource();
    expect(source).not.toMatch(/sk_(live|test)_/);
    expect(source).not.toMatch(/pk_(live|test)_/);
    expect(source).not.toMatch(/whsec_/);
    expect(source).not.toMatch(/BEGIN [A-Z ]*PRIVATE KEY/);
    expect(source).toContain("$env[name]");
    expect(source).toContain("LENDLOOP_OUTBOUND_WEBHOOK_SECRET");
    expect(source).toContain("LENDLOOP_INBOUND_WEBHOOK_SECRET");
    expect(source).toContain("$env.CONVEX_SITE_URL");
    expect(source).toContain("$env.NOTIFICATION_WEBHOOK_URL");
    expect(source).not.toMatch(/LENDLOOP_[A-Z_]*SECRET"\s*:\s*"[^$]/);
  });

  it("retries Convex calls and has a visible error workflow", () => {
    const request = built["request-notification.json"];
    const reminders = built["overdue-reminders.json"];
    const errors = built["error-handler.json"];
    const httpNodes = [...request.nodes, ...reminders.nodes, ...errors.nodes].filter(
      (entry: { type: string }) => entry.type === "n8n-nodes-base.httpRequest",
    );
    expect(httpNodes.length).toBeGreaterThan(0);
    expect(
      httpNodes.every(
        (entry: { retryOnFail?: boolean }) => entry.retryOnFail === true,
      ),
    ).toBe(true);
    expect(
      httpNodes.every((entry: { maxTries?: number }) => (entry.maxTries ?? 0) >= 3),
    ).toBe(true);
    expect(errors.name).toBe("LendLoop error handler");
    expect(JSON.stringify(request)).toContain("LendLoop error handler");
    expect(JSON.stringify(reminders)).toContain("LendLoop error handler");
    expect(JSON.stringify(errors.nodes)).not.toContain("error.stack");
  });

  it("calls the Convex paths and does not put email addresses in the message text", () => {
    const source = workflowSource();
    for (const pathname of [
      "/overdue",
      "/reminders",
      "/automation/claim",
      "/automation/complete",
      "/automation/failure",
      "/webhook/lendloop-request",
    ]) {
      expect(source).toContain(pathname);
    }
    const compose = built["request-notification.json"].nodes.find(
      (entry: { name: string }) => entry.name === "Compose notice",
    ) as { parameters: { jsCode: string } };
    const reminder = built["overdue-reminders.json"].nodes.find(
      (entry: { name: string }) => entry.name === "Compose reminder",
    ) as { parameters: { jsCode: string } };
    expect(compose.parameters.jsCode).not.toContain("email");
    expect(reminder.parameters.jsCode).not.toContain("email");
    expect(reminder.parameters.jsCode).toContain("was due back on");
  });
});

describe("workflow hmac matches the app", () => {
  it("signs the same canonical string", async () => {
    const snippet = readFileSync(path.join(root, "n8n/hmac-snippet.js"), "utf8");
    const context = {
      require: (id: string) => {
        if (id !== "crypto") throw new Error(id);
        return crypto;
      },
      Buffer,
      Date,
      JSON,
      Object,
      String,
      Number,
      Error,
      Array,
    };
    vm.createContext(context);
    vm.runInContext(snippet, context);
    const sandbox = context as unknown as {
      signRequest: (args: {
        secret: string;
        timestamp: string;
        method: string;
        path: string;
        body: string;
      }) => string;
      stableStringify: (value: unknown) => string;
    };
    const body = sandbox.stableStringify({ b: 1, a: "saw" });
    expect(body).toBe(stableStringify({ a: "saw", b: 1 }));
    const args = {
      secret: "shared-test-secret",
      timestamp: "1700000000000",
      method: "POST",
      path: "/reminders",
      body,
    };
    expect(sandbox.signRequest(args)).toBe(await signRequest(args));
  });
});
