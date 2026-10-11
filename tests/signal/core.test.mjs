import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalKey, safeUrl, plainText, nearTitle, fairCandidates } from '../../scripts/signal/core.mjs';

test('canonical URLs remove tracking but retain meaningful queries', () => {
  assert.equal(canonicalKey('http://www.example.com/post/?b=2&utm_source=rss&a=1#top'), 'https://example.com/post?a=1&b=2');
  assert.notEqual(canonicalKey('https://example.com/?id=1'), canonicalKey('https://example.com/?id=2'));
  assert.equal(safeUrl('/post', 'https://example.com'), 'https://example.com/post');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('https://user:pass@example.com'), null);
  assert.equal(safeUrl('', 'https://example.com'), null);
  assert.equal(safeUrl(undefined, 'https://example.com'), null);
});

test('excerpts are plain, decoded, bounded text', () => {
  assert.equal(plainText('<p>A &amp; B</p><script>secret</script>'), 'A & B');
  assert.equal(plainText('x'.repeat(1100)).length, 1000);
});

test('near titles and round-robin candidate cap', () => {
  assert.ok(nearTitle('Building better accessible form components', 'Building better accessible form components today'));
  assert.ok(!nearTitle('CSS grid', 'CSS colors'));
  assert.ok(!nearTitle('\u4f60\u597d', '\u4e16\u754c'));
  const groups = [Array.from({ length: 400 }, (_, index) => `first-${index}`), ['second-0']];
  const candidates = fairCandidates(groups);
  assert.equal(candidates.length, 300);
  assert.deepEqual(candidates.slice(0, 3), ['first-0', 'second-0', 'first-1']);
});