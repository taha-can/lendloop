function stableStringify(value) {
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
  const keys = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function sha256Hex(value) {
  return require("crypto").createHash("sha256").update(value, "utf8").digest("hex");
}

function signRequest({ secret, timestamp, method, path, body }) {
  const canonical = `${timestamp}.${method.toUpperCase()}.${path}.${sha256Hex(body)}`;
  const mac = require("crypto")
    .createHmac("sha256", secret)
    .update(canonical, "utf8")
    .digest("hex");
  return `v1=${mac}`;
}

function timingSafeEqual(left, right) {
  const crypto = require("crypto");
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyRequest({ secret, timestamp, signature, method, path, body, now }) {
  if (!secret || !timestamp || !signature) return { ok: false, reason: "missing" };
  if (!/^\d{10,16}$/.test(String(timestamp))) {
    return { ok: false, reason: "malformed" };
  }
  if (!String(signature).startsWith("v1=")) {
    return { ok: false, reason: "malformed" };
  }
  const current = typeof now === "number" ? now : Date.now();
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed) || Math.abs(current - parsed) > 5 * 60 * 1000) {
    return { ok: false, reason: "stale" };
  }
  const expected = signRequest({
    secret,
    timestamp: String(timestamp),
    method,
    path,
    body,
  });
  if (!timingSafeEqual(expected, String(signature))) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true };
}

function verifyEnvelope({ secret, method, path, envelope, now }) {
  if (
    !envelope ||
    typeof envelope.timestamp !== "string" ||
    typeof envelope.signature !== "string"
  ) {
    return { ok: false, reason: "malformed" };
  }
  const result = verifyRequest({
    secret,
    timestamp: envelope.timestamp,
    signature: envelope.signature,
    method,
    path,
    body: stableStringify(envelope.payload ?? null),
    now,
  });
  if (!result.ok) return result;
  return { ok: true, payload: envelope.payload };
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  const target = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() !== target) continue;
    const value = headers[key];
    return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
  }
  return "";
}

function requireSecret(name) {
  const secret = $env[name];
  if (!secret || String(secret).length < 16) {
    throw new Error(`${name} is not set on the n8n instance.`);
  }
  return String(secret);
}
