// Vercel / Netlify-compatible Node serverless function — GET /api/fetch-url?url=...
// Mirror of functions/api/fetch-url.ts (Cloudflare Pages Functions).

export default async function handler(req, res) {
  const target = req.query?.url || new URL(req.url, "http://x").searchParams.get("url");
  if (!target) {
    res.status(400).json({ error: "no url" });
    return;
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    res.status(400).json({ error: "invalid url" });
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    res.status(400).json({ error: "only http(s) urls supported" });
    return;
  }
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
    res.status(400).json({ error: "private host not allowed" });
    return;
  }

  try {
    const r = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 okay.tools default-audit" },
      redirect: "follow",
    });
    const html = await r.text();

    const linkMatches = [
      ...html.matchAll(
        /<link[^>]+(?:rel=["']stylesheet["'][^>]*href=["']([^"']+)["']|href=["']([^"']+\.css[^"']*)["'][^>]*rel=["']stylesheet["'])/gi
      ),
    ];
    const cssLinks = linkMatches.map((m) => m[1] || m[2]).filter(Boolean);
    const absoluteCssLinks = cssLinks
      .map((link) => {
        try {
          return new URL(link, parsed).href;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .slice(0, 5);

    const cssTexts = await Promise.all(
      absoluteCssLinks.map(async (cssUrl) => {
        try {
          const cr = await fetch(cssUrl);
          const t = await cr.text();
          return t.slice(0, 300_000);
        } catch {
          return "";
        }
      })
    );

    res.setHeader("cache-control", "no-store");
    res.status(200).json({
      url: parsed.toString(),
      html: html.slice(0, 800_000),
      css: cssTexts.join("\n\n"),
      stylesheets: absoluteCssLinks,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "fetch failed" });
  }
}
