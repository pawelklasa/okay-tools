// Netlify Function — POST /.netlify/functions/drift-scan
// Body: { "url": "https://example.com", "tolerance"?: number }
//
// Runs a headless Chromium (Playwright) at the URL, reads computed styles of
// every visible element, and returns a drift report. The URL is never logged.
//
// Limits:
//   - HTTPS only, public hosts only (no localhost / RFC1918).
//   - 10s navigation + 5s settle timeout.
//   - In-memory rate-limit: 30 req / 10 min per IP (best-effort; Netlify
//     functions are stateless but warm containers share memory).
//   - Computed-style sampling is capped at 5000 elements per page.

import { score, CATEGORIES, CATEGORY_ORDER } from "../../packages/drift-engine/src/index.js";

// Lazy import so cold-start TS-check stays fast and so this file is loadable
// in environments without Playwright (the engine itself has no playwright dep).
// On AWS Lambda (which Netlify Functions runs on) we use @sparticuz/chromium
// to provide a Lambda-compatible Chromium binary; locally we let playwright-core
// resolve its own browser.
let launcherPromise = null;
async function getLauncher() {
  if (!launcherPromise) {
    launcherPromise = (async () => {
      const { chromium } = await import("playwright-core");
      const onLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.LAMBDA_TASK_ROOT;
      if (onLambda) {
        const mod = await import("@sparticuz/chromium");
        const chromiumPkg = mod.default ?? mod;
        const executablePath = await chromiumPkg.executablePath();
        return {
          launch: () =>
            chromium.launch({
              args: chromiumPkg.args,
              executablePath,
              headless: true,
            }),
        };
      }
      return {
        launch: () =>
          chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] }),
      };
    })();
  }
  return launcherPromise;
}

const RATE_BUCKET = new Map(); // ip -> { count, resetAt }
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function rateLimit(ip) {
  const now = Date.now();
  const entry = RATE_BUCKET.get(ip);
  if (!entry || entry.resetAt < now) {
    RATE_BUCKET.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function isPrivateHost(host) {
  host = host.toLowerCase();
  return (
    host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.startsWith("10.") || host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

/** @type {import("@netlify/functions").Handler} */
export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "method not allowed" });
  }
  const ip =
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    "anon";
  if (!rateLimit(ip)) return json(429, { error: "rate limited; try again in 10 minutes" });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "invalid json body" }); }

  const target = body.url;
  if (!target || typeof target !== "string") return json(400, { error: "no url" });
  let parsed;
  try { parsed = new URL(target); }
  catch { return json(400, { error: "invalid url" }); }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return json(400, { error: "only http(s) urls supported" });
  }
  if (isPrivateHost(parsed.hostname)) return json(400, { error: "private host not allowed" });

  const tolerance = typeof body.tolerance === "number" ? body.tolerance : undefined;

  let launcher;
  try { launcher = await getLauncher(); }
  catch (e) {
    return json(500, { error: "Headless browser unavailable in this environment. Use paste or CLI mode." });
  }

  let browser;
  try {
    browser = await launcher.launch();
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: "okay-drift/0.1 (+https://okay.tools)",
    });
    const page = await ctx.newPage();
    await page.goto(parsed.toString(), { waitUntil: "load", timeout: 10000 });
    // Settle: wait for network idle but cap it tight.
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

    const { observations, thirdParty, warnings } = await page.evaluate(collectInPage);

    await browser.close();
    browser = null;

    const report = score({
      mode: "url",
      target: parsed.toString(),
      observations,
      config: tolerance ? { colorToleranceDeltaE: tolerance } : undefined,
      warnings,
      thirdPartyExclusions: thirdParty,
    });

    return json(200, report);
  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    const msg = e && e.message ? e.message : "scan failed";
    // Common failure modes, surfaced honestly:
    if (/Timeout/.test(msg)) return json(504, { error: "Page took too long to load." });
    if (/net::ERR_/.test(msg)) return json(502, { error: `Could not reach page: ${msg}` });
    return json(500, { error: msg });
  }
};

// This function runs INSIDE the headless browser. It MUST be self-contained
// — no imports, no closures over Node.
function collectInPage() {
  /** @type {Array<{category: string; raw: string; source?: any}>} */
  const obs = [];
  /** @type {string[]} */
  const thirdParty = [];
  /** @type {string[]} */
  const warnings = [];

  const SELF = location.host;
  const iframes = Array.from(document.querySelectorAll("iframe, embed, object"));
  for (const f of iframes) {
    const src = f.getAttribute("src") || "";
    if (!src) continue;
    try {
      const u = new URL(src, location.href);
      if (u.host && u.host !== SELF) thirdParty.push(u.host);
    } catch { /* ignore */ }
  }

  const all = document.querySelectorAll("body *");
  const cap = 5000;
  let n = 0;
  for (const el of all) {
    if (n >= cap) { warnings.push(`Element cap reached at ${cap}; sampling truncated.`); break; }

    // Skip elements inside third-party iframes (we can't reach them anyway).
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "NOSCRIPT") continue;

    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    if (rect.width === 0 || rect.height === 0) continue;
    n++;

    const sel = el.tagName.toLowerCase();
    const push = (category, raw) => {
      if (raw && raw !== "none" && raw !== "normal" && raw !== "auto") {
        obs.push({ category, raw, source: { tag: sel, role: "computed" } });
      }
    };

    push("textColor", cs.color);
    push("bgColor", cs.backgroundColor);
    push("borderColor", cs.borderTopColor);
    push("borderColor", cs.borderRightColor);
    push("borderColor", cs.borderBottomColor);
    push("borderColor", cs.borderLeftColor);
    push("fontFamily", cs.fontFamily);
    push("fontSize", cs.fontSize);
    push("fontWeight", cs.fontWeight);
    push("lineHeight", cs.lineHeight);
    push("borderRadius", cs.borderTopLeftRadius);
    push("borderRadius", cs.borderTopRightRadius);
    push("borderRadius", cs.borderBottomLeftRadius);
    push("borderRadius", cs.borderBottomRightRadius);
    push("boxShadow", cs.boxShadow);
    push("transitionDuration", cs.transitionDuration);
    push("zIndex", cs.zIndex);
    push("spacing", cs.marginTop);
    push("spacing", cs.marginRight);
    push("spacing", cs.marginBottom);
    push("spacing", cs.marginLeft);
    push("spacing", cs.paddingTop);
    push("spacing", cs.paddingRight);
    push("spacing", cs.paddingBottom);
    push("spacing", cs.paddingLeft);
    push("spacing", cs.gap);
  }

  return { observations: obs, thirdParty: Array.from(new Set(thirdParty)), warnings };
}

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(body),
  };
}
