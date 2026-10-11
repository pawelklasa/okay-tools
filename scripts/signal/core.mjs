import { load } from 'cheerio';

export function safeUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|ref_src|ref_url|_hsenc|_hsmi)$/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.href;
  } catch {
    return null;
  }
}

export function canonicalKey(value, base) {
  const normalized = safeUrl(value, base);
  if (!normalized) return null;
  const url = new URL(normalized);
  url.protocol = 'https:';
  url.hostname = url.hostname.replace(/^www\./, '');
  url.searchParams.sort();
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.href;
}

export function plainText(value, max = 1000) {
  const document = load(String(value ?? ''), null, false);
  document('script, style, noscript').remove();
  return document.root().text().replace(/\s+/g, ' ').trim().slice(0, max);
}

export function titleWords(value) {
  return String(value).normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
}

export function nearTitle(first, second) {
  const left = titleWords(first);
  const right = titleWords(second);
  if (left.join(' ') === right.join(' ')) return true;
  if (Math.min(left.length, right.length) < 4) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const overlap = [...leftSet].filter(word => rightSet.has(word)).length;
  return overlap / Math.max(leftSet.size, rightSet.size) >= 0.8;
}

export function fairCandidates(groups, limit = 300) {
  const result = [];
  for (let offset = 0; result.length < limit; offset += 1) {
    let added = false;
    for (const group of groups) {
      if (group[offset] && result.length < limit) {
        result.push(group[offset]);
        added = true;
      }
    }
    if (!added) break;
  }
  return result;
}