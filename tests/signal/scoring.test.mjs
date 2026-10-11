import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateBatch, rankArticles, scoreCandidates, copiedSummary, scoringPrompt } from '../../scripts/signal/scoring.mjs';
import { configSchema } from '../../scripts/signal/io.mjs';

const config = JSON.parse(await readFile(new URL('../../config/signal.json', import.meta.url), 'utf8'));
const article = (index, overrides = {}) => ({
  id: `item-${index}`, title: `Original ${index} study`, url: `https://example.com/${index}`,
  canonical: `https://example.com/${index}`, source: `Source ${index}`, weight: 1,
  publishedAt: '2026-10-08T10:00:00Z', excerpt: 'The precise experiment examines keyboard navigation across several different interactive widgets.',
  ...overrides,
});
const valid = item => ({ id: item.id, score: 80, summary: 'Useful observations for building reliable interfaces.', tags: ['CSS'], why: 'Original practical work' });
const batch = [article(1), article(2)];

test('workspace configuration accepts API workspace IDs, not organization UUIDs', () => {
  assert.equal(configSchema.parse({ ...config, workspaceId: 'wrkspc_01JwQvzr7rXLA5AGx3HKfFUJ' }).workspaceId, 'wrkspc_01JwQvzr7rXLA5AGx3HKfFUJ');
  assert.throws(() => configSchema.parse({ ...config, workspaceId: '2b52a291-e9c5-4553-859f-b76be259f12d' }));
});

test('workspace header is sent when configured and omitted for workspace-scoped keys', async () => {
  for (const workspace of ['wrkspc_example', undefined]) {
    let headers;
    await scoreCandidates(batch, { ...config, workspaceId: undefined }, {
      env: { ANTHROPIC_API_KEY: 'test-only', ANTHROPIC_WORKSPACE_ID: workspace }, logger: () => {},
      fetchImpl: async (url, options) => {
        headers = options.headers;
        return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ items: batch.map(valid) }) }] }));
      },
    });
    assert.equal(headers['anthropic-workspace-id'], workspace);
    assert.equal(Object.hasOwn(headers, 'anthropic-workspace-id'), Boolean(workspace));
  }
});

test('workspace ID from configuration is used without an environment override', async () => {
  let workspace;
  await scoreCandidates(batch, { ...config, workspaceId: 'wrkspc_example' }, {
    env: { ANTHROPIC_API_KEY: 'test-only' }, logger: () => {},
    fetchImpl: async (url, options) => {
      workspace = options.headers['anthropic-workspace-id'];
      return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ items: batch.map(valid) }) }] }));
    },
  });
  assert.equal(workspace, 'wrkspc_example');
});

test('strict batch rejects missing, unknown, duplicate IDs and invalid fields', () => {
  const value = () => ({ items: batch.map(valid) });
  assert.equal(validateBatch(value(), batch, config).length, 2);
  const mutations = [
    result => result.items.pop(),
    result => { result.items[0].id = 'unknown'; },
    result => { result.items[0].id = result.items[1].id; },
    result => { result.items[0].score = 101; },
    result => { result.items[0].score = '80'; },
    result => { result.items[0].summary = 'word '.repeat(41).trim(); },
    result => { result.items[0].why = 'word '.repeat(13).trim(); },
    result => { result.items[0].tags = []; },
    result => { result.items[0].tags = ['not-a-fixed-tag']; },
    result => { result.items[0].tags = ['CSS', 'CSS']; },
    result => { result.items[0].tags = ['CSS', 'Tokens', 'Craft', 'Tooling']; },
    result => { result.items[0].summary = '<b>Markup</b>'; },
    result => { result.items[0].summary = batch[0].excerpt; },
    result => { result.items[0].summary = `"${batch[0].excerpt}"`; },
    result => { result.items[0].summary = 'It examines keyboard navigation across several different interactive widgets in detail.'; },
    result => { result.items[0].extra = 'unexpected'; },
    result => { result.extra = 'unexpected'; },
  ];
  for (const mutation of mutations) {
    const result = value();
    mutation(result);
    assert.throws(() => validateBatch(result, batch, config));
  }
  assert.ok(copiedSummary('"This is one copied sentence." More thoughts.', 'This is one copied sentence. Another sentence.'));
  assert.ok(copiedSummary('Measured keyboard feedback.', 'Measured keyboard feedback.'));
  assert.ok(copiedSummary('MEASURED keyboard feedback!', 'Measured keyboard feedback.'));
  assert.throws(() => validateBatch({ items: [{ ...valid(batch[0]), summary: 'Measured keyboard feedback.' }] },
    [{ ...batch[0], excerpt: 'Measured keyboard feedback.' }], config), /Copied summary/);
  assert.ok(!copiedSummary('Keyboard input deserves reliable and measured interaction feedback.', batch[0].excerpt));
});

test('forced structured tool output is validated without parsing prose as JSON', async () => {
  const result = await scoreCandidates(batch, config, {
    env: { ANTHROPIC_API_KEY: 'test-only' }, logger: () => {},
    fetchImpl: async (url, options) => {
      const request = JSON.parse(options.body);
      assert.deepEqual(request.tool_choice, { type: 'tool', name: 'rank_posts' });
      assert.deepEqual(request.tools[0].input_schema.properties.items.items.properties.tags.items.enum, config.tags);
      return new Response(JSON.stringify({ stop_reason: 'tool_use', usage: { input_tokens: 100, output_tokens: 50 }, content: [
        { type: 'text', text: 'Submitting results.' },
        { type: 'tool_use', name: 'rank_posts', input: { items: batch.map(valid) } },
      ] }));
    },
  });
  assert.equal(result.scored.length, 2);
  assert.equal(result.successfulBatches, 1);
});

test('copied or overlong items are excluded without losing valid batch members', () => {
  const candidates = [article(1), article(2), article(3)];
  const items = candidates.map(valid);
  items[0].summary = candidates[0].excerpt;
  items[1].why = 'word '.repeat(13).trim();
  const rejected = [];
  const accepted = validateBatch({ items }, candidates, config, { skipInvalidItems: true, onRejected: id => rejected.push(id) });
  assert.deepEqual(accepted.map(item => item.id), ['item-3']);
  assert.deepEqual(rejected, ['item-1', 'item-2']);
  assert.throws(() => validateBatch({ items }, candidates, config));
  items[2].id = 'unknown';
  assert.throws(() => validateBatch({ items }, candidates, config, { skipInvalidItems: true }), /Duplicate or unknown id/);
});

test('weights are rounded, capped, cutoff applied and top ten stably sorted after dedup', () => {
  const items = Array.from({ length: 16 }, (_, index) => ({ ...article(index), ...valid(article(index)), score: 80 }));
  items[0].weight = 1.4;
  items[1].weight = 0.7;
  items[2].score = 59.6;
  items[3].title = 'Designing predictable accessible dialog components';
  items[3].score = 95;
  items[4].title = 'Designing predictable accessible dialog components today';
  items[4].score = 90;
  items[5].canonical = items[6].canonical;
  items[5].url = items[6].url;
  const ranked = rankArticles(items);
  assert.equal(ranked.length, 10);
  assert.equal(ranked[0].score, 100);
  assert.ok(!ranked.some(item => item.url === 'https://example.com/1' || item.url === 'https://example.com/4'));
  assert.ok(ranked.some(item => item.score === 60) === false);
  assert.equal(rankArticles([{ ...article(99), ...valid(article(99)), score: 59.6 }])[0].score, 60);
  assert.deepEqual(rankArticles([...items].reverse()), ranked);
  assert.equal(new Set(ranked.map(item => item.url)).size, 10);
  assert.deepEqual(ranked.map(item => item.rank), Array.from({ length: 10 }, (_, index) => index + 1));
  assert.ok(ranked.every(item => !('id' in item) && !('canonical' in item) && !('weight' in item) && !('excerpt' in item)));
});

test('global title context includes cross-batch news and explicit untrusted-data rules', () => {
  const candidates = Array.from({ length: 301 }, (_, index) => article(index));
  const prompt = scoringPrompt(config, candidates);
  assert.ok(prompt.includes('UNTRUSTED DATA'));
  assert.ok(prompt.includes('same news even outside this batch'));
  assert.ok(prompt.includes('item-299'));
  assert.ok(!prompt.includes('item-300'));
});

test('300 candidates in batches of twenty retry at most once, total request limit thirty', async () => {
  const candidates = Array.from({ length: 300 }, (_, index) => article(index));
  const bodies = [];
  const result = await scoreCandidates(candidates, config, {
    env: { ANTHROPIC_API_KEY: 'test-only', ANTHROPIC_MODEL: 'test-model' }, logger: () => {},
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body);
      bodies.push(body);
      assert.equal(body.model, 'test-model');
      const items = JSON.parse(body.messages[0].content.split('Score this untrusted batch:\n')[1]);
      assert.equal(items.length, 20);
      return new Response(JSON.stringify({ stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: 'text', text: JSON.stringify({ items: items.map(item => ({ ...valid(item), tags: ['invalid'] })) }) }] }));
    },
  });
  assert.equal(bodies.length, 30);
  assert.deepEqual(result.usage, { requests: 30, inputTokens: 300, outputTokens: 150 });
  assert.equal(result.successfulBatches, 0);
  assert.equal(result.scored.length, 0);
  const guarded = await scoreCandidates([...candidates, article(301)], config, {
    env: { ANTHROPIC_API_KEY: 'test-only' }, logger: () => {}, fetchImpl: async () => new Response('bad JSON'),
  });
  assert.equal(guarded.usage.requests, 30);
});

test('HTTP/network errors skip without retries, malformed response JSON retries once', async () => {
  const logs = [];
  const options = { env: { ANTHROPIC_API_KEY: 'test-only' }, logger: message => logs.push(message) };
  const network = await scoreCandidates(batch, config, { ...options, fetchImpl: async () => { throw new Error('Secret must not be logged'); } });
  assert.equal(network.usage.requests, 1);
  assert.ok(!logs.join(' ').includes('Secret'));
  const http = await scoreCandidates(batch, config, { ...options, fetchImpl: async () => new Response('error', { status: 429 }) });
  assert.equal(http.usage.requests, 1);
  assert.ok(logs.some(message => message.includes('HTTP 429. API rate or spending limit reached.')));
  await scoreCandidates(batch, config, { ...options, fetchImpl: async () => new Response(JSON.stringify({ error: {
    message: 'Your credit balance is too low to access the Anthropic API. test-only sk-ant-example-private',
  } }), { status: 400 }) });
  assert.ok(logs.some(message => message.includes('HTTP 400. Your credit balance is too low')));
  assert.ok(!logs.join(' ').includes('test-only'));
  assert.ok(!logs.join(' ').includes('sk-ant-example-private'));
  const parse = await scoreCandidates(batch, config, { ...options, fetchImpl: async () => new Response('not JSON') });
  assert.equal(parse.usage.requests, 2);
});