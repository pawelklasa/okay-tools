import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import { readConfig, readHistory, atomicJson, digestSchema } from './io.mjs';
import { discoverSources, fetchSources } from './feeds.mjs';
import { canonicalKey, fairCandidates, nearTitle } from './core.mjs';
import { scoreCandidates, rankArticles } from './scoring.mjs';

export { canonicalKey, safeUrl, nearTitle, fairCandidates } from './core.mjs';
export { discoverSources, fetchSources } from './feeds.mjs';
export { validateBatch, rankArticles } from './scoring.mjs';

const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));

export async function buildSignal({
  root = defaultRoot, dataDir = path.join(root, 'data/signal'), dryRun = false, discover = false,
  fetchImpl = globalThis.fetch, logger = console.log, now = new Date(), env = process.env, timeoutMs = 10_000,
  scoringTimeoutMs = 60_000,
} = {}) {
  const instant = new Date(typeof now === 'function' ? now() : now);
  if (!Number.isFinite(instant.getTime())) throw new Error('Invalid run date');
  const date = instant.toISOString().slice(0, 10);
  const { config, sources: configuredSources } = await readConfig(root);
  const history = await readHistory(dataDir, config);
  const existing = history.find(digest => digest.date === date);
  const usage = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let sources = configuredSources;
  if (discover) {
    sources = await discoverSources(sources, { fetchImpl, logger, timeoutMs });
    if (!dryRun) await atomicJson(path.join(root, 'config/signal-sources.json'), sources);
    logger(`Discovery: ${sources.filter(source => source.feed).length}/${sources.length} verified feeds${dryRun ? ' (dry run; not written)' : ''}`);
  }
  if (existing) {
    if (!discover) for (const source of sources.filter(source => !source.feed)) logger(`${source.name}: null feed, excluded`);
    logger(`${date}: already published; unchanged`);
    printRankings(existing, logger);
    printUsage(usage, logger);
    return { digest: existing, usage, status: 'existing' };
  }
  const results = await fetchSources(sources, { fetchImpl, logger, now: instant, timeoutMs });
  const successful = results.filter(result => result.success);
  const scanned = results.reduce((total, result) => total + result.scanned, 0);
  logger(`Feeds: ${successful.length}/${sources.length} successful; scanned ${scanned}`);
  if (!successful.length) {
    logger('No successful feeds; not publishing');
    printUsage(usage, logger);
    return { digest: null, usage, status: 'feeds-failed' };
  }
  const historical = history.flatMap(digest => digest.items);
  const historicalKeys = new Set(historical.map(article => canonicalKey(article.url)));
  const seenKeys = new Set(historicalKeys);
  const candidates = [];
  for (const item of fairCandidates(successful.map(result => result.items), Infinity)) {
    if (seenKeys.has(item.canonical)) continue;
    seenKeys.add(item.canonical);
    if (historical.some(article => nearTitle(article.title, item.title))) continue;
    if (candidates.some(article => nearTitle(article.title, item.title))) continue;
    candidates.push({ ...item, id: `item-${candidates.length + 1}` });
    if (candidates.length === 300) break;
  }
  logger(`Candidates: ${candidates.length} after history and feed deduplication (cap 300)`);
  const scoring = candidates.length ? await scoreCandidates(candidates, config, { fetchImpl, logger, env, timeoutMs: scoringTimeoutMs }) :
    { scored: [], usage, successfulBatches: 0 };
  printUsage(scoring.usage, logger);
  if (candidates.length && !scoring.successfulBatches) {
    logger('All scoring batches failed; not publishing');
    return { digest: null, usage: scoring.usage, status: 'scoring-failed' };
  }
  const items = rankArticles(scoring.scored);
  const digest = digestSchema(config).parse({
    date, scanned, kept: items.length, sources: successful.map(result => result.source.name), items,
  });
  printRankings(digest, logger);
  if (!dryRun) {
    try {
      await atomicJson(path.join(dataDir, `${date}.json`), digest, true);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const published = (await readHistory(dataDir, config)).find(item => item.date === date);
      if (!published) throw new Error('Concurrent digest publication could not be read');
      logger(`${date}: published by another run; unchanged`);
      return { digest: published, usage: scoring.usage, status: 'existing' };
    }
  }
  logger(dryRun ? 'Dry run: no files written' : `Published ${date}: ${digest.kept} items`);
  return { digest, usage: scoring.usage, status: dryRun ? 'dry-run' : 'published' };
}

function printUsage(usage, logger) {
  logger(`Usage: ${usage.requests} requests; ${usage.inputTokens} input tokens; ${usage.outputTokens} output tokens (includes retries)`);
}

function printRankings(digest, logger) {
  logger(`${digest.date}: ${digest.kept} ranked items; ${digest.sources?.length ?? 0} successful sources; scanned ${digest.scanned}`);
  for (const article of digest.items) {
    logger(`${article.rank}. [${article.score}] ${article.title} | ${article.source}\n${article.url}\n${article.summary}\nTags: ${article.tags.join(', ')} | Why: ${article.why}`);
  }
}

export async function main(args = process.argv.slice(2)) {
  try {
    loadEnvFile(path.join(defaultRoot, '.env.local'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Cannot load local environment file');
  }
  const allowed = new Set(['--dry-run', '--discover']);
  if (args.some(argument => !allowed.has(argument))) throw new Error('Usage: node scripts/signal/build.mjs [--dry-run] [--discover]');
  return buildSignal({ dryRun: args.includes('--dry-run'), discover: args.includes('--discover') });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(result => {
    if (result.status === 'feeds-failed' || result.status === 'scoring-failed') process.exitCode = 1;
  }).catch(error => {
    console.error(error instanceof Error && /^(Usage:|Invalid or unreadable Signal history:|Cannot read Signal history directory)/.test(error.message)
      ? error.message : 'Signal build failed; check configuration and filesystem access');
    process.exitCode = 1;
  });
}