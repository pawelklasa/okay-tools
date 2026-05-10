import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
  plugins: [react(), tailwindcss(), devFetchUrl()],
})
