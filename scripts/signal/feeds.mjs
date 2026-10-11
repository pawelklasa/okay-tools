import Parser from 'rss-parser';
import { load } from 'cheerio';
import { safeUrl, canonicalKey, plainText } from './core.mjs';

const parser = new Parser();
const knownPaths = {
  'www.joshwcomeau.com': ['/rss.xml'], 'emilkowal.ski': ['/rss', '/feed.xml'],
  'rauno.me': ['/rss.xml', '/craft/rss.xml'], 'paco.me': ['/feed.xml', '/rss'],
  'maggieappleton.com': ['/rss.xml'], 'frontendfoc.us': ['/rss'],
  'piccalil.li': ['/feed.xml'], 'ishadeed.com': ['/feed.xml'],
  'developer.chrome.com': ['/static/blog/feed.xml', '/feeds/blog.xml'],
  'web.dev': ['/static/blog/feed.xml', '/feed.xml'], 'bradfrost.com': ['/feed/'],
  'eightshapes.com': ['/blog/feed', '/blog/feed.xml', '/feed.xml'],
  'www.smashingmagazine.com': ['/feed/'], 'lg.substack.com': ['/feed'],
  'www.nngroup.com': ['/feed/rss/', '/articles/rss/'], 'linear.app': ['/rss/changelog.xml'],
  'vercel.com': ['/atom'], 'supabase.com': ['/changelog-rss.xml'],
  'simonwillison.net': ['/atom/everything/', '/atom/entries/'], 'news.ycombinator.com': ['/rss'],
};

export async function fetchText(url, { fetchImpl = globalThis.fetch, timeoutMs = 10_000, ...options } = {}) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Request timed out'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(url, { ...options, signal: controller.signal });
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          if (new URL(url).hostname === 'api.anthropic.com') {
            try {
              const payload = await response.json();
              const message = typeof payload.error?.message === 'string' ? payload.error.message : '';
              const key = options.headers?.['x-api-key'];
              error.apiMessage = message.replaceAll(key || '\u0000', '[redacted]')
                .replace(/sk-ant-[\w-]+/g, '[redacted]').replace(/[\r\n\x00-\x1f]/g, ' ').slice(0, 300);
            } catch {
              error.apiMessage = '';
            }
          }
          throw error;
        }
        const text = await response.text();
        return { text, url: response.url || url };
      })(), deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function parseFeed(xml) {
  if (!/<(?:rss|feed|rdf:RDF)(?:\s|>)/i.test(xml)) throw new Error('Not feed XML');
  const feed = await parser.parseString(xml);
  if (!Array.isArray(feed.items)) throw new Error('Missing feed items');
  return feed;
}

function matchesSource(url, source) {
  const site = new URL(source.site);
  if (site.pathname.replace(/\/$/, '') !== '/changelog') return true;
  const item = new URL(url);
  return item.hostname === site.hostname && item.pathname.startsWith('/changelog/');
}

export async function discoverSources(sources, { fetchImpl, logger = console.log, timeoutMs } = {}) {
  return Promise.all(sources.map(async source => {
    if (source.feed === null) logger(`${source.name}: null feed, excluded until verified`);
    const candidates = [];
    try {
      const homepage = await fetchText(source.site, { fetchImpl, timeoutMs });
      const document = load(homepage.text);
      document('link[rel]').each((index, element) => {
        const link = document(element);
        if (!link.attr('rel').toLowerCase().split(/\s+/).includes('alternate')) return;
        if (!/(rss|atom|xml)/i.test(link.attr('type') || '')) return;
        const candidate = safeUrl(link.attr('href'), homepage.url);
        if (candidate) candidates.push(candidate);
      });
    } catch {
      logger(`${source.name}: homepage discovery failed; checking plausible feed paths`);
    }
    if (source.feed) candidates.push(source.feed);
    for (const feedPath of [...(knownPaths[new URL(source.site).hostname] || []), '/feed', '/rss.xml', '/atom.xml', '/feed.xml', '/rss']) {
      candidates.push(new URL(feedPath, source.site).href);
    }
    for (const candidate of new Set(candidates)) {
      try {
        const response = await fetchText(candidate, { fetchImpl, timeoutMs });
        const parsed = await parseFeed(response.text);
        if (new URL(source.site).pathname.replace(/\/$/, '') === '/changelog' &&
          !parsed.items.some(item => {
            const url = safeUrl(item.link, source.site);
            return url && matchesSource(url, source);
          })) throw new Error('Feed does not contain requested changelog items');
        const feed = safeUrl(response.url);
        if (!feed) continue;
        logger(`${source.name}: verified ${feed}`);
        return { ...source, feed };
      } catch {
        logger(`${source.name}: feed probe failed ${candidate}`);
      }
    }
    logger(`${source.name}: no verified feed; null feed, excluded`);
    return { ...source, feed: null };
  }));
}

export async function fetchSources(sources, { fetchImpl, logger = console.log, now, timeoutMs } = {}) {
  const cutoff = now.getTime() - 36 * 60 * 60 * 1000;
  return Promise.all(sources.map(async source => {
    if (!source.feed) {
      logger(`${source.name}: null feed, excluded`);
      return { source, success: false, scanned: 0, items: [] };
    }
    try {
      const response = await fetchText(source.feed, { fetchImpl, timeoutMs });
      const feed = await parseFeed(response.text);
      const normalized = feed.items.map(item => {
        const url = typeof item.link === 'string' ? safeUrl(item.link, source.site) : null;
        const title = plainText(item.title, 300);
        if (!url || !title || !matchesSource(url, source)) return null;
        const date = new Date(item.isoDate || item.pubDate || '');
        return {
          title, url, canonical: canonicalKey(url), source: source.name, weight: source.weight,
          publishedAt: Number.isFinite(date.getTime()) ? date.toISOString() : null,
          excerpt: plainText(item.contentSnippet || item.summary || item.content || item['content:encoded']),
        };
      }).filter(Boolean);
      const items = normalized.filter(item => item.publishedAt &&
        Date.parse(item.publishedAt) >= cutoff && Date.parse(item.publishedAt) <= now.getTime())
        .sort((first, second) => second.publishedAt.localeCompare(first.publishedAt) || first.canonical.localeCompare(second.canonical));
      logger(`${source.name}: scanned ${normalized.length}, recent ${items.length}`);
      return { source, success: true, scanned: normalized.length, items };
    } catch {
      logger(`${source.name}: feed fetch or XML parsing failed; skipped`);
      return { source, success: false, scanned: 0, items: [] };
    }
  }));
}