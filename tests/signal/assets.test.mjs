import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Parser from 'rss-parser';
import { load } from 'cheerio';
import { buildAssets, main, xmlEscape } from '../../scripts/signal/assets.mjs';
import { atomicJson } from '../../scripts/signal/io.mjs';

const config = JSON.parse(await readFile(new URL('../../config/signal.json', import.meta.url), 'utf8'));
async function setup(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'signal-assets-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'config'));
  await writeFile(path.join(root, 'config/signal.json'), JSON.stringify(config));
  return root;
}
const article = (index, overrides = {}) => ({
  rank: index, title: `Article & "${index}" test`, url: `https://example.com/${index}?a=1&b=2`,
  source: 'Source & Co', publishedAt: '2026-10-07T10:00:00Z',
  score: 80, summary: 'Practical observations about accessible interfaces.', tags: ['CSS', 'A11y'],
  why: 'Original concrete work', ...overrides,
});
const digest = (date, items) => ({ date, scanned: 20, kept: items.length, sources: ['Source & Co'], items });

test('assets create directory and valid empty manifest/RSS without phantom dates', async context => {
  const root = await setup(context);
  const result = await buildAssets({ root, logger: () => {} });
  const manifest = JSON.parse(await readFile(path.join(result.outputDir, 'digests.json'), 'utf8'));
  assert.deepEqual(manifest, []);
  const feed = await new Parser().parseString(await readFile(path.join(result.outputDir, 'rss.xml'), 'utf8'));
  assert.equal(feed.title, 'signal');
  assert.equal(feed.link, 'https://okay.tools/signal');
  assert.deepEqual(feed.items, []);
});

test('dated assets include only real dates, escaped XML, unique GUIDs, direct links and attribution', async context => {
  const root = await setup(context);
  const dataDir = path.join(root, 'data/signal');
  await atomicJson(path.join(dataDir, '2026-10-07.json'), digest('2026-10-07', [article(1)]));
  await atomicJson(path.join(dataDir, '2026-10-08.json'), digest('2026-10-08', [article(1), article(2)]));
  const result = await buildAssets({ root, logger: () => {} });
  const manifest = JSON.parse(await readFile(path.join(result.outputDir, 'digests.json'), 'utf8'));
  assert.deepEqual(manifest.map(item => item.date), ['2026-10-08', '2026-10-07']);
  assert.deepEqual(manifest, [digest('2026-10-08', [article(1), article(2)]), digest('2026-10-07', [article(1)])]);
  const xml = await readFile(path.join(result.outputDir, 'rss.xml'), 'utf8');
  const parsed = await new Parser().parseString(xml);
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].title, article(1).title);
  assert.equal(parsed.items[0].link, article(1).url);
  assert.equal(parsed.items[0].guid, article(1).url);
  assert.equal(parsed.items[0].isoDate, '2026-10-08T05:00:00.000Z');
  assert.ok(parsed.items[0].contentSnippet.includes('Source: Source & Co'));
  assert.deepEqual(parsed.items[0].categories, ['CSS', 'A11y']);
  const document = load(xml, { xmlMode: true });
  assert.equal(document('atom\\:link').attr('href'), 'https://okay.tools/signal/rss.xml');
  assert.equal(document('guid').attr('isPermaLink'), 'true');
  assert.equal(xmlEscape('a\u0000 & < > " \''), 'a &amp; &lt; &gt; &quot; &apos;');
});

test('invalid historical digest aborts asset generation before output writes', async context => {
  const root = await setup(context);
  await atomicJson(path.join(root, 'data/signal/2026-10-08.json'), digest('2026-10-09', []));
  await assert.rejects(buildAssets({ root, logger: () => {} }), /Invalid or unreadable Signal history/);
  await assert.rejects(readdir(path.join(root, 'public/signal')), { code: 'ENOENT' });
});

test('exclusive atomic publication never overwrites an existing date', async context => {
  const root = await setup(context);
  const file = path.join(root, 'data/signal/2026-10-08.json');
  await atomicJson(file, digest('2026-10-08', []), true);
  const before = await readFile(file, 'utf8');
  await assert.rejects(atomicJson(file, digest('2026-10-08', [article(1)]), true), { code: 'EEXIST' });
  assert.equal(await readFile(file, 'utf8'), before);
  assert.deepEqual(await readdir(path.dirname(file)), ['2026-10-08.json']);
});

test('asset CLI supports --output dist and defaults to public/signal', async context => {
  const root = await setup(context);
  const options = { root, logger: () => {} };
  const direct = await main(['--output', 'dist'], options);
  assert.equal(direct.outputDir, path.join(root, 'dist/signal'));
  assert.deepEqual(JSON.parse(await readFile(path.join(direct.outputDir, 'digests.json'), 'utf8')), []);
  const normal = await main([], options);
  assert.equal(normal.outputDir, path.join(root, 'public/signal'));
  for (const args of [['--output'], ['--output', '--unknown'], ['--output', ''], ['--unknown'], ['dist'], ['--output', 'dist', 'extra']]) {
    await assert.rejects(main(args, options), /Usage: node scripts\/signal\/assets.mjs/);
  }
});