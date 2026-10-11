import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { discoverSources, fetchSources } from '../../scripts/signal/feeds.mjs';
import { buildSignal } from '../../scripts/signal/build.mjs';
import { sourcesSchema } from '../../scripts/signal/io.mjs';

const config = JSON.parse(await readFile(new URL('../../config/signal.json', import.meta.url), 'utf8'));
const emptyFeed = '<rss version="2.0"><channel><title>Verified</title><link>https://example.com</link><description>Empty</description></channel></rss>';
const sources = [
  { name: 'Alternate', site: 'https://alternate.example/', feed: null, weight: 1 },
  { name: 'Fallback', site: 'https://fallback.example/', feed: null, weight: 1 },
  { name: 'Invalid', site: 'https://invalid.example/', feed: null, weight: 1 },
];
const fixtureFetch = async url => {
  if (url === sources[0].site) return new Response('<link rel="alternate" type="application/atom+xml" href="/custom.xml">');
  if (url === 'https://alternate.example/custom.xml') return new Response('<feed xmlns="http://www.w3.org/2005/Atom"><title>Verified Atom</title><id>https://alternate.example</id><updated>2026-10-08T10:00:00Z</updated></feed>');
  if (url === 'https://fallback.example/rss.xml') return new Response(emptyFeed);
  return new Response('<html>Not XML feed</html>');
};

test('sources use a neutral default weight when omitted', () => {
  const parsed = sourcesSchema.parse([{ name: 'Example', site: 'https://example.com/', feed: null }]);
  assert.equal(parsed[0].weight, 1);
});

test('discovery verifies RSS/Atom metadata and fallback paths, excludes invalid XML', async () => {
  const logs = [];
  const result = await discoverSources(sources, { fetchImpl: fixtureFetch, logger: value => logs.push(value) });
  assert.deepEqual(result.map(source => source.feed), ['https://alternate.example/custom.xml', 'https://fallback.example/rss.xml', null]);
  assert.ok(logs.some(value => value.includes('Invalid: no verified feed')));
});

test('changelog discovery rejects blog alternates and ingestion excludes unrelated posts', async () => {
  const source = { name: 'Supabase changelog', site: 'https://supabase.com/changelog', feed: null, weight: 1 };
  const feed = links => `<rss version="2.0"><channel><title>Updates</title><link>https://supabase.com</link><description>Updates</description>${links.map((link, index) => `<item><title>Update ${index}</title><link>${link}</link><pubDate>Thu, 08 Oct 2026 10:00:00 GMT</pubDate></item>`).join('')}</channel></rss>`;
  const changelog = 'https://supabase.com/changelog/scoped-tokens';
  const blog = 'https://supabase.com/blog/announcement';
  const fetchImpl = async url => {
    if (url === source.site) return new Response('<link rel="alternate" type="application/rss+xml" href="/feed.xml">');
    if (url === 'https://supabase.com/feed.xml') return new Response(feed([blog]));
    if (url === 'https://supabase.com/changelog-rss.xml') return new Response(feed([changelog, blog]));
    return new Response('Not found', { status: 404 });
  };
  const discovered = await discoverSources([source], { fetchImpl, logger: () => {} });
  assert.equal(discovered[0].feed, 'https://supabase.com/changelog-rss.xml');
  const ingested = await fetchSources(discovered, { fetchImpl, logger: () => {}, now: new Date('2026-10-08T12:00:00Z') });
  assert.deepEqual(ingested[0].items.map(item => item.url), [changelog]);
});

test('discovery updates config only explicitly requested and never in dry run', async context => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'signal-discovery-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'config'));
  await writeFile(path.join(root, 'config/signal.json'), JSON.stringify(config));
  const file = path.join(root, 'config/signal-sources.json');
  await writeFile(file, JSON.stringify(sources));
  const before = await readFile(file, 'utf8');
  const options = { root, now: new Date('2026-10-08T12:00:00Z'), fetchImpl: fixtureFetch, logger: () => {}, env: {} };
  const excluded = await buildSignal({ ...options, dryRun: true });
  assert.equal(excluded.status, 'feeds-failed');
  assert.equal(await readFile(file, 'utf8'), before);
  await buildSignal({ ...options, dryRun: true, discover: true });
  assert.equal(await readFile(file, 'utf8'), before);
  assert.deepEqual((await readdir(root)).sort(), ['config']);
  await buildSignal({ ...options, discover: true });
  const updated = JSON.parse(await readFile(file, 'utf8'));
  assert.deepEqual(updated.map(source => source.feed), ['https://alternate.example/custom.xml', 'https://fallback.example/rss.xml', null]);
});