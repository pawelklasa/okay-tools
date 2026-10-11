import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

const workflow = parse(await readFile(new URL('../../.github/workflows/signal.yml', import.meta.url), 'utf8'));
const steps = workflow.jobs.digest.steps;

test('daily Signal workflow has 05:00 UTC schedule, manual dispatch and write permissions', () => {
  assert.deepEqual(workflow.on.schedule, [{ cron: '0 5 * * *' }]);
  assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
  assert.equal(workflow.permissions.contents, 'write');
  assert.equal(workflow.permissions.actions, 'write');
  assert.equal(workflow.concurrency.group, 'daily-signal');
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
});

test('workflow tests and builds before committing only generated history', () => {
  const checkout = steps.find(step => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout?.with.ref, 'main');
  const node = steps.find(step => step.uses?.startsWith('actions/setup-node@'));
  assert.equal(Number(node?.with['node-version']), 22);
  const commands = steps.map(step => step.run);
  const installIndex = commands.indexOf('npm ci --no-audit --no-fund');
  const testIndex = commands.indexOf('npm run signal:test');
  const publishIndex = commands.indexOf('npm run signal:build');
  const buildIndex = commands.indexOf('npm run build');
  const commitIndex = steps.findIndex(step => step.id === 'commit');
  assert.ok(installIndex >= 0 && installIndex < testIndex && testIndex < publishIndex && publishIndex < buildIndex && buildIndex < commitIndex);
  const commit = steps[commitIndex].run;
  assert.deepEqual(commit.split('\n').map(line => line.trim()).filter(line => /^git add\b/.test(line)), ['git add data/signal']);
  assert.doesNotMatch(commit, /git (?:commit|add)\s+[^\n]*(?:--all|(?:^|\s)-a\b)/m);
  assert.match(commit, /git diff --cached --quiet/);
  assert.match(commit, /git pull --rebase origin main/);
  assert.match(commit, /git push origin HEAD:main/);
  assert.match(commit, /changed=false/);
  assert.match(commit, /changed=true/);
  assert.equal(steps[publishIndex].env.ANTHROPIC_API_KEY, '${{ secrets.ANTHROPIC_API_KEY }}');
});

test('changed history dispatches Pages and optionally triggers Netlify', () => {
  const dispatch = steps.find(step => step.run?.includes('gh workflow run'));
  assert.ok(dispatch, 'Existing Pages workflow must be dispatched');
  assert.equal(dispatch.if, "steps.commit.outputs.changed == 'true'");
  assert.equal(dispatch.run, 'gh workflow run deploy.yml --ref main');
  assert.equal(dispatch.env.GH_TOKEN, '${{ github.token }}');
  const hook = steps.find(step => step.env?.NETLIFY_BUILD_HOOK);
  assert.ok(hook, 'Optional Netlify deployment hook must exist');
  assert.equal(hook.if, "steps.commit.outputs.changed == 'true'");
  assert.equal(hook.env.NETLIFY_BUILD_HOOK, '${{ secrets.NETLIFY_BUILD_HOOK }}');
  assert.match(hook.run, /if \(!hook\)/);
  assert.match(hook.run, /method: 'POST'/);
  assert.match(hook.run, /AbortSignal\.timeout\(10000\)/);
});