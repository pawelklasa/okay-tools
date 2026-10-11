import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import lighthouse from 'lighthouse';

const root = fileURLToPath(new URL('../', import.meta.url));
const basePath = `/${(process.env.SIGNAL_BASE_PATH ?? '/okay-tools/').split('/').filter(Boolean).join('/')}/`.replace('//', '/');
const signalUrl = new URL(process.env.SIGNAL_TEST_URL ?? `http://127.0.0.1:5193${basePath}signal`);
assert.match(signalUrl.pathname, /\/signal\/?$/, 'SIGNAL_TEST_URL must point to the clean latest Signal route');
const homeUrl = new URL(signalUrl.href);
homeUrl.pathname = signalUrl.pathname.replace(/signal\/?$/, '');
homeUrl.hash = '/';
const artifacts = await mkdtemp(path.join(os.tmpdir(), 'signal-ui-'));
const now = new Date();
const dates = [0, 1, 2].map(offset => new Date(now.getTime() - offset * 86400000).toISOString().slice(0, 10));
const tags = ['Design systems', 'Typography', 'Tooling'];
const digests = dates.map(date => ({
  date, scanned: 237, kept: 10, sources: ['Measured interfaces', 'CSS field notes'],
  items: Array.from({ length: 10 }, (_, index) => ({
    rank: index + 1, score: 98 - index,
    title: `${date} study ${index + 1}: Measuring resilient design systems and extraordinarilylongunbrokeninterfacetitles${'x'.repeat(65)}`,
    url: `https://example.com/signal/${date}/${index + 1}`,
    source: 'Measured interfaces with an unusually descriptive publication name',
    publishedAt: `${date}T00:00:00.000Z`,
    summary: 'Independent measurements explain how narrow reading layouts remain useful with lengthy article titles, descriptive source names, and detailed summaries. Concrete observations distinguish wrapping from hidden overflow across small and large screens.',
    why: 'Practical measurements demonstrate resilient reading layouts across real viewport sizes.',
    tags,
  })),
}));
const report = { url: signalUrl.href, basePath, artifacts, checks: [], screenshots: [], lighthouse: [] };
let preview;
let browser;
let auditBrowser;

async function check(name, action) {
  try {
    await action();
    report.checks.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, passed: false, error: error.stack ?? String(error) });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

async function startPreview() {
  if (process.env.SIGNAL_TEST_URL) return;
  assert.ok(existsSync(path.join(root, 'dist/index.html')), 'Run npm run build before this test');
  preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '5193', '--strictPort'], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(basePath === '/' ? { NETLIFY: 'true' } : {}) },
  });
  await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => finish(new Error(`Preview readiness timed out: ${output}`)), 30000);
    const onData = data => {
      output += data.toString().replace(/\u001b\[[0-9;]*m/g, '');
      if (/Local:\s+http:\/\/127\.0\.0\.1:5193\//.test(output)) finish();
    };
    const onExit = code => finish(new Error(`Preview exited (${code}): ${output}`));
    const onError = error => finish(error);
    function finish(error) {
      clearTimeout(timer);
      preview.stdout.off('data', onData);
      preview.stderr.off('data', onData);
      preview.off('exit', onExit);
      preview.off('error', onError);
      if (error) reject(error); else resolve();
    }
    preview.stdout.on('data', onData);
    preview.stderr.on('data', onData);
    preview.once('exit', onExit);
    preview.once('error', onError);
  });
}

async function stopPreview() {
  if (!preview?.pid) return;
  const closed = preview.exitCode === null ? once(preview, 'close') : Promise.resolve();
  const kill = signal => {
    try { process.kill(-preview.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  kill('SIGTERM');
  const timer = setTimeout(() => kill('SIGKILL'), 5000);
  try { await closed; } finally { clearTimeout(timer); }
}

async function snapshot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  const destination = path.join(artifacts, `${name}.png`);
  await page.screenshot({ path: destination, fullPage: true });
  report.screenshots.push(destination);
  console.log(`SCREENSHOT ${destination}`);
}

async function axe(page, name, selector) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']);
  if (selector) builder.include(selector);
  const result = await builder.analyze();
  await writeFile(path.join(artifacts, `axe-${name}.json`), JSON.stringify(result, null, 2));
  assert.deepEqual(result.violations.map(violation => ({
    id: violation.id, impact: violation.impact,
    nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })),
  })), [], `Axe violations (${name}${selector ? `, scoped to ${selector}` : ', whole page'})`);
}

async function layout(page, mobile) {
  const geometry = await page.evaluate(() => {
    const rect = element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height, right: x + width, bottom: y + height };
    };
    return {
      width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      rows: [...document.querySelectorAll('.signal-row')].map(row => ({
        rank: rect(row.querySelector('.signal-rank')), article: rect(row.querySelector('article')),
        tagWrap: getComputedStyle(row.querySelector('article > div')).flexWrap,
        tags: [...row.querySelectorAll('article > div > span')].map(rect),
      })),
      logo: rect(document.querySelector('header a[aria-label="okay.tools home"]')),
      controls: [rect(document.querySelector('[aria-label="Buy me a coffee"]')),
        rect(document.querySelector('[aria-label="Get notified when new tools ship"]'))],
    };
  });
  assert.equal(geometry.documentWidth, geometry.width, 'Document must not overflow horizontally');
  assert.equal(geometry.rows.length, 10);
  for (const row of geometry.rows) {
    if (mobile) assert.ok(row.rank.bottom <= row.article.y, 'Mobile rank must sit above article');
    else assert.ok(row.rank.right <= row.article.x, 'Desktop rank must sit left of article');
    assert.equal(row.tags.length, tags.length);
    assert.equal(row.tagWrap, 'wrap', 'Tag containers must permit wrapping');
    for (const tag of row.tags) assert.ok(tag.x >= row.article.x - 1 && tag.right <= row.article.right + 1, 'Tags must wrap within article');
  }
  for (const control of geometry.controls) {
    assert.ok(geometry.logo.right <= control.x || control.right <= geometry.logo.x || geometry.logo.bottom <= control.y || control.bottom <= geometry.logo.y,
      `Logo overlaps fixed control: ${JSON.stringify({ logo: geometry.logo, control })}`);
  }
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function dashboardLayout(page) {
  const geometry = await page.evaluate(() => {
    const rect = element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, right: x + width, bottom: y + height };
    };
    const header = document.querySelector('.dashboard-header');
    const logo = document.querySelector('header a[aria-label="okay.tools home"]');
    const coffee = document.querySelector('[aria-label="Buy me a coffee"]');
    const elements = [...document.querySelectorAll('.dashboard-signal h3, .dashboard-signal li a, .dashboard-signal li a > p:not(.dashboard-signal-why), .dashboard-metrics > :is(a, div), .dashboard-evidence code, .dashboard-finding-list p, .dashboard-tool h4, .dashboard-description')];
    return {
      width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      headerPosition: getComputedStyle(header).position,
      coffeeCount: document.querySelectorAll('[aria-label="Buy me a coffee"]').length,
      logoCount: document.querySelectorAll('header a[aria-label="okay.tools home"]').length,
      logo: rect(logo), coffee: rect(coffee),
      controls: [...header.querySelectorAll('nav button, nav a')].map(rect),
      floating: [...document.querySelectorAll('.dashboard *')].filter(element => getComputedStyle(element).position === 'fixed').map(element => element.className),
      overflow: elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => ({ selector: element.className || element.tagName, text: element.textContent, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth })),
    };
  });
  assert.equal(geometry.documentWidth, geometry.width, 'Dashboard must not overflow the viewport');
  assert.equal(geometry.coffeeCount, 1, 'Homepage must have exactly one coffee control');
  assert.equal(geometry.logoCount, 1, 'Homepage must have exactly one header logo');
  assert.ok(['static', 'relative'].includes(geometry.headerPosition), 'Dashboard header must remain in flow');
  assert.deepEqual(geometry.floating, [], 'Homepage must not have floating controls');
  const controls = [geometry.logo, ...geometry.controls, geometry.coffee];
  for (const [index, control] of controls.entries()) {
    assert.ok(control.x >= -1 && control.right <= geometry.width + 1, 'Header control must fit viewport');
    for (const other of controls.slice(index + 1)) {
      assert.ok(control.right <= other.x + 1 || other.right <= control.x + 1 || control.bottom <= other.y + 1 || other.bottom <= control.y + 1,
        `Header controls overlap: ${JSON.stringify({ control, other })}`);
    }
  }
  assert.deepEqual(geometry.overflow, [], 'Dashboard titles, sources, evidence and findings must fit their containers');
}

async function sparseDashboardLayout(page, mobile) {
  await dashboardLayout(page);
  const geometry = await page.evaluate(() => {
    const rect = element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height, right: x + width, bottom: y + height };
    };
    return {
      feed: rect(document.querySelector('.dashboard-signal')),
      sidebar: rect(document.querySelector('.dashboard-studio')),
      rows: [...document.querySelectorAll('.dashboard-signal-rows li')].map(row => {
        const title = row.querySelector('h3');
        const style = getComputedStyle(title);
        return {
          bounds: rect(row), title: rect(title), fontSize: style.fontSize,
          clamp: style.webkitLineClamp, lineHeight: parseFloat(style.lineHeight),
          content: [...row.querySelector('a').children].map(rect),
          tags: [...row.querySelectorAll('.dashboard-tool-tags span')].map(rect),
        };
      }),
    };
  });
  assert.equal(geometry.rows.length, 2);
  for (const [index, row] of geometry.rows.entries()) {
    assert.equal(row.fontSize, '18px');
    assert.equal(row.clamp, '2', 'Sparse long titles must retain the two-line clamp');
    assert.ok(row.title.height <= row.lineHeight * 2 + 1, 'Sparse title must fit two lines');
    for (const [contentIndex, content] of row.content.entries()) {
      assert.ok(content.x >= row.bounds.x - 1 && content.right <= row.bounds.right + 1, 'Sparse row content must fit horizontally');
      assert.ok(content.y >= row.bounds.y - 1 && content.bottom <= row.bounds.bottom + 1, 'Sparse row content must fit vertically');
      const next = row.content[contentIndex + 1];
      if (next) assert.ok(content.bottom <= next.y + 1, 'Sparse title, source, summary, tags and reason must not overlap');
    }
    for (const tag of row.tags) assert.ok(tag.x >= row.bounds.x - 1 && tag.right <= row.bounds.right + 1, 'Sparse tags must wrap within the row');
    const next = geometry.rows[index + 1];
    if (next) assert.ok(row.bounds.bottom <= next.bounds.y + 1, 'Sparse digest rows must not overlap');
  }
  if (mobile) assert.ok(geometry.feed.bottom <= geometry.sidebar.y + 1, 'Mobile feed and sidebar must not overlap');
  else assert.ok(Math.max(0, geometry.sidebar.height - geometry.feed.height) <= 50,
    `Sparse sidebar must not leave more than 50px unused beside the feed: ${JSON.stringify(geometry)}`);
}

try {
  await startPreview();
  const executablePath = existsSync(chromium.executablePath()) ? chromium.executablePath()
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  assert.ok(existsSync(executablePath), 'Install Playwright Chromium or Google Chrome');
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.clock.setFixedTime(now);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  let fixture = [digests[2], digests[0], digests[1]];
  let responseStatus = 200;
  let requests = 0;
  await page.route('**/signal/digests.json', route => {
    requests += 1;
    return route.fulfill({ status: responseStatus, contentType: 'application/json', body: JSON.stringify(fixture) });
  });
  const goto = async suffix => {
    await page.goto(`${signalUrl.href.replace(/\/$/, '')}${suffix}`, { waitUntil: 'networkidle' });
    await page.getByRole('status').waitFor({ state: 'hidden' });
  };
  const expectDigest = async date => {
    await page.locator('.signal-row').first().waitFor();
    assert.equal(await page.locator('.signal-row').count(), 10);
    assert.equal(await page.locator('.signal-row h2 a').first().textContent(), `${digests.find(digest => digest.date === date).items[0].title} \u2192`);
  };

  await check('latest today: fixed ten-item manifest, counts, tags and safe titles', async () => {
    await goto('');
    await expectDigest(dates[0]);
    assert.ok(requests > 0, 'Fixture manifest must actually be requested');
    await page.getByRole('heading', { level: 1, name: 'Ten worth reading.', exact: true }).waitFor();
    assert.match(await page.locator('#signal-main').innerText(), /Scanned 237 posts from 2 sources.*Kept 10/);
    assert.equal(await page.getByText(/TODAY'S RUN HASN'T LANDED YET/).count(), 0);
    const links = await page.locator('.signal-row h2 a').evaluateAll(elements => elements.map(element => ({ href: element.href, target: element.target, rel: element.rel })));
    assert.deepEqual(links.map(link => link.href), digests[0].items.map(item => item.url));
    for (const link of links) {
      assert.equal(link.target, '_blank');
      assert.ok(link.rel.split(/\s+/).includes('noopener') && link.rel.split(/\s+/).includes('noreferrer'));
    }
    assert.deepEqual(await page.locator('.signal-row').first().locator('article > div > span').allTextContents(), tags);
  });
  await check('desktop rank, tag wrapping, width and fixed-header geometry', () => layout(page, false));
  await check('desktop populated screenshot', () => snapshot(page, 'signal-desktop'));
  await check('desktop whole-page WCAG axe', () => axe(page, 'desktop'));
  await page.setViewportSize({ width: 375, height: 812 });
  await check('375px rank above article, wrapped tags, width and header geometry', () => layout(page, true));
  await check('mobile populated screenshot', () => snapshot(page, 'signal-mobile'));
  await check('mobile whole-page WCAG axe', () => axe(page, 'mobile'));

  await check('direct dated route and Previous/Next navigation', async () => {
    await goto(`/${dates[0]}`);
    await expectDigest(dates[0]);
    await page.getByRole('link', { name: /Previous/ }).click();
    assert.equal(new URL(page.url()).pathname, `${signalUrl.pathname.replace(/\/$/, '')}/${dates[1]}`);
    await expectDigest(dates[1]);
    assert.equal(await page.getByText(/TODAY'S RUN HASN'T LANDED YET/).count(), 0, 'Dated pages must not show latest fallback notice');
    await page.getByRole('link', { name: /Next/ }).click();
    await expectDigest(dates[0]);
    assert.equal(await page.getByRole('link', { name: /Next/ }).count(), 0);
  });
  await check('direct archive, newest-first entries, date click and Latest', async () => {
    await goto('/archive');
    await page.getByRole('heading', { level: 1, name: 'The archive.' }).waitFor();
    assert.deepEqual(await page.locator('main ol time').evaluateAll(elements => elements.map(element => element.dateTime)), dates);
    await page.locator('main ol a').first().click();
    await expectDigest(dates[0]);
    await page.getByRole('link', { name: 'Latest \u2192', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, signalUrl.pathname.replace(/\/$/, ''));
    await page.getByRole('link', { name: 'Archive \u2192', exact: true }).click();
    assert.ok(page.url().endsWith('/signal/archive'));
  });
  await check('yesterday fallback and explicit dated notice behavior', async () => {
    fixture = digests.slice(1);
    await goto('');
    await expectDigest(dates[1]);
    await page.getByText("TODAY'S RUN HASN'T LANDED YET - SHOWING YESTERDAY", { exact: true }).waitFor();
    await goto(`/${dates[1]}`);
    await expectDigest(dates[1]);
    assert.equal(await page.getByText(/TODAY'S RUN HASN'T LANDED YET/).count(), 0);
  });
  await check('older fallback displays the actual digest date', async () => {
    fixture = digests.slice(2);
    await goto('');
    await expectDigest(dates[2]);
    const formatted = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${dates[2]}T00:00:00Z`));
    await page.getByText(`TODAY'S RUN HASN'T LANDED YET - SHOWING ${formatted.toUpperCase()}`, { exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: /Previous|Next/ }).count(), 0);
  });
  await check('missing date, empty latest/archive, successful zero-kept run', async () => {
    await goto('/2000-01-01');
    await page.getByRole('heading', { name: 'Not found', exact: true }).waitFor();
    await page.getByText('No digest is available for 2000-01-01.', { exact: true }).waitFor();
    fixture = [];
    await goto('');
    await page.getByRole('heading', { name: 'No digest has landed yet.', exact: true }).waitFor();
    await goto('/archive');
    await page.getByText('No digest has landed yet.', { exact: true }).waitFor();
    fixture = [{ ...digests[0], kept: 0, items: [] }];
    await goto('');
    await page.getByRole('heading', { level: 1, name: 'None worth reading.', exact: true }).waitFor();
    await page.getByText('No posts kept in this run.', { exact: true }).waitFor();
    assert.equal(await page.locator('.signal-row').count(), 0);
  });
  await check('HTTP error and Retry recover through a new manifest request', async () => {
    responseStatus = 503;
    await goto('');
    await page.getByRole('alert').filter({ hasText: 'Could not load the digests.' }).waitFor();
    responseStatus = 200;
    fixture = digests;
    const before = requests;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expectDigest(dates[0]);
    assert.equal(requests, before + 1);
    assert.equal(await page.getByRole('alert').count(), 0);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  fixture = [{ ...digests[0], kept: 2, items: digests[0].items.slice(0, 2) }];
  await check('mocked two-item homepage: sparse summaries, tags, footer, sidebar and safe links', async () => {
    await page.goto(homeUrl.href, { waitUntil: 'networkidle' });
    const feed = page.locator('.dashboard-signal');
    await feed.getByText('2 selected / 2 sources', { exact: true }).waitFor();
    assert.equal(await feed.getAttribute('data-sparse'), 'true');
    assert.equal(await feed.locator('ol li').count(), 2);
    assert.deepEqual(await feed.locator('ol h3').allTextContents(), fixture[0].items.map(item => `${item.title} \u2197`));
    assert.equal(await feed.locator('p.dashboard-signal-summary').count(), 2);
    assert.deepEqual(await feed.locator('p.dashboard-signal-summary').allTextContents(), fixture[0].items.map(item => item.summary));
    assert.equal(await feed.locator('.dashboard-tool-tags').count(), 2);
    for (const [index, item] of fixture[0].items.entries()) {
      assert.deepEqual(await feed.locator('ol li').nth(index).locator('.dashboard-tool-tags span').allTextContents(), item.tags);
    }
    const links = await feed.locator('ol li a').evaluateAll(elements => elements.map(element => ({ href: element.href, target: element.target, rel: element.rel })));
    assert.deepEqual(links.map(link => link.href), fixture[0].items.map(item => item.url));
    for (const link of links) {
      assert.equal(link.target, '_blank');
      assert.ok(link.rel.split(/\s+/).includes('noopener') && link.rel.split(/\s+/).includes('noreferrer'));
    }
    const footer = feed.locator('.dashboard-signal-bottom');
    assert.equal(await footer.getByRole('link', { name: /See all 2/ }).count(), 0);
    assert.equal(await footer.getByRole('link', { name: /Read the digest/ }).getAttribute('href'), signalUrl.pathname.replace(/\/$/, ''));
    assert.equal(await footer.getByRole('link', { name: 'RSS', exact: true }).getAttribute('href'), `${signalUrl.pathname.replace(/\/$/, '')}/rss.xml`);
    const sidebar = page.locator('.dashboard-studio');
    assert.equal(await sidebar.getByText('New tool', { exact: true }).count(), 0);
    assert.equal(await sidebar.locator('.dashboard-studio-item').count(), 1);
    await sidebar.getByText('Latest writing', { exact: true }).waitFor();
    await sparseDashboardLayout(page, false);
    await snapshot(page, 'sparse-desktop');
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await check('mocked two-item 375px homepage: long titles, width and nonoverlapping rows', async () => {
    await sparseDashboardLayout(page, true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375);
    await snapshot(page, 'sparse-mobile');
  });
  await check('mocked two-item 375px homepage whole-page WCAG axe', () => axe(page, 'sparse-mobile'));
  await check('direct Signal with same two-item fixture: count-aware heading, rows and unchanged RSS link', async () => {
    await goto('');
    await page.getByRole('heading', { level: 1, name: 'Two worth reading.', exact: true }).waitFor();
    assert.equal(await page.locator('.signal-row').count(), 2);
    assert.deepEqual(await page.locator('.signal-row h2 a').evaluateAll(elements => elements.map(element => element.href)), fixture[0].items.map(item => item.url));
    assert.equal(await page.getByRole('link', { name: /RSS/ }).getAttribute('href'), `${signalUrl.pathname.replace(/\/$/, '')}/rss.xml`);
  });
  fixture = digests;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(homeUrl.href, { waitUntil: 'networkidle' });
  await check('hash homepage dashboard has five live Signal rows, counts and safe outgoing links', async () => {
    await page.goto(homeUrl.href, { waitUntil: 'networkidle' });
    const feed = page.locator('.dashboard-signal');
    await feed.getByText('10 selected / 2 sources', { exact: true }).waitFor();
    assert.equal(await feed.getAttribute('data-sparse'), 'false');
    assert.equal(await feed.locator('p.dashboard-signal-summary, ol .dashboard-tool-tags').count(), 0);
    assert.equal(await feed.locator('ol li').count(), 5);
    assert.deepEqual(await feed.locator('ol h3').allTextContents(), digests[0].items.slice(0, 5).map(item => `${item.title} \u2197`));
    const links = await feed.locator('ol li a').evaluateAll(elements => elements.map(element => ({ href: element.href, target: element.target, rel: element.rel })));
    assert.deepEqual(links.map(link => link.href), digests[0].items.slice(0, 5).map(item => item.url));
    for (const link of links) {
      assert.equal(link.target, '_blank');
      assert.ok(link.rel.split(/\s+/).includes('noopener') && link.rel.split(/\s+/).includes('noreferrer'));
    }
    assert.equal(await feed.getByRole('link', { name: /See all 10/ }).getAttribute('href'), signalUrl.pathname.replace(/\/$/, ''));
  });
  const dashboardReport = page.locator('.dashboard-report');
  const dashboardInput = page.getByRole('textbox', { name: 'URL or CSS to check' });
  const runCheck = page.getByRole('button', { name: /Run the check/ });
  const metric = async name => Number(await dashboardReport.locator('.dashboard-metrics a').filter({ has: page.getByText(name, { exact: true }) }).locator('strong').evaluate(element => element.firstChild.textContent));
  const submitCss = async css => {
    await dashboardInput.fill(css);
    await runCheck.click();
    await page.getByRole('status').filter({ hasText: 'Check complete.' }).waitFor();
    assert.equal(await dashboardReport.getAttribute('aria-label'), 'Design system report');
    assert.equal(await dashboardReport.locator('.dashboard-report-source').textContent(), '[Pasted CSS]');
    assert.doesNotMatch(await dashboardReport.locator('.dashboard-report-top').innerText(), /sample/i);
  };
  const expectEmptyReport = async () => {
    await page.getByRole('region', { name: 'Design system report', exact: true }).waitFor();
    assert.equal(await dashboardReport.locator('.dashboard-report-source').count(), 0);
    assert.deepEqual(await dashboardReport.locator('.dashboard-metrics > div > span').allTextContents(), ['Spacing', 'Defaults', 'Costumes']);
    assert.deepEqual(await dashboardReport.locator('.dashboard-metrics strong').allTextContents(), ['\u2014', '\u2014', '\u2014']);
    assert.equal(await dashboardReport.locator('.dashboard-metrics a, .dashboard-metrics small').count(), 0);
    await dashboardReport.getByRole('heading', { name: 'Your results go here.', exact: true }).waitFor();
    await dashboardReport.getByText('No check run yet.', { exact: true }).waitFor();
    assert.equal(await dashboardReport.locator('.dashboard-evidence, .dashboard-findings').count(), 0);
    assert.doesNotMatch(await dashboardReport.innerText(), /sample|\d|checks? flagged/i);
  };
  await check('dashboard initially has no fabricated metrics, source or sample report', async () => {
    await expectEmptyReport();
    await dashboardLayout(page);
    await page.setViewportSize({ width: 375, height: 812 });
    try { await dashboardLayout(page); }
    finally { await page.setViewportSize({ width: 1440, height: 1000 }); }
  });
  await check('dashboard Audit/Build/Lab groups contain all eight hash tools', async () => {
    const groups = page.locator('.dashboard-tool-group');
    assert.equal(await groups.count(), 3);
    const expected = [
      { name: 'Audit', routes: ['drift', 'tokens', 'defaults'] },
      { name: 'Build', routes: ['color', 'generate', 'skills'] },
      { name: 'Lab', routes: ['forms', 'preflight'] },
    ];
    for (const [index, group] of expected.entries()) {
      assert.match(await groups.nth(index).locator('h3').innerText(), new RegExp(group.name, 'i'));
      assert.deepEqual(await groups.nth(index).locator('a.dashboard-tool').evaluateAll(elements => elements.map(element => new URL(element.href).hash)), group.routes.map(route => `#/${route}`));
    }
  });
  await check('dashboard desktop empty-report layout and long fixture titles', () => dashboardLayout(page));
  await check('homepage screenshot', () => snapshot(page, 'homepage-desktop'));
  await check('homepage whole-page WCAG axe', () => axe(page, 'homepage'));
  await page.setViewportSize({ width: 375, height: 812 });
  await check('375px dashboard layout, one coffee/logo and no overlaps or overflow', () => dashboardLayout(page));
  await check('mobile homepage screenshot', () => snapshot(page, 'homepage-mobile'));
  await check('mobile homepage whole-page WCAG axe', () => axe(page, 'homepage-mobile'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await check('reduced-motion navigation scrolls automatically without changing hash', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => {
      globalThis.dashboardScrollCalls = [];
      globalThis.dashboardOriginalScroll = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function(options) {
        globalThis.dashboardScrollCalls.push({ id: this.id, behavior: options?.behavior });
        return globalThis.dashboardOriginalScroll.call(this, options);
      };
    });
    try {
      for (const name of ['Tools', 'Writing', 'Check']) {
        await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true }).click();
        assert.equal(new URL(page.url()).hash, '#/');
        const section = page.locator(`#${name.toLowerCase()}`);
        assert.ok(await section.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.top < innerHeight && bounds.bottom > 0;
        }), `${name} navigation must bring its section into view`);
      }
      assert.deepEqual(await page.evaluate(() => globalThis.dashboardScrollCalls), ['tools', 'writing', 'check'].map(id => ({ id, behavior: 'auto' })));
      const transitions = await page.locator('.dashboard button').evaluateAll(elements => elements.map(element => getComputedStyle(element).transitionDuration));
      assert.ok(transitions.every(value => value.split(',').every(duration => parseFloat(duration) === 0)), `Reduced-motion transitions: ${transitions.join('; ')}`);
    } finally {
      await page.evaluate(() => {
        Element.prototype.scrollIntoView = globalThis.dashboardOriginalScroll;
        delete globalThis.dashboardOriginalScroll;
        delete globalThis.dashboardScrollCalls;
      });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }
  });

  const subscribeRequests = [];
  let subscribeStatus = 503;
  await page.route('**/api/subscribe', route => {
    subscribeRequests.push({ method: route.request().method(), body: route.request().postDataJSON() });
    return route.fulfill({ status: subscribeStatus, contentType: 'application/json', body: JSON.stringify(subscribeStatus === 200 ? { ok: true } : { error: 'unknown' }) });
  });
  await check('email validation sends nothing; server error recovers to successful subscription', async () => {
    const email = page.locator('.dashboard-email');
    const input = email.getByRole('textbox', { name: 'Email', exact: true });
    const submit = email.getByRole('button', { name: "I'm in", exact: true });
    await input.fill('not-an-email');
    await submit.click();
    await email.getByText("That doesn't look like an email.", { exact: true }).waitFor();
    assert.equal(subscribeRequests.length, 0);
    await input.fill('reader@example.com');
    assert.equal(await email.getByText("That doesn't look like an email.", { exact: true }).count(), 0);
    await submit.click();
    await email.getByText("Couldn't subscribe. Try again in a moment.", { exact: true }).waitFor();
    assert.equal(subscribeRequests.length, 1);
    subscribeStatus = 200;
    await submit.click();
    await email.getByText("Got it. You'll hear from me.", { exact: true }).waitFor();
    assert.deepEqual(subscribeRequests, Array.from({ length: 2 }, () => ({ method: 'POST', body: { email: 'reader@example.com', source: 'landing', website: '' } })));
  });
  await check('pasted CSS replaces empty report with measured spacing and token evidence', async () => {
    await submitCss(':root{--color-primary:#3b82f6;} .box{padding:8px;}');
    assert.equal(await metric('Spacing'), 1);
    assert.equal(await metric('Costumes'), 1);
    await dashboardReport.getByText('1 check flagged', { exact: true }).waitFor();
    report.dashboardPastedCss = { measuredDefaultDensity: await metric('Defaults') };
    await dashboardReport.locator('.dashboard-evidence').getByText('--color-primary', { exact: true }).waitFor();
    await dashboardReport.locator('summary').click();
    await page.setViewportSize({ width: 375, height: 812 });
    await dashboardLayout(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await dashboardReport.locator('summary').click();
  });
  await check('clean CSS produces Looks okay, zero density/costumes and zero flags', async () => {
    await submitCss('.box{padding:8px;color:red;}');
    assert.equal(await metric('Spacing'), 1);
    assert.equal(await metric('Defaults'), 0);
    assert.equal(await metric('Costumes'), 0);
    await dashboardReport.getByRole('heading', { name: 'Looks okay.', exact: true }).waitFor();
    await dashboardReport.getByText('0 checks flagged', { exact: true }).waitFor();
    await dashboardReport.getByText('Within baseline', { exact: true }).waitFor();
  });
  const urlRequests = [];
  const pendingRoutes = [];
  let urlMode = 'success';
  await page.route('**/api/fetch-url?**', route => {
    urlRequests.push(route.request().url());
    if (urlMode === 'pending') { pendingRoutes.push(route); return; }
    const html = urlMode === 'minified'
      ? '<!DOCTYPE html><html><head><meta name="desc" content="' + 'x'.repeat(150000) + '"></head><body><div class="flex p-4">Tailwind evidence</div></body></html>'
      : '<style>:root{--color-primary:#3b82f6;}</style><div style="padding:12px"></div>';
    return route.fulfill({ status: urlMode === 'error' ? 503 : 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://checked.example', css: '.box{padding:8px;}', html }) });
  });
  await check('empty input, invalid URL and unreadable CSS show errors without fetching or replacing report', async () => {
    const previous = await dashboardReport.innerText();
    for (const [value, message] of [
      ['', 'Enter a URL or paste CSS to run the check.'],
      ['foo', 'Enter a valid HTTP or HTTPS URL, or paste CSS.'],
      ['random text;', 'No readable CSS declarations found. Paste CSS or try a different URL.'],
    ]) {
      await dashboardInput.fill(value);
      await runCheck.click();
      await page.getByRole('alert').filter({ hasText: message }).waitFor();
      assert.equal(await dashboardInput.getAttribute('aria-invalid'), 'true');
      assert.equal(await dashboardReport.innerText(), previous);
    }
    assert.equal(urlRequests.length, 0);
  });
  await check('URL JSON combines stylesheet, embedded style and inline declarations', async () => {
    await dashboardInput.fill('checked.example');
    await runCheck.click();
    await dashboardReport.locator('.dashboard-report-source').getByText('[https://checked.example]', { exact: true }).waitFor();
    assert.equal(new URL(urlRequests.at(-1)).searchParams.get('url'), 'https://checked.example/');
    assert.equal(await metric('Spacing'), 2);
    assert.equal(await metric('Costumes'), 1);
    await dashboardReport.locator('.dashboard-evidence').getByText('--color-primary', { exact: true }).waitFor();
    assert.equal(await page.getByRole('alert').count(), 0);
    assert.equal(await dashboardInput.getAttribute('aria-invalid'), 'false');
  });
  await check('minified URL HTML shows bounded matched evidence, not the entire source line', async () => {
    urlMode = 'minified';
    const response = page.waitForResponse('**/api/fetch-url?**');
    await dashboardInput.fill('minified.example');
    await runCheck.click();
    const payload = await (await response).json();
    assert.ok(payload.html.length > 150000 && !payload.html.includes('\n'), 'Fixture must be a large single HTML line');
    assert.ok(payload.html.startsWith('<!DOCTYPE html>'));
    assert.ok(payload.html.indexOf('class="flex p-4"') > 150000, 'Matched classes must be at the tail, beyond metadata');
    await page.getByRole('status').filter({ hasText: 'Check complete.' }).waitFor();
    await dashboardReport.locator('.dashboard-report-source').getByText('[https://checked.example]', { exact: true }).waitFor();
    assert.equal(await metric('Spacing'), 1);
    assert.equal(await metric('Costumes'), 0);
    assert.ok(await metric('Defaults') > 0, 'Tailwind classes must trigger default evidence');
    const evidence = await dashboardReport.locator('.dashboard-evidence code').allTextContents();
    assert.ok(evidence.length > 0, 'The report must render matched default evidence');
    for (const snippet of evidence) {
      assert.ok(snippet.length <= 160, `Evidence length ${snippet.length} exceeds 160 characters`);
      assert.doesNotMatch(snippet, /doctype|<\/?(?:html|head|body|meta)\b|name="desc"|x{20}/i, 'Evidence must not show HTML or metadata source');
    }
    assert.deepEqual(evidence, ['flex'], 'Show the first matched Tailwind fingerprint, not its entire HTML line');
    report.dashboardMinified = { htmlLength: payload.html.length, evidence, layouts: [] };
    for (const [name, viewport, collapsedLimit, expandedLimit] of [
      ['desktop', { width: 1440, height: 1000 }, 650, 950],
      ['mobile', { width: 375, height: 812 }, 800, 950],
    ]) {
      await page.setViewportSize(viewport);
      await dashboardLayout(page);
      const collapsedHeight = await dashboardReport.evaluate(element => element.getBoundingClientRect().height);
      assert.ok(collapsedHeight < collapsedLimit, `${name} collapsed report height ${collapsedHeight} must be < ${collapsedLimit}`);
      await dashboardReport.locator('summary').click();
      try {
        const findings = await dashboardReport.locator('.dashboard-finding-list').evaluate(element => ({ height: element.getBoundingClientRect().height, maxHeight: getComputedStyle(element).maxHeight }));
        assert.equal(findings.maxHeight, '280px');
        assert.ok(findings.height <= 281, `${name} findings height ${findings.height} exceeds the 280px panel bound`);
        const expandedHeight = await dashboardReport.evaluate(element => element.getBoundingClientRect().height);
        assert.ok(expandedHeight <= expandedLimit, `${name} expanded report height ${expandedHeight} must be <= ${expandedLimit}`);
        report.dashboardMinified.layouts.push({ name, collapsedHeight, expandedHeight, findingsHeight: findings.height });
        await dashboardLayout(page);
        await snapshot(page, `homepage-minified-${name}`);
      } finally {
        await dashboardReport.locator('summary').click();
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await check('URL 503 retains prior real report; corrected CSS can run again', async () => {
    const previous = await dashboardReport.innerText();
    urlMode = 'error';
    await dashboardInput.fill('unavailable.example');
    await runCheck.click();
    await page.getByRole('alert').filter({ hasText: "URL checks are unavailable on this host. Paste the site's CSS instead." }).waitFor();
    assert.equal(await dashboardReport.innerText(), previous);
    assert.equal(await dashboardReport.getAttribute('aria-label'), 'Design system report');
    await submitCss('.box{padding:8px;color:red;}');
    assert.equal(await page.getByRole('alert').count(), 0);
    await dashboardReport.getByText('0 checks flagged', { exact: true }).waitFor();
  });
  await check('20-second URL timeout is deterministic and permits recovery', async () => {
    await page.clock.install({ time: now });
    urlMode = 'pending';
    const requested = page.waitForRequest('**/api/fetch-url?**');
    await dashboardInput.fill('timeout.example');
    await runCheck.click();
    await requested;
    await page.clock.fastForward(20001);
    await page.getByRole('alert').filter({ hasText: 'The check timed out after 20 seconds. Try again or paste CSS instead.' }).waitFor();
    assert.equal(await runCheck.isEnabled(), true);
    await submitCss('.box{padding:8px;color:red;}');
    assert.equal(await page.getByRole('alert').count(), 0);
    for (const route of pendingRoutes.splice(0)) await route.abort().catch(() => {});
  });
  await check('navigation aborts an in-flight URL check without browser errors', async () => {
    urlMode = 'pending';
    const requested = page.waitForRequest('**/api/fetch-url?**');
    const failed = page.waitForEvent('requestfailed', request => request.url().includes('/api/fetch-url?'));
    await dashboardInput.fill('aborted.example');
    await runCheck.click();
    await requested;
    await page.locator('.dashboard-tool').filter({ hasText: 'preflight' }).click();
    await failed;
    assert.equal(new URL(page.url()).hash, '#/preflight');
    for (const route of pendingRoutes.splice(0)) await route.abort().catch(() => {});
    await page.goto(homeUrl.href, { waitUntil: 'networkidle' });
    await expectEmptyReport();
    assert.deepEqual(pageErrors, []);
  });
  await page.unroute('**/api/fetch-url?**');
  await page.unroute('**/api/subscribe');
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of ['defaults', 'color', 'forms', 'tokens', 'generate', 'preflight', 'drift', 'skills', 'privacy']) {
    await check(`legacy hash route #/${route} remains reachable`, async () => {
      const url = new URL(homeUrl.href);
      url.hash = `/${route}`;
      await page.goto(url.href, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { level: 1 }).first().waitFor();
      assert.equal(new URL(page.url()).hash, `#/${route}`);
      if (route === 'defaults') assert.match(await page.locator('body').innerText(), /default-audit/i);
    });
  }
  await check('legacy #/ramp redirect preserves the color tool', async () => {
    await page.goto(`${homeUrl.href.replace(/#.*$/, '')}#/ramp`, { waitUntil: 'networkidle' });
    await page.waitForURL(url => url.hash === '#/color/ramp');
    assert.equal(new URL(page.url()).hash, '#/color/ramp');
    await page.getByRole('heading', { level: 1 }).first().waitFor();
  });
  await check('no browser page errors throughout fixture and legacy routes', () => assert.deepEqual(pageErrors, []));

  const port = await freePort();
  auditBrowser = await chromium.launch({ executablePath, headless: true, args: [`--remote-debugging-port=${port}`] });
  for (const formFactor of ['mobile', 'desktop']) {
    await check(`Lighthouse ${formFactor} actual production Signal accessibility >=95 (no fixtures)`, async () => {
      const measured = await auditBrowser.newPage();
      await measured.goto(signalUrl.href, { waitUntil: 'networkidle' });
      const state = await measured.locator('#signal-main').innerText();
      await measured.close();
      const result = await lighthouse(signalUrl.href, {
        port, output: ['json', 'html'], onlyCategories: ['accessibility'], disableStorageReset: true,
        formFactor, screenEmulation: { mobile: formFactor === 'mobile', width: formFactor === 'mobile' ? 375 : 1440, height: formFactor === 'mobile' ? 812 : 1000, deviceScaleFactor: 1, disabled: false },
      });
      assert.ok(result, 'Lighthouse must return a report');
      const score = result.lhr.categories.accessibility.score * 100;
      const json = path.join(artifacts, `lighthouse-${formFactor}.json`);
      const html = path.join(artifacts, `lighthouse-${formFactor}.html`);
      await writeFile(json, result.report[0]);
      await writeFile(html, result.report[1]);
      const measurement = { formFactor, score, state: state.includes('No digest has landed yet.') ? 'real empty manifest' : 'real production manifest (see state)', observedState: state, json, html };
      report.lighthouse.push(measurement);
      console.log(`LIGHTHOUSE ${formFactor}: ${score}; ${measurement.state}; ${html}`);
      assert.equal(result.lhr.runtimeError, undefined, 'Lighthouse must not have a runtime error');
      assert.ok(score >= 95, `Actual production accessibility score ${score} < 95`);
    });
  }
} catch (error) {
  report.checks.push({ name: 'runner setup or execution', passed: false, error: error.stack ?? String(error) });
  console.error(error);
} finally {
  await auditBrowser?.close().catch(error => console.error('Audit browser cleanup:', error));
  await browser?.close().catch(error => console.error('Browser cleanup:', error));
  await stopPreview();
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
  const failures = report.checks.filter(result => !result.passed);
  console.log(`${report.checks.length - failures.length}/${report.checks.length} checks passed. Results: ${path.join(artifacts, 'results.json')}`);
  if (failures.length) process.exitCode = 1;
}