import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Source for the browser-side collector used by the dev /api/drift-scan
// middleware. Stringified so TS doesn't type-check DOM globals here.
const BROWSER_COLLECT_SRC = `(() => {
  const obs = [];
  const tp = new Set();
  const warn = [];
  const SELF = location.host;
  for (const f of Array.from(document.querySelectorAll('iframe,embed,object'))) {
    const src = f.getAttribute('src') || '';
    try { const u = new URL(src, location.href); if (u.host && u.host !== SELF) tp.add(u.host); } catch (e) {}
  }
  const all = document.querySelectorAll('body *');
  let n = 0;
  for (const el of Array.from(all)) {
    if (n >= 5000) { warn.push('Element cap reached at 5000'); break; }
    if (['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName)) continue;
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (rect.width === 0 || rect.height === 0) continue;
    n++;
    const push = (c, r) => { if (r && r !== 'none' && r !== 'normal' && r !== 'auto') obs.push({ category: c, raw: r }); };
    push('textColor', cs.color); push('bgColor', cs.backgroundColor);
    push('borderColor', cs.borderTopColor); push('borderColor', cs.borderRightColor);
    push('borderColor', cs.borderBottomColor); push('borderColor', cs.borderLeftColor);
    push('fontFamily', cs.fontFamily); push('fontSize', cs.fontSize);
    push('fontWeight', cs.fontWeight); push('lineHeight', cs.lineHeight);
    push('borderRadius', cs.borderTopLeftRadius); push('borderRadius', cs.borderTopRightRadius);
    push('borderRadius', cs.borderBottomLeftRadius); push('borderRadius', cs.borderBottomRightRadius);
    push('boxShadow', cs.boxShadow); push('transitionDuration', cs.transitionDuration);
    push('zIndex', cs.zIndex);
    push('spacing', cs.marginTop); push('spacing', cs.marginRight); push('spacing', cs.marginBottom); push('spacing', cs.marginLeft);
    push('spacing', cs.paddingTop); push('spacing', cs.paddingRight); push('spacing', cs.paddingBottom); push('spacing', cs.paddingLeft);
    push('spacing', cs.gap);
  }
  return { observations: obs, thirdParty: Array.from(tp), warnings: warn };
})()`;

// Cloudflare Pages and Netlify serve at the root; GitHub Pages serves under /okay-tools/.
// CF_PAGES / NETLIFY are set automatically in those build environments.
const base = process.env.CF_PAGES || process.env.NETLIFY ? '/' : '/okay-tools/'

// Dev-only middleware mirroring functions/api/fetch-url.ts so /api/fetch-url
// works under `npm run dev`. Production is served by the platform function.
function devFetchUrl(): Plugin {
  return {
    name: 'dev-fetch-url',
    configureServer(server) {
      server.middlewares.use('/api/fetch-url', async (req, res) => {
        const sendJson = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.setHeader('cache-control', 'no-store')
          res.end(JSON.stringify(body))
        }
        try {
          const reqUrl = new URL(req.url || '', 'http://x')
          const target = reqUrl.searchParams.get('url')
          if (!target) return sendJson(400, { error: 'no url' })
          let parsed: URL
          try { parsed = new URL(target) } catch { return sendJson(400, { error: 'invalid url' }) }
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return sendJson(400, { error: 'only http(s) urls supported' })
          }
          const host = parsed.hostname.toLowerCase()
          if (
            host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' ||
            host.endsWith('.local') || host.startsWith('10.') || host.startsWith('192.168.') ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
          ) return sendJson(400, { error: 'private host not allowed' })

          const r = await fetch(parsed.toString(), {
            headers: { 'User-Agent': 'Mozilla/5.0 okay.tools default-audit' },
            redirect: 'follow',
          })
          const html = await r.text()
          const linkMatches = [
            ...html.matchAll(
              /<link[^>]+(?:rel=["']stylesheet["'][^>]*href=["']([^"']+)["']|href=["']([^"']+\.css[^"']*)["'][^>]*rel=["']stylesheet["'])/gi
            ),
          ]
          const cssLinks = linkMatches.map(m => m[1] || m[2]).filter(Boolean) as string[]
          const absoluteCssLinks = cssLinks
            .map(link => { try { return new URL(link, parsed).href } catch { return null } })
            .filter((u): u is string => !!u)
            .slice(0, 5)
          const cssTexts = await Promise.all(absoluteCssLinks.map(async u => {
            try { const cr = await fetch(u); const t = await cr.text(); return t.slice(0, 300_000) }
            catch { return '' }
          }))
          sendJson(200, {
            url: parsed.toString(),
            html: html.slice(0, 800_000),
            css: cssTexts.join('\n\n'),
            stylesheets: absoluteCssLinks,
          })
        } catch (err) {
          sendJson(500, { error: err instanceof Error ? err.message : 'fetch failed' })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), devFetchUrl(), devDriftScan()],
})

// Dev-only middleware mirroring netlify/functions/drift-scan.mjs so /api/drift-scan
// works under `npm run dev`. In production this is served by the Netlify function
// via the redirect in netlify.toml. If playwright-core isn't installed locally,
// we return a friendly 501 — paste mode and CLI mode still work.
function devDriftScan(): Plugin {
  return {
    name: 'dev-drift-scan',
    configureServer(server) {
      server.middlewares.use('/api/drift-scan', async (req, res) => {
        const sendJson = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.setHeader('cache-control', 'no-store')
          res.end(JSON.stringify(body))
        }
        if (req.method !== 'POST') return sendJson(405, { error: 'method not allowed' })
        try {
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const target = body.url
          if (!target) return sendJson(400, { error: 'no url' })
          let parsed: URL
          try { parsed = new URL(target) } catch { return sendJson(400, { error: 'invalid url' }) }
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return sendJson(400, { error: 'only http(s) urls supported' })
          }
          const host = parsed.hostname.toLowerCase()
          if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' ||
              host.endsWith('.local') || host.startsWith('10.') || host.startsWith('192.168.') ||
              /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
            return sendJson(400, { error: 'private host not allowed' })
          }
          let chromium: any
          try {
            const mod = 'playwright-core'
            chromium = (await import(/* @vite-ignore */ mod)).chromium
          } catch {
            return sendJson(501, { error: 'Headless browser not installed locally. `npm i -D playwright-core` to enable URL mode in dev, or use paste/CLI mode.' })
          }
          // @ts-expect-error JS module
          const { score } = await import('./packages/drift-engine/src/index.js')
          const browser = await chromium.launch({ args: ['--no-sandbox'] })
          try {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
            await page.goto(parsed.toString(), { waitUntil: 'load', timeout: 10000 })
            await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
            const { observations, thirdParty, warnings } = await page.evaluate(BROWSER_COLLECT_SRC)
            const report = score({
              mode: 'url',
              target: parsed.toString(),
              observations,
              config: typeof body.tolerance === 'number' ? { colorToleranceDeltaE: body.tolerance } : undefined,
              warnings,
              thirdPartyExclusions: thirdParty,
            })
            sendJson(200, report)
          } finally {
            await browser.close().catch(() => {})
          }
        } catch (err) {
          sendJson(500, { error: err instanceof Error ? err.message : 'scan failed' })
        }
      })
    },
  }
}
