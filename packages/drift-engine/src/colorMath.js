// Self-contained colour conversion: CSS string -> OKLCH, OKLCH -> hex, ΔE.
//
// Why not just import `culori`? The web app already does, and culori is
// excellent. But the CLI and Playwright function need this engine to run
// stand-alone with zero deps so `npx okay-drift` ships in one tiny package.
// So we ship our own ~150 lines here. They are well-trodden — sRGB <-> linear,
// linear <-> XYZ (D65), XYZ <-> Oklab (Björn Ottosson 2020), Oklab <-> OKLCH.
//
// References:
//   sRGB transfer: https://www.w3.org/TR/css-color-4/#color-conversion-code
//   Oklab:         https://bottosson.github.io/posts/oklab/
//   OKLCH ΔE:      we use Euclidean distance in Oklab, which is the whole
//                  point of the OKLCH space (perceptual uniformity).

/** @typedef {{ l: number; c: number; h: number; alpha?: number }} Oklch */

const NAMED = /** @type {Record<string, [number, number, number]>} */ ({
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0],
  blue: [0, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128], silver: [192, 192, 192],
  maroon: [128, 0, 0], yellow: [255, 255, 0], olive: [128, 128, 0], lime: [0, 255, 0],
  aqua: [0, 255, 255], cyan: [0, 255, 255], teal: [0, 128, 128], navy: [0, 0, 128],
  fuchsia: [255, 0, 255], magenta: [255, 0, 255], purple: [128, 0, 128], orange: [255, 165, 0],
  pink: [255, 192, 203], indigo: [75, 0, 130], gold: [255, 215, 0], beige: [245, 245, 220],
  brown: [165, 42, 42], coral: [255, 127, 80], crimson: [220, 20, 60], khaki: [240, 230, 140],
  lavender: [230, 230, 250], salmon: [250, 128, 114], tan: [210, 180, 140], turquoise: [64, 224, 208],
  violet: [238, 130, 238], wheat: [245, 222, 179],
});

/** @param {string} raw @returns {boolean} */
export function isTransparent(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "transparent") return true;
  let m = /rgba?\(([^)]+)\)/.exec(s);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 4) {
      const a = parsePct(parts[3]);
      return a === 0;
    }
  }
  m = /hsla?\(([^)]+)\)/.exec(s);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 4) {
      const a = parsePct(parts[3]);
      return a === 0;
    }
  }
  m = /oklch\(([^)]+)\)/.exec(s);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 4) {
      const a = parsePct(parts[3]);
      return a === 0;
    }
  }
  return false;
}

function parsePct(v) {
  if (v == null) return 1;
  const s = String(v).trim();
  if (s.endsWith("%")) return parseFloat(s) / 100;
  return parseFloat(s);
}

/**
 * Parse any common CSS colour to OKLCH. Returns null if not parseable.
 * @param {string} raw
 * @returns {Oklch | null}
 */
export function parseColorToOklch(raw) {
  const rgba = parseToRgba(raw);
  if (!rgba) return null;
  const [r, g, b, a] = rgba;
  return { ...rgbToOklch(r, g, b), alpha: a };
}

/** @returns {[number, number, number, number] | null} 0-255, alpha 0-1 */
function parseToRgba(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (s in NAMED) return [...NAMED[s], 1];

  // #rgb / #rgba / #rrggbb / #rrggbbaa
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1;
      return [r, g, b, a];
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return [r, g, b, a];
    }
  }

  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const r = parseChan(parts[0], 255);
    const g = parseChan(parts[1], 255);
    const b = parseChan(parts[2], 255);
    const a = parts[3] != null ? parsePct(parts[3]) : 1;
    return [r, g, b, a];
  }

  m = /^hsla?\(([^)]+)\)$/.exec(s);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const h = parseAngle(parts[0]);
    const sat = parsePct(parts[1]);
    const li = parsePct(parts[2]);
    const a = parts[3] != null ? parsePct(parts[3]) : 1;
    const [r, g, b] = hslToRgb(h, sat, li);
    return [r, g, b, a];
  }

  m = /^oklch\(([^)]+)\)$/.exec(s);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const l = parsePct(parts[0]);
    const c = parseFloat(parts[1]);
    const hue = parseAngle(parts[2]);
    const a = parts[3] != null ? parsePct(parts[3]) : 1;
    const [r, g, b] = oklchToRgb({ l, c, h: hue });
    return [r, g, b, a];
  }

  return null;
}

function parseChan(v, max) {
  const s = String(v).trim();
  if (s.endsWith("%")) return Math.max(0, Math.min(255, Math.round((parseFloat(s) / 100) * 255)));
  return Math.max(0, Math.min(255, Math.round(parseFloat(s))));
}

function parseAngle(v) {
  const s = String(v).trim();
  if (s.endsWith("deg")) return parseFloat(s);
  if (s.endsWith("rad")) return (parseFloat(s) * 180) / Math.PI;
  if (s.endsWith("turn")) return parseFloat(s) * 360;
  return parseFloat(s);
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  if (s > 1) s = s / 100;
  if (l > 1) l = l / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return [
    Math.round((r1 + mm) * 255),
    Math.round((g1 + mm) * 255),
    Math.round((b1 + mm) * 255),
  ];
}

// sRGB <-> linear
function s2l(u) { u = u / 255; return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }
function l2s(u) { const v = u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); }

// linear sRGB -> Oklab (Ottosson)
function rgbToOklab(r, g, b) {
  const lr = s2l(r), lg = s2l(g), lb = s2l(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

function oklabToRgb({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lr =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return [l2s(lr), l2s(lg), l2s(lb)];
}

/** @param {number} r 0-255 @param {number} g 0-255 @param {number} b 0-255 @returns {Oklch} */
export function rgbToOklch(r, g, b) {
  const { L, a, b: bb } = rgbToOklab(r, g, b);
  const c = Math.sqrt(a * a + bb * bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

/** @param {Oklch} ok @returns {[number, number, number]} */
export function oklchToRgb({ l, c, h }) {
  const hr = (h * Math.PI) / 180;
  const a = Math.cos(hr) * c;
  const b = Math.sin(hr) * c;
  return oklabToRgb({ L: l, a, b });
}

/** @param {Oklch} ok @returns {string} */
export function oklchToHex(ok) {
  const [r, g, b] = oklchToRgb(ok);
  const h = (n) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Perceptual ΔE in Oklab — Euclidean distance in (L, a, b). For OKLCH it is
 * the same number. A ΔE of 0.02 ≈ "imperceptible on a calibrated display";
 * 0.05 ≈ "noticeable in side-by-side comparison".
 * @param {Oklch} a @param {Oklch} b
 * @returns {number}
 */
export function oklchDeltaE(a, b) {
  const ha = (a.h * Math.PI) / 180, hb = (b.h * Math.PI) / 180;
  const ax = Math.cos(ha) * a.c, ay = Math.sin(ha) * a.c;
  const bx = Math.cos(hb) * b.c, by = Math.sin(hb) * b.c;
  const dl = a.l - b.l, da = ax - bx, db = ay - by;
  return Math.sqrt(dl * dl + da * da + db * db);
}
