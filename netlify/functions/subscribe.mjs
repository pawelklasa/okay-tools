// Netlify Function — POST /.netlify/functions/subscribe
// Body: { "email": "you@example.com", "source"?: string }
//
// Subscribes an email to Buttondown via the authenticated REST API.
// We force `type: "regular"` so subscribers land confirmed (no double opt-in)
// and we bypass the embed form's captcha requirement.
//
// Requires env var: BUTTONDOWN_API_KEY  (Settings → API → API Key in Buttondown).

const BUTTONDOWN_URL = "https://api.buttondown.com/v1/subscribers";

// Light in-memory rate limit (best-effort; warm containers only).
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map(); // ip -> number[] of timestamps

function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_LIMIT_MAX;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const apiKey = process.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    return json(500, { error: "server_misconfigured" });
  }

  const ip =
    event.headers?.["x-nf-client-connection-ip"] ||
    event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    "unknown";
  if (rateLimited(ip)) {
    return json(429, { error: "rate_limited" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "bad_json" });
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const source = typeof payload.source === "string" ? payload.source.slice(0, 64) : "";

  if (!EMAIL_RE.test(email)) {
    return json(400, { error: "invalid_email" });
  }

  // Honeypot — if populated, pretend success without calling the API.
  if (payload.website) {
    return json(200, { ok: true });
  }

  const body = {
    email_address: email,
    type: "regular", // skip double-opt-in confirmation
    tags: source ? [source] : [],
    referrer_url: source ? `okay.tools/${source}` : "okay.tools",
  };

  let res;
  try {
    res = await fetch(BUTTONDOWN_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return json(502, { error: "upstream_unreachable", detail: String(err?.message || err) });
  }

  // 201 created or 200 already exists — treat both as success.
  if (res.status === 201 || res.status === 200) {
    return json(200, { ok: true });
  }

  let detail = null;
  try {
    detail = await res.json();
  } catch {
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
  }

  // Buttondown returns 400 with code "email_already_exists" when the address
  // is already subscribed — treat that as success for the user.
  const code =
    (detail && typeof detail === "object" && (detail.code || detail.detail)) || "";
  if (typeof code === "string" && /already/i.test(code)) {
    return json(200, { ok: true, already: true });
  }

  return json(res.status >= 500 ? 502 : 400, {
    error: "upstream_error",
    status: res.status,
    detail,
  });
};
