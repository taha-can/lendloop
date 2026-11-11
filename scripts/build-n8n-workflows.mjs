import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snippet = readFileSync(path.join(root, "n8n/hmac-snippet.js"), "utf8");

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function node(name, type, typeVersion, parameters, position, extra = {}) {
  return {
    id: slug(name),
    name,
    type,
    typeVersion,
    position,
    parameters,
    ...extra,
  };
}

function code(name, js, position, mode = "runOnceForAllItems") {
  return node(
    name,
    "n8n-nodes-base.code",
    2,
    { mode, language: "javaScript", jsCode: `${snippet}\n${js}` },
    position,
  );
}

function plainCode(name, js, position) {
  return node(
    name,
    "n8n-nodes-base.code",
    2,
    { mode: "runOnceForAllItems", language: "javaScript", jsCode: js },
    position,
  );
}

function httpRequest({
  name,
  method,
  url,
  position,
  body,
  onError,
  signed = true,
}) {
  const headers = [{ name: "Content-Type", value: "application/json" }];
  if (signed) {
    headers.push(
      { name: "X-LendLoop-Timestamp", value: "={{ $json.timestamp }}" },
      { name: "X-LendLoop-Signature", value: "={{ $json.signature }}" },
    );
  }
  const parameters = {
    method,
    url,
    sendHeaders: true,
    headerParameters: { parameters: headers },
    options: { timeout: 15000 },
  };
  if (method !== "GET") {
    parameters.sendBody = true;
    parameters.contentType = "raw";
    parameters.rawContentType = "application/json";
    parameters.body = body ?? "={{ $json.body }}";
  }
  return node(name, "n8n-nodes-base.httpRequest", 4.2, parameters, position, {
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    ...(onError ? { onError } : {}),
  });
}

function ifNode(name, expression, position) {
  return node(
    name,
    "n8n-nodes-base.if",
    2.2,
    {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: "",
          typeValidation: "strict",
          version: 2,
        },
        conditions: [
          {
            id: slug(name),
            leftValue: expression,
            rightValue: "",
            operator: {
              type: "boolean",
              operation: "true",
              singleValue: true,
            },
          },
        ],
        combinator: "and",
      },
    },
    position,
  );
}

function sticky(name, content, position) {
  return node(
    name,
    "n8n-nodes-base.stickyNote",
    1,
    { content, height: 260, width: 420, color: 4 },
    position,
  );
}

function workflow(name, nodes, connections, extraSettings = {}) {
  return {
    name,
    nodes,
    connections,
    pinData: {},
    active: false,
    settings: {
      executionOrder: "v1",
      timezone: "UTC",
      ...extraSettings,
    },
    meta: {
      templateCredsSetupCompleted: false,
    },
  };
}

function connect(links) {
  const connections = {};
  for (const [from, to, output = 0] of links) {
    connections[from] ??= { main: [] };
    while (connections[from].main.length <= output) connections[from].main.push([]);
    connections[from].main[output].push({ node: to, type: "main", index: 0 });
  }
  return connections;
}

function convexUrl(pathname) {
  return `={{ $env.CONVEX_SITE_URL.replace(/\\/$/, '') + '${pathname}' }}`;
}

function requestNotification() {
  const nodes = [
    sticky(
      "Setup",
      "## Request notification\n\nConvex signs this webhook with `LENDLOOP_OUTBOUND_WEBHOOK_SECRET`.\nThis workflow signs callbacks with `LENDLOOP_INBOUND_WEBHOOK_SECRET`.\n\nBoth values live in the n8n environment, not in this file.\n\nAfter import, set the error workflow to **LendLoop error handler**, then publish. Copy the production URL (`/webhook/lendloop-request`) into the Convex env var `N8N_WEBHOOK_URL`.\n\nOptional: set `NOTIFICATION_WEBHOOK_URL` to a Slack-compatible incoming webhook. The posted body is only `{ text }`.",
      [-20, 40],
    ),
    node(
      "Request webhook",
      "n8n-nodes-base.webhook",
      2,
      {
        httpMethod: "POST",
        path: "lendloop-request",
        responseMode: "onReceived",
        options: {},
      },
      [460, 300],
      { webhookId: "lendloop-request" },
    ),
    code(
      "Verify signature",
      `
const item = $input.first().json;
const payload = item.body && item.headers ? item.body : item;
const headers = item.headers || {};
const secret = requireSecret("LENDLOOP_OUTBOUND_WEBHOOK_SECRET");
const result = verifyRequest({
  secret,
  timestamp: headerValue(headers, "x-lendloop-timestamp"),
  signature: headerValue(headers, "x-lendloop-signature"),
  method: "POST",
  path: "/webhook/lendloop-request",
  body: stableStringify(payload),
});
return [{ json: { signatureValid: result.ok === true, reason: result.ok ? "" : result.reason, payload } }];
`,
      [700, 300],
    ),
    ifNode("Signature valid", "={{ $json.signatureValid === true }}", [940, 300]),
    plainCode(
      "Rejected unsigned request",
      "return [{ json: { rejected: true, reason: $json.reason || 'signature rejected' } }];",
      [1180, 480],
    ),
    code(
      "Sign claim",
      `
const payload = $input.first().json.payload;
const secret = requireSecret("LENDLOOP_INBOUND_WEBHOOK_SECRET");
const body = stableStringify({ idempotencyKey: payload.idempotencyKey });
const timestamp = String(Date.now());
const requestPath = "/automation/claim";
return [{
  json: {
    payload,
    body,
    timestamp,
    signature: signRequest({ secret, timestamp, method: "POST", path: requestPath, body }),
  },
}];
`,
      [1180, 220],
    ),
    httpRequest({
      name: "Claim notification",
      method: "POST",
      url: convexUrl("/automation/claim"),
      position: [1420, 220],
    }),
    code(
      "Read claim",
      `
const opened = verifyEnvelope({
  secret: requireSecret("LENDLOOP_OUTBOUND_WEBHOOK_SECRET"),
  method: "POST",
  path: "/automation/claim",
  envelope: $input.first().json,
});
if (!opened.ok) {
  throw new Error("Convex claim response failed signature verification.");
}
return [{
  json: {
    send: opened.payload && opened.payload.send === true,
    payload: $("Sign claim").first().json.payload,
  },
}];
`,
      [1660, 220],
    ),
    ifNode("Should send", "={{ $json.send === true }}", [1900, 220]),
    plainCode(
      "Already delivered",
      "return [{ json: { skipped: true } }];",
      [2140, 400],
    ),
    plainCode(
      "Compose notice",
      `
const payload = $input.first().json.payload;
const who = payload.recipient.name;
const other = payload.counterpartyName;
const tool = payload.toolName;
const range = payload.startDate + " to " + payload.endDate;
let text = who + ", the request for " + tool + " (" + range + ") was updated.";
if (payload.status === "pending") text = who + ", " + other + " asked to borrow " + tool + " from " + range + ".";
if (payload.status === "approved") text = who + ", " + other + " approved your request for " + tool + " (" + range + ").";
if (payload.status === "declined") text = who + ", " + other + " declined your request for " + tool + " (" + range + ").";
if (payload.status === "cancelled") text = who + ", the request for " + tool + " (" + range + ") was cancelled.";
if (payload.status === "returned") text = who + ", " + other + " marked " + tool + " as returned.";
return [{ json: { text, idempotencyKey: payload.idempotencyKey } }];
`,
      [2140, 120],
    ),
    ifNode(
      "Channel configured",
      "={{ Boolean($env.NOTIFICATION_WEBHOOK_URL) }}",
      [2380, 120],
    ),
    httpRequest({
      name: "Send notification",
      method: "POST",
      url: "={{ $env.NOTIFICATION_WEBHOOK_URL }}",
      position: [2620, 40],
      body: "={{ JSON.stringify({ text: $json.text }) }}",
      onError: "continueErrorOutput",
      signed: false,
    }),
    code(
      "Sign complete",
      `
const source = $("Compose notice").first().json;
const secret = requireSecret("LENDLOOP_INBOUND_WEBHOOK_SECRET");
const body = stableStringify({ idempotencyKey: source.idempotencyKey });
const timestamp = String(Date.now());
const requestPath = "/automation/complete";
return [{
  json: {
    body,
    timestamp,
    signature: signRequest({ secret, timestamp, method: "POST", path: requestPath, body }),
  },
}];
`,
      [2860, 160],
    ),
    httpRequest({
      name: "Complete notification",
      method: "POST",
      url: convexUrl("/automation/complete"),
      position: [3100, 160],
    }),
    code(
      "Sign failure",
      `
const source = $("Compose notice").first().json;
const secret = requireSecret("LENDLOOP_INBOUND_WEBHOOK_SECRET");
const body = stableStringify({
  idempotencyKey: "event:" + source.idempotencyKey + ":failed",
  outboxKey: source.idempotencyKey,
  message: "Notification delivery failed",
});
const timestamp = String(Date.now());
const requestPath = "/automation/failure";
return [{
  json: {
    body,
    timestamp,
    signature: signRequest({ secret, timestamp, method: "POST", path: requestPath, body }),
  },
}];
`,
      [2860, 20],
    ),
    httpRequest({
      name: "Report failure",
      method: "POST",
      url: convexUrl("/automation/failure"),
      position: [3100, 20],
    }),
  ];

  const connections = connect([
    ["Request webhook", "Verify signature"],
    ["Verify signature", "Signature valid"],
    ["Signature valid", "Sign claim", 0],
    ["Signature valid", "Rejected unsigned request", 1],
    ["Sign claim", "Claim notification"],
    ["Claim notification", "Read claim"],
    ["Read claim", "Should send"],
    ["Should send", "Compose notice", 0],
    ["Should send", "Already delivered", 1],
    ["Compose notice", "Channel configured"],
    ["Channel configured", "Send notification", 0],
    ["Channel configured", "Sign complete", 1],
    ["Send notification", "Sign complete", 0],
    ["Send notification", "Sign failure", 1],
    ["Sign complete", "Complete notification"],
    ["Sign failure", "Report failure"],
  ]);

  return workflow("LendLoop request notification", nodes, connections);
}

function overdueReminders() {
  const nodes = [
    sticky(
      "Setup",
      "## Overdue reminders\n\nRuns every day at 08:00 UTC. It asks Convex for loans whose return date has passed and that have not already been reminded today.\n\nClaiming a reminder is idempotent. A retry will not send a second message for the same loan and day unless the earlier claim is at least 10 minutes old and was not completed.\n\nSet the error workflow to **LendLoop error handler** before publishing.",
      [-20, 40],
    ),
    node(
      "Daily 08:00 UTC",
      "n8n-nodes-base.scheduleTrigger",
      1.2,
      { rule: { interval: [{ field: "cronExpression", expression: "0 8 * * *" }] } },
      [460, 300],
    ),
    code(
      "Sign overdue request",
      `
const secret = requireSecret("LENDLOOP_INBOUND_WEBHOOK_SECRET");
const timestamp = String(Date.now());
const requestPath = "/overdue";
return [{
  json: {
    timestamp,
    signature: signRequest({ secret, timestamp, method: "GET", path: requestPath, body: "" }),
  },
}];
`,
      [700, 300],
    ),
    httpRequest({
      name: "Fetch overdue loans",
      method: "GET",
      url: convexUrl("/overdue"),
      position: [940, 300],
    }),
    code(
      "Expand loans",
      `
const opened = verifyEnvelope({
  secret: requireSecret("LENDLOOP_OUTBOUND_WEBHOOK_SECRET"),
  method: "GET",
  path: "/overdue",
  envelope: $input.first().json,
});
if (!opened.ok) {
  throw new Error("Overdue response failed signature verification.");
}
const loans = opened.payload && Array.isArray(opened.payload.loans) ? opened.payload.loans : [];
if (loans.length === 0) return [{ json: { empty: true } }];
return loans.map((loan) => ({
  json: {
    empty: false,
    asOf: opened.payload.asOf,
    loan: {
      loanId: loan.loanId,
      idempotencyKey: loan.idempotencyKey,
      toolName: loan.toolName,
      dueDate: loan.dueDate,
      borrowerName: loan.borrowerName,
    },
  },
}));
`,
      [1180, 300],
    ),
    ifNode("Has loans", "={{ $json.empty !== true }}", [1420, 300]),
    plainCode(
      "No loans today",
      "return [{ json: { done: true, reminded: 0 } }];",
      [1660, 460],
    ),
    code(
      "Sign reminder claim",
      `
const secret = requireSecret("LENDLOOP_INBOUND_WEBHOOK_SECRET");
return $input.all().filter((item) => item.json.empty !== true).map((item) => {
  const body = stableStringify({
    phase: "claim",
    idempotencyKey: item.json.loan.idempotencyKey,
    loanId: item.json.loan.loanId,
    reminderDate: item.json.asOf,
  });
  const timestamp = String(Date.now());
  const requestPath = "/reminders";
  return {
    json: {
      loan: item.json.loan,
      asOf: item.json.asOf,
      body,
      timestamp,
      signature: signRequest({ secret, timestamp, method: "POST", path: requestPath, body }),
    },
  };
});
`,
      [1660, 220],
    ),
    httpRequest({
      name: "Claim reminder",
      method: "POST",
      url: convexUrl("/reminders"),
      position: [1900, 220],
    }),
    code(
      "Read reminder claim",
      `
const prior = $("Sign reminder claim").all();
return $input.all().map((item, index) => {
  const opened = verifyEnvelope({
    secret: requireSecret("LENDLOOP_OUTBOUND_WEBHOOK_SECRET"),
    method: "POST",
    path: "/reminders",
    envelope: item.json,
  });
  if (!opened.ok) {
    throw new Error("Reminder claim response failed signature verification.");
  }
  const source = prior[index] ? prior[index].json : {};
  return {
    json: {
      send: opened.payload && opened.payload.send === true,
      loan: source.loan,
      asOf: source.asOf,
    },
  };
});
`,
      [2140, 220],
    ),
    ifNode("Should remind", "={{ $json.send === true }}", [2380, 220]),
    plainCode(
      "Compose reminder",
      `
return $input.all().filter((item) => item.json.send === true).map((item) => {
  const loan = item.json.loan;
  const text = loan.borrowerName + ", " + loan.toolName + " was due back on " + loan.dueDate + ". Please return it or message the owner.";
  return { json: { text, loan, asOf: item.json.asOf } };
});
`,
      [2620, 140],
    ),
    ifNode(
      "Channel configured",
      "={{ Boolean($env.NOTIFICATION_WEBHOOK_URL) }}",
      [2860, 140],
    ),
    httpRequest({
      name: "Send reminder",
      method: "POST",
      url: "={{ $env.NOTIFICATION_WEBHOOK_URL }}",
      position: [3100, 40],
      body: "={{ JSON.stringify({ text: $json.text }) }}",
      onError: "continueErrorOutput",
      signed: false,
    }),
    code(
      "Sign reminder complete",
      `
const source = $("Compose reminder").item.json;
const secret = requireSecret("LENDLOOP_INBOUND_WEBHOOK_SECRET");
const body = stableStringify({
  phase: "complete",
  idempotencyKey: source.loan.idempotencyKey,
  loanId: source.loan.loanId,
  reminderDate: source.asOf,
});
const timestamp = String(Date.now());
const requestPath = "/reminders";
return {
  json: {
    body,
    timestamp,
    signature: signRequest({ secret, timestamp, method: "POST", path: requestPath, body }),
  },
};
`,
      [3340, 180],
      "runOnceForEachItem",
    ),
    httpRequest({
      name: "Complete reminder",
      method: "POST",
      url: convexUrl("/reminders"),
      position: [3580, 180],
    }),
    code(
      "Sign reminder failure",
      `
const source = $("Compose reminder").item.json;
const secret = requireSecret("LENDLOOP_INBOUND_WEBHOOK_SECRET");
const body = stableStringify({
  phase: "fail",
  idempotencyKey: source.loan.idempotencyKey,
  loanId: source.loan.loanId,
  reminderDate: source.asOf,
  message: "Reminder delivery failed",
});
const timestamp = String(Date.now());
const requestPath = "/reminders";
return {
  json: {
    body,
    timestamp,
    signature: signRequest({ secret, timestamp, method: "POST", path: requestPath, body }),
  },
};
`,
      [3340, 40],
      "runOnceForEachItem",
    ),
    httpRequest({
      name: "Record reminder failure",
      method: "POST",
      url: convexUrl("/reminders"),
      position: [3580, 40],
    }),
  ];

  return workflow(
    "LendLoop overdue reminders",
    nodes,
    connect([
      ["Daily 08:00 UTC", "Sign overdue request"],
      ["Sign overdue request", "Fetch overdue loans"],
      ["Fetch overdue loans", "Expand loans"],
      ["Expand loans", "Has loans"],
      ["Has loans", "Sign reminder claim", 0],
      ["Has loans", "No loans today", 1],
      ["Sign reminder claim", "Claim reminder"],
      ["Claim reminder", "Read reminder claim"],
      ["Read reminder claim", "Should remind"],
      ["Should remind", "Compose reminder", 0],
      ["Compose reminder", "Channel configured"],
      ["Channel configured", "Send reminder", 0],
      ["Channel configured", "Sign reminder complete", 1],
      ["Send reminder", "Sign reminder complete", 0],
      ["Send reminder", "Sign reminder failure", 1],
      ["Sign reminder complete", "Complete reminder"],
      ["Sign reminder failure", "Record reminder failure"],
    ]),
  );
}

function errorHandler() {
  const nodes = [
    sticky(
      "Setup",
      "## Error handler\n\nAttach this workflow as the error workflow on the request and reminder workflows.\n\nIt writes one failure record per n8n execution id. Retries of this call do not create another row.\n\nThe message stored is the workflow name plus the error message, trimmed. Stack traces are not sent.",
      [-20, 40],
    ),
    node("Error trigger", "n8n-nodes-base.errorTrigger", 1, {}, [460, 300]),
    code(
      "Sign failure report",
      `
const execution = $json.execution || {};
const workflowName = ($json.workflow && $json.workflow.name) || "n8n";
const message = String((execution.error && execution.error.message) || "Workflow failed").slice(0, 240);
const executionId = String(execution.id || "unknown");
const secret = requireSecret("LENDLOOP_INBOUND_WEBHOOK_SECRET");
const body = stableStringify({
  idempotencyKey: "n8n-error:" + executionId,
  message: workflowName + ": " + message,
});
const timestamp = String(Date.now());
const requestPath = "/automation/failure";
return [{
  json: {
    body,
    timestamp,
    signature: signRequest({ secret, timestamp, method: "POST", path: requestPath, body }),
  },
}];
`,
      [700, 300],
    ),
    httpRequest({
      name: "Report workflow failure",
      method: "POST",
      url: convexUrl("/automation/failure"),
      position: [980, 300],
    }),
  ];
  return workflow(
    "LendLoop error handler",
    nodes,
    connect([
      ["Error trigger", "Sign failure report"],
      ["Sign failure report", "Report workflow failure"],
    ]),
  );
}

export function buildWorkflows() {
  return {
    "request-notification.json": requestNotification(),
    "overdue-reminders.json": overdueReminders(),
    "error-handler.json": errorHandler(),
  };
}

function writeWorkflows() {
  const directory = path.join(root, "n8n/workflows");
  mkdirSync(directory, { recursive: true });
  const workflows = buildWorkflows();
  for (const [filename, value] of Object.entries(workflows)) {
    writeFileSync(
      path.join(directory, filename),
      `${JSON.stringify(value, null, 2)}\n`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeWorkflows();
}
