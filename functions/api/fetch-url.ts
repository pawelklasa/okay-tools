// Cloudflare Pages Function — GET /api/fetch-url?url=...
// Server-side fetch to bypass CORS. Returns html + concatenated linked CSS.

interface Env {}

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const reqUrl = new URL(request.url);
  const target = reqUrl.searchParams.get("url");
  if (!target) {
    return json({ error: "no url" }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return json({ error: "invalid url" }, 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return json({ error: "only http(s) urls supported" }, 400);
  }
  // SSRF guard: reject loopback / private hostnames
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return json({ error: "private host not allowed" }, 400);
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 okay.tools default-audit" },
      redirect: "follow",
      // 10s soft cap via AbortSignal
      signal: AbortSignal.timeout(10_000),
    });
    const html = await res.text();

    // Extract <link rel="stylesheet" href="...">
    const linkMatches = [
      ...html.matchAll(
        /<link[^>]+(?:rel=["']stylesheet["'][^>]*href=["']([^"']+)["']|href=["']([^"']+\.css[^"']*)["'][^>]*rel=["']stylesheet["'])/gi
      ),
    ];
    const cssLinks = linkMatches
      .map((m) => m[1] || m[2])
      .filter(Boolean) as string[];
    const absoluteCssLinks = cssLinks
      .map((link) => {
        try {
          return new URL(link, parsed).href;
        } catch {
          return null;
        }
      })
      .filter((u): u is string => !!u)
      .slice(0, 5);

    const cssTexts = await Promise.all(
      absoluteCssLinks.map(async (cssUrl) => {
        try {
          const r = await fetch(cssUrl, {
            signal: AbortSignal.timeout(8_000),
          });
          // cap each stylesheet at 300KB
          const t = await r.text();
          return t.slice(0, 300_000);
        } catch {
          return "";
        }
      })
    );

    return json({
      url: parsed.toString(),
      html: html.slice(0, 800_000),
      css: cssTexts.join("\n\n"),
      stylesheets: absoluteCssLinks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    return json({ error: message }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}
