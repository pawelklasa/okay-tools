import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { configSchema, digestSchema } from '../../scripts/signal/io.mjs';

const config = JSON.parse(await readFile(new URL('../../config/signal.json', import.meta.url), 'utf8'));
const item = {
  rank: 1, title: 'Practical CSS measurements', url: 'https://example.com/study', source: 'Source',
  publishedAt: '2026-10-08T10:00:00Z', score: 80, summary: 'Independent observations about reliable interface sizing.',
  why: 'Concrete implementation evidence', tags: ['CSS', 'Craft'],
};
const digest = () => ({ date: '2026-10-08', scanned: 2, kept: 1, items: [{ ...item }] });

test('config uses the exact required reader profile and ordered tag vocabulary', () => {
  assert.equal(config.readerProfile, 'A senior product designer who writes production front-end code. Cares about: design systems and tokens, CSS and the web platform, interaction and motion craft, accessibility, colour and typography, design-engineering tooling, and how AI is changing building UI. Does not care about: generic career advice, listicles, beginner tutorials, marketing, product launches without substance, or pure back-end topics.');
  assert.deepEqual(config.tags, ['CSS', 'Design systems', 'Tokens', 'Motion', 'A11y', 'Typography', 'Colour', 'React', 'Tooling', 'AI', 'Craft', 'Product']);
  assert.deepEqual(configSchema.parse(config), config);
});

test('digest accepts only the public contract with optional successful source names', () => {
  const schema = digestSchema(config);
  assert.deepEqual(schema.parse(digest()), digest());
  const withSources = { ...digest(), sources: ['Source'] };
  assert.deepEqual(schema.parse(withSources), withSources);
  assert.deepEqual(schema.parse({ date: '2026-10-08', scanned: 0, kept: 0, items: [] }),
    { date: '2026-10-08', scanned: 0, kept: 0, items: [] });
});

test('digest strictly rejects invalid text, dates, ranks, counts, tags and internal fields', () => {
  const mutations = [
    value => { value.name = 'signal'; },
    value => { value.articles = []; },
    value => { delete value.kept; },
    value => { delete value.items; },
    value => { value.date = '2026-02-30'; },
    value => { value.date = '2026-2-01'; },
    value => { value.date = '2026-10-08T00:00:00Z'; },
    value => { value.scanned = -1; },
    value => { value.scanned = 0; },
    value => { value.scanned = '2'; },
    value => { value.kept = 0; },
    value => { value.kept = 1.5; },
    value => { value.items[0].rank = 0; },
    value => { value.items[0].rank = 2; },
    value => { value.items[0].rank = 1.5; },
    value => { value.items[0].rank = '1'; },
    value => { value.items.push({ ...item }); value.kept = 2; },
    value => { value.items = Array.from({ length: 11 }, (_, index) => ({ ...item, rank: index + 1 })); value.scanned = 11; value.kept = 11; },
    value => { value.items[0].id = 'internal'; },
    value => { value.items[0].canonical = item.url; },
    value => { value.items[0].weight = 1; },
    value => { value.items[0].title = ' '; },
    value => { value.items[0].title = '<b>Title</b>'; },
    value => { value.items[0].source = ''; },
    value => { value.items[0].publishedAt = '2026-02-30T10:00:00Z'; },
    value => { value.items[0].publishedAt = '2026-10-08'; },
    value => { value.items[0].url = 'javascript:alert(1)'; },
    value => { value.items[0].score = 80.5; },
    value => { value.items[0].score = 101; },
    value => { value.items[0].summary = 'word '.repeat(41).trim(); },
    value => { value.items[0].summary = '<p>Summary</p>'; },
    value => { value.items[0].summary = ' '; },
    value => { value.items[0].why = 'word '.repeat(13).trim(); },
    value => { value.items[0].why = '<b>Reason</b>'; },
    value => { value.items[0].tags = ['css']; },
    value => { value.items[0].tags = ['CSS', 'CSS']; },
    value => { value.sources = ['Source', 'Source']; },
    value => { value.sources = [{ name: 'Source' }]; },
  ];
  for (const mutate of mutations) {
    const value = digest();
    mutate(value);
    assert.throws(() => digestSchema(config).parse(value));
  }
});