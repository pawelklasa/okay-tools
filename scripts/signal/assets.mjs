import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, mkdir } from 'node:fs/promises';
import { configSchema, readHistory, atomicWrite, atomicJson } from './io.mjs';
import { canonicalKey, plainText } from './core.mjs';

const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));

export function xmlEscape(value) {
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export function renderRss(digests, config) {
  const site = new URL(config.path, config.siteUrl).href;
  const feed = new URL(`${config.path}/rss.xml`, config.siteUrl).href;
  const seen = new Set();
  const items = [];
  for (const digest of [...digests].sort((first, second) => second.date.localeCompare(first.date))) {
    for (const article of digest.items) {
      const canonical = canonicalKey(article.url);
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      const description = `${plainText(article.summary, Infinity)}\nSource: ${plainText(article.source, Infinity)}`;
      const published = new Date(`${digest.date}T05:00:00Z`).toUTCString();
      items.push(`<item><title>${xmlEscape(article.title)}</title><link>${xmlEscape(article.url)}</link><guid isPermaLink="true">${xmlEscape(canonical)}</guid><pubDate>${published}</pubDate><description>${xmlEscape(description)}</description>${article.tags.map(tag => `<category>${xmlEscape(tag)}</category>`).join('')}</item>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xmlEscape(config.name)}</title><link>${xmlEscape(site)}</link><description>${xmlEscape(`Selected articles for ${config.name}`)}</description><language>en</language><atom:link href="${xmlEscape(feed)}" rel="self" type="application/rss+xml"/>${items.join('')}</channel></rss>\n`;
}

export async function buildAssets({
  root = defaultRoot, dataDir = path.join(root, 'data/signal'), outputDir,
  logger = console.log,
} = {}) {
  const config = configSchema.parse(JSON.parse(await readFile(path.join(root, 'config/signal.json'), 'utf8')));
  const digests = (await readHistory(dataDir, config)).sort((first, second) => second.date.localeCompare(first.date));
  const destination = outputDir || path.join(root, 'public', config.path.replace(/^\//, ''));
  await mkdir(destination, { recursive: true });
  await atomicWrite(path.join(destination, 'rss.xml'), renderRss(digests, config));
  await atomicJson(path.join(destination, 'digests.json'), digests);
  logger(`Assets: ${digests.length} real digest dates; ${new Set(digests.flatMap(digest => digest.items.map(article => canonicalKey(article.url)))).size} unique RSS articles`);
  return { digests, outputDir: destination };
}

export async function main(args = process.argv.slice(2), { root = defaultRoot, logger = console.log } = {}) {
  if (args.length && (args.length !== 2 || args[0] !== '--output' || !args[1].trim() || args[1].startsWith('--'))) {
    throw new Error('Usage: node scripts/signal/assets.mjs [--output <directory>]');
  }
  return buildAssets({ root, logger, outputDir: args.length ? path.resolve(root, args[1], 'signal') : undefined });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error && /^(Usage:|Invalid or unreadable Signal history:|Cannot read Signal history directory)/.test(error.message)
      ? error.message : 'Signal assets failed; check configuration, history, and filesystem access');
    process.exitCode = 1;
  });
}