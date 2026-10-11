import { audit } from "./defaultAudit";
import { parseCss, score } from "./drift";
import { auditTokens, parseTokens } from "./tokenAudit";

export const DASHBOARD_SAMPLE = `:root {
  --color-primary: #3b82f6;
  --color-secondary: #64748b;
  --color-background: #ffffff;
  --color-danger: #ef4444;
  --primary: 222.2 47.4% 11.2%;
  --radius: 0.5rem;
}
${Array.from({ length: 23 }, (_, index) => `.space-${index + 1} { padding: ${index + 2}px; }`).join("\n")}
.button { border-radius: 8px; font-family: Inter, sans-serif; }
import { ArrowRight } from "lucide-react";
<div className="flex p-4 gap-4 rounded-lg shadow-md max-w-7xl tracking-tight" />`;

export function checkDesignSystem(css: string, source = "Pasted CSS", sourceText = css) {
  if (css.length > 2_000_000 || sourceText.length > 2_000_000) {
    throw new Error("This check accepts up to 2 MB of CSS and page source.");
  }
  const observations = parseCss(css);
  if (!observations.length) throw new Error("No readable CSS declarations found. Paste CSS or try a different URL.");
  const drift = score({ mode: "paste", target: source, observations });
  const defaults = audit(sourceText);
  const tokens = auditTokens(parseTokens(css, "css"), "css", css);
  const spacing = drift.categories.find(category => category.category === "spacing")!;
  const findings = Number(drift.overBudget > 0) + Number(defaults.groups.length > 0) + Number(tokens.costumeCount > 0);
  return { source, drift, defaults, tokens, spacing, findings };
}

export type DashboardReport = ReturnType<typeof checkDesignSystem>;

export async function fetchDesignSystem(url: string, signal: AbortSignal) {
  const target = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  if (!/^https?:$/.test(target.protocol)) throw new Error("Enter an HTTP or HTTPS URL.");
  const response = await fetch(`/api/fetch-url?url=${encodeURIComponent(target.href)}`, { signal });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("URL checks are unavailable on this host. Paste the site's CSS instead.");
  }
  const bundle: { css?: string; html?: string; url?: string; error?: string } = await response.json();
  if (bundle.error) throw new Error("Could not fetch that page. Paste its CSS instead.");
  const html = typeof bundle.html === "string" ? bundle.html : "";
  const document = new DOMParser().parseFromString(html, "text/html");
  const embedded = Array.from(document.querySelectorAll("style")).map(element => element.textContent ?? "").join("\n");
  const inline = Array.from(document.querySelectorAll("[style]")).map((element, index) => `.inline-${index} { ${element.getAttribute("style")} }`).join("\n");
  const css = [typeof bundle.css === "string" ? bundle.css : "", embedded, inline].join("\n");
  return checkDesignSystem(css, bundle.url ?? target.href, `${html}\n${css}`);
}