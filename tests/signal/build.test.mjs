import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, cp, symlink, realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import { buildSignal } from '../../scripts/signal/build.mjs';
import { fetchText } from '../../scripts/signal/feeds.mjs';

const config = JSON.parse(await readFile(new URL('../../config/signal.json', import.meta.url), 'utf8'));
const now = new Date('2026-10-08T12:00:00Z');
const recent = '2026-10-08T10:00:00Z';
const sources = [
  { name: 'RSS', site: 'https://rss.example/', feed: 'https://rss.example/feed', weight: 1 },
  { name: 'Atom', site: 'https://atom.example/', feed: 'https://atom.example/feed', weight: 1 },
  { name: 'Broken', site: 'https://broken.example/', feed: 'https://broken.example/feed', weight: 1 },
  { name: 'Excluded', site: 'https://excluded.example/', feed: null, weight: 1 },
];
const xmlEscape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function rss(items) {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title><link>https://rss.example</link><description>Test feed</description>${items.map(item => `<item><title>${xmlEscape(item.title)}</title><link>${xmlEscape(item.url)}</link><pubDate>${item.date || recent}</pubDate><description>${xmlEscape(item.excerpt || 'A concrete demonstration of a new interface technique.')}</description></item>`).join('')}</channel></rss>`;
}
function atom() {
  return `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title><id>https://atom.example/</id><updated>${recent}</updated><entry><title>Measuring keyboard navigation latency</title><id>https://atom.example/post</id><link href="https://atom.example/post"/><updated>${recent}</updated><summary>Measurements for interactive components.</summary></entry></feed>`;
}
function apiResponse(body, mutate = value => value) {
  const request = JSON.parse(body);
  const items = JSON.parse(request.messages[0].content.split('Score this untrusted batch:\n')[1]);
  const value = mutate({ items: items.map(item => ({ id: item.id, score: 80, summary: 'An independent practical review for interface builders.', tags: ['CSS'], why: 'Concrete implementation details' })) });
  return new Response(JSON.stringify({ stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 }, content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] }));
}
async function setup(context, selected = sources) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'signal-test-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'config'));
  await writeFile(path.join(root, 'config/signal.json'), JSON.stringify(config));
  await writeFile(path.join(root, 'config/signal-sources.json'), JSON.stringify(selected));
  const logs = [];
  return { root, now, logger: message => logs.push(message), env: { ANTHROPIC_API_KEY: 'test-only' }, logs };
}
const normalRss = () => rss([
  { title: 'Understanding responsive container measurements', url: 'https://rss.example/new?utm_source=test' },
  { title: 'Expired article', url: 'https://rss.example/old', date: '2026-10-06T23:59:59Z' },
  { title: 'Window boundary', url: 'https://rss.example/boundary', date: '2026-10-07T00:00:00Z' },
  { title: 'Future article', url: 'https://rss.example/future', date: '2026-10-08T12:00:01Z' },
  { title: 'Missing date', url: 'https://rss.example/no-date', date: 'invalid' },
  { title: 'Unsafe article', url: 'javascript:alert(1)' },
]);
function fixtureFetch(api = apiResponse) {
  return async (url, options) => {
    if (url === 'https://api.anthropic.com/v1/messages') return api(options.body);
    if (url === sources[0].feed) return new Response(normalRss());
    if (url === sources[1].feed) return new Response(atom());
    if (url === sources[2].feed) return new Response('<rss><channel><item>broken');
    throw new Error('Unexpected HTTP request');
  };
}

test('mock HTTP RSS + Atom, malformed feed isolation, window, scanned count, dry run', async context => {
  const options = await setup(context);
  const result = await buildSignal({ ...options, dryRun: true, fetchImpl: fixtureFetch() });
  assert.equal(result.status, 'dry-run');
  assert.equal(result.digest.scanned, 6);
  assert.deepEqual(result.digest.sources, ['RSS', 'Atom']);
  assert.equal(result.digest.kept, 3);
  assert.equal(result.digest.items.length, 3);
  assert.deepEqual(Object.keys(result.digest).sort(), ['date', 'items', 'kept', 'scanned', 'sources']);
  assert.deepEqual(result.digest.items.map(item => item.rank), [1, 2, 3]);
  for (const item of result.digest.items) {
    assert.deepEqual(Object.keys(item).sort(), ['publishedAt', 'rank', 'score', 'source', 'summary', 'tags', 'title', 'url', 'why']);
  }
  assert.ok(result.digest.items.every(article => !/Expired|Future|Missing/.test(article.title)));
  assert.ok(options.logs.some(message => message.includes('null feed, excluded')));
  assert.ok(options.logs.some(message => message.includes('Broken: feed fetch')));
  assert.deepEqual(result.usage, { requests: 1, inputTokens: 100, outputTokens: 50 });
  assert.deepEqual((await readdir(options.root)).sort(), ['config']);
});

test('scoring uses its own deadline rather than the shorter feed timeout', async context => {
  const options = await setup(context);
  const result = await buildSignal({ ...options, dryRun: true, timeoutMs: 10, scoringTimeoutMs: 500,
    fetchImpl: fixtureFetch(async body => {
      await new Promise(resolve => setTimeout(resolve, 30));
      return apiResponse(body);
    }),
  });
  assert.equal(result.digest.kept, 3);
  assert.equal(result.usage.requests, 1);
});

test('invalid scoring batch retries once and accounts for both token usages', async context => {
  const options = await setup(context);
  const invalidFields = [
    { tags: ['unknown'] },
    { summary: 'word '.repeat(41).trim() },
    { why: 'word '.repeat(13).trim() },
  ];
  for (const fields of invalidFields) {
    let requests = 0;
    const result = await buildSignal({ ...options, dryRun: true, fetchImpl: fixtureFetch(body => {
      requests += 1;
      return apiResponse(body, value => requests === 1 ? { items: value.items.map(item => ({ ...item, ...fields })) } : value);
    }) });
    assert.equal(result.digest.items.length, 3);
    assert.deepEqual(result.usage, { requests: 2, inputTokens: 200, outputTokens: 100 });
  }
});

test('copied summaries are excluded while other valid batch items survive without retries', async context => {
  const options = await setup(context);
  for (const summary of ['"A concrete demonstration of a new interface technique."', 'A concrete demonstration of a new interface technique.']) {
    const result = await buildSignal({ ...options, dryRun: true, fetchImpl: fixtureFetch(body =>
      apiResponse(body, value => ({ items: value.items.map(item => ({ ...item, summary })) }))) });
    assert.equal(result.digest.items.length, 1);
    assert.ok(options.logs.some(message => message.includes('excluded (Copied summary)')));
    assert.deepEqual(result.usage, { requests: 1, inputTokens: 100, outputTokens: 50 });
  }
});

test('all feed/scoring failures never publish; successful zero kept can publish', async context => {
  const options = await setup(context);
  const feeds = await buildSignal({ ...options, fetchImpl: async () => new Response('broken') });
  assert.equal(feeds.status, 'feeds-failed');
  const failed = await buildSignal({ ...options, fetchImpl: fixtureFetch(body => apiResponse(body, () => 'not JSON')) });
  assert.equal(failed.status, 'scoring-failed');
  assert.equal(failed.usage.requests, 2);
  await assert.rejects(readdir(path.join(options.root, 'data/signal')), { code: 'ENOENT' });
  const zero = await buildSignal({ ...options, fetchImpl: fixtureFetch(body => apiResponse(body, value => ({ items: value.items.map(item => ({ ...item, score: 20 })) }))) });
  assert.equal(zero.status, 'published');
  assert.deepEqual(zero.digest.items, []);
  assert.equal(zero.digest.kept, 0);
});

test('publication is exclusive, reruns do no HTTP, history blocks URLs and near titles', async context => {
  const options = await setup(context, [sources[0]]);
  const first = await buildSignal({ ...options, fetchImpl: fixtureFetch() });
  const file = path.join(options.root, 'data/signal/2026-10-08.json');
  const before = await readFile(file, 'utf8');
  const rerun = await buildSignal({ ...options, fetchImpl: () => { throw new Error('No rerun HTTP'); } });
  assert.equal(rerun.status, 'existing');
  assert.equal(await readFile(file, 'utf8'), before);
  assert.deepEqual(rerun.digest, first.digest);
  const next = await buildSignal({ ...options, now: new Date('2026-10-09T00:00:00Z'), dryRun: true, fetchImpl: async url => {
    assert.equal(url, sources[0].feed);
    return new Response(rss([
      { title: 'Different wording', url: 'http://www.rss.example/new?utm_source=other' },
      { title: 'Understanding responsive container measurements today', url: 'https://rss.example/different' },
    ]));
  } });
  assert.equal(next.digest.items.length, 0);
  assert.equal(next.digest.kept, 0);
  assert.equal(next.usage.requests, 0);
});

test('history parse errors fail closed before fetching', async context => {
  const options = await setup(context);
  await mkdir(path.join(options.root, 'data/signal'), { recursive: true });
  await writeFile(path.join(options.root, 'data/signal/2026-10-07.json'), '{broken');
  await assert.rejects(buildSignal({ ...options, fetchImpl: () => assert.fail('Must not fetch') }), /Invalid or unreadable Signal history/);
});

test('timeout covers response body as well as headers', async () => {
  await assert.rejects(fetchText('https://example.com', {
    timeoutMs: 15, fetchImpl: async () => ({ ok: true, text: () => new Promise(() => {}) }),
  }), /timed out/);
});

test('build caps LLM input at 300 and fairly includes newest items from both sources', async context => {
  const options = await setup(context, sources.slice(0, 2));
  const batches = [];
  const fetchImpl = async (url, request) => {
    if (url === 'https://api.anthropic.com/v1/messages') {
      const body = JSON.parse(request.body);
      batches.push(JSON.parse(body.messages[0].content.split('Score this untrusted batch:\n')[1]));
      return apiResponse(request.body);
    }
    const source = sources.find(item => item.feed === url);
    return new Response(rss(Array.from({ length: 400 }, (_, index) => ({
      title: `${source.name} ${index} report`, url: `${source.site}${index}`,
      date: new Date(Date.parse(recent) - index * 1000).toISOString(),
    }))));
  };
  const result = await buildSignal({ ...options, dryRun: true, fetchImpl });
  assert.equal(result.digest.scanned, 800);
  assert.equal(batches.length, 15);
  assert.ok(batches.every(batch => batch.length === 20));
  const items = batches.flat();
  assert.equal(items.length, 300);
  assert.equal(items.filter(item => item.source === 'RSS').length, 150);
  assert.equal(items.filter(item => item.source === 'Atom').length, 150);
  assert.deepEqual(items.slice(0, 2).map(item => item.title), ['RSS 0 report', 'Atom 0 report']);
  assert.equal(result.digest.items.length, 10);
  assert.equal(result.digest.kept, 10);
  assert.deepEqual(result.digest.items.map(item => item.rank), Array.from({ length: 10 }, (_, index) => index + 1));
});

test('canonical and near-title duplicates in feeds are scored only once', async context => {
  const options = await setup(context, [sources[0]]);
  let scoredCount = 0;
  const fetchImpl = async (url, request) => {
    if (url === 'https://api.anthropic.com/v1/messages') {
      const body = JSON.parse(request.body);
      scoredCount += JSON.parse(body.messages[0].content.split('Score this untrusted batch:\n')[1]).length;
      return apiResponse(request.body);
    }
    return new Response(rss([
      { title: 'Practical accessible form validation strategies', url: 'https://rss.example/original' },
      { title: 'Practical accessible form validation strategies today', url: 'https://rss.example/duplicate' },
      { title: 'An entirely different title', url: 'http://www.rss.example/original?utm_campaign=test' },
    ]));
  };
  const result = await buildSignal({ ...options, dryRun: true, fetchImpl });
  assert.equal(result.digest.scanned, 3);
  assert.equal(scoredCount, 1);
  assert.equal(result.digest.items.length, 1);
});

test('missing API key logs actionable instructions and never publishes candidates', async context => {
  const options = await setup(context);
  const result = await buildSignal({ ...options, env: {}, fetchImpl: fixtureFetch() });
  assert.equal(result.status, 'scoring-failed');
  assert.equal(result.digest, null);
  assert.equal(result.usage.requests, 0);
  assert.ok(options.logs.some(message => message.includes('missing ANTHROPIC_API_KEY') && message.includes('Set it in the environment')));
  await assert.rejects(readdir(path.join(options.root, 'data/signal')), { code: 'ENOENT' });
});

test('successful feeds with zero candidates publish an empty digest without an API key', async context => {
  const options = await setup(context, [sources[0]]);
  const result = await buildSignal({ ...options, env: {}, fetchImpl: async url => {
    assert.equal(url, sources[0].feed);
    return new Response(rss([]));
  } });
  assert.equal(result.status, 'published');
  assert.deepEqual(result.digest, { date: '2026-10-08', scanned: 0, kept: 0, sources: ['RSS'], items: [] });
  assert.equal(result.usage.requests, 0);
  assert.deepEqual(JSON.parse(await readFile(path.join(options.root, 'data/signal/2026-10-08.json'), 'utf8')), result.digest);
});

test('real build CLI exits unsuccessfully with actionable missing-key logs and no publication', async context => {
  const { root } = await setup(context, [sources[0]]);
  await cp(new URL('../../scripts/signal/', import.meta.url), path.join(root, 'scripts/signal'), { recursive: true });
  await symlink(new URL('../../node_modules/', import.meta.url), path.join(root, 'node_modules'), 'dir');
  const mock = path.join(root, 'mock-fetch.mjs');
  await writeFile(mock, `globalThis.fetch = async () => new Response(${JSON.stringify(rss([
    { title: 'Practical CSS measurements', url: 'https://rss.example/new', date: new Date().toISOString() },
  ]))});`);
  await assert.rejects(promisify(execFile)(process.execPath, ['--import', mock, await realpath(path.join(root, 'scripts/signal/build.mjs'))], {
    cwd: root, env: { ...process.env, ANTHROPIC_API_KEY: '' },
  }), error => {
    assert.equal(error.code, 1);
    assert.match(error.stdout, /missing ANTHROPIC_API_KEY/);
    assert.match(error.stdout, /Set it in the environment/);
    assert.match(error.stdout, /not publishing/);
    assert.doesNotMatch(`${error.stdout}${error.stderr}`, /Signal build failed; check configuration/);
    return true;
  });
  await assert.rejects(readdir(path.join(root, 'data/signal')), { code: 'ENOENT' });
});