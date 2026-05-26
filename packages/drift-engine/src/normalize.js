// Normalisation.
//
// This file is the engine's credibility. Every public claim about drift made
// with this tool reduces to: "we observed N distinct values in CATEGORY,
// after applying RULES." The rules are listed in `RULES` below and re-emitted
// on every report so a reader can audit the count.
//
// IMPORTANT: This file has zero side effects, zero I/O, and no dependencies
// outside the standard library and the in-tree `colorMath.js`. Keep it that
// way — it makes the engine trivially testable in Node.

import { parseColorToOklch, oklchDeltaE, oklchToHex, isTransparent } from "./colorMath.js";

// Human-readable list of every rule applied, in order. Re-emitted on every
// DriftReport so the number is auditable. If you add a new normalisation
// rule, ADD A LINE HERE.
export const RULES = [
  "All colour formats (hex, rgb(), rgba(), hsl(), named, oklch()) are parsed and converted to OKLab (Björn Ottosson, 2020).",
  "Colours within ΔE OKLab ≤ tolerance are bucketed as one. Default 0.02 ≈ JND on a calibrated monitor (≈ CIEDE2000 ΔE 1.0). This is NOT CIEDE2000 — scales differ ~50×.",
  "After bucketing, post-dedup colour pairs whose ΔE is between tolerance and tolerance × 2.5 are flagged as `near-duplicate clusters` — surfaced separately because a category-count alone can hide near-identical greys that survived strict dedup.",
  "Fully transparent colours (alpha = 0) are dropped, since they encode no visual decision.",
  "Spacing values are normalised to integer CSS pixels (em/rem assume 16px root); sub-bucket-px differences are merged.",
  "Spacing smaller than `spacingMinPx` is dropped (1–2px hairlines are not spacing decisions).",
  "Shorthand and longhand properties are normalised to the same value (padding:8px ≡ padding-top:8px ≡ 8px).",
  "Font families are normalised by their first declared family (the fallback stack is ignored).",
  "Font sizes use the same px conversion as spacing.",
  "Font weights are normalised to numeric form (normal=400, bold=700).",
  "Line heights are normalised to a unitless ratio where possible; px line-heights bucket to nearest px.",
  "Border radii follow spacing rules (px-bucketed, em/rem converted).",
  "Box shadows are normalised by stringifying their parsed components (offsets, blur, spread, colour) so equivalent shadows collapse.",
  "Transition durations are normalised to milliseconds.",
  "z-index values are normalised to integers; non-integer (auto, inherit) are dropped.",
  "In URL mode, elements with display:none, visibility:hidden, or zero bounding box are skipped.",
  "In URL mode, third-party iframes are not counted and are listed separately.",
];

const HEX_RE = /^#([0-9a-f]{3,8})$/i;
const COLOR_KEYWORDS = new Set([
  "currentcolor", "transparent", "inherit", "initial", "unset", "revert", "auto", "none",
]);

const PX_PER_REM = 16; // assumed root size; documented in README

/**
 * @param {string} v raw CSS length value (e.g. "16px", "1rem", "1.5em")
 * @returns {number | null} pixels, or null if not a parseable length
 */
function lengthToPx(v) {
  if (!v || typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "0") return 0;
  const m = /^(-?\d*\.?\d+)(px|rem|em|pt|%)?$/.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return null;
  const unit = m[2] || "px";
  switch (unit) {
    case "px": return n;
    case "rem":
    case "em":  return n * PX_PER_REM; // em treated as rem (we have no cascade)
    case "pt":  return n * (96 / 72);
    case "%":   return null; // percentages aren't comparable to absolute spacing
    default:    return null;
  }
}

/**
 * @param {string} v raw CSS duration ("200ms" or "0.2s")
 * @returns {number | null} milliseconds
 */
function durationToMs(v) {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  const m = /^(-?\d*\.?\d+)(ms|s)?$/.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return null;
  const unit = m[2] || "s";
  return unit === "s" ? n * 1000 : n;
}

/**
 * @param {string} v
 * @returns {number | null}
 */
function fontWeightToNumber(v) {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === "normal") return 400;
  if (s === "bold") return 700;
  if (s === "bolder") return 700;
  if (s === "lighter") return 300;
  const n = parseInt(s, 10);
  if (!isFinite(n)) return null;
  // Round to nearest 100 — engineers writing 401 and 400 didn't mean two things.
  return Math.round(n / 100) * 100;
}

/**
 * @param {string} v
 * @returns {string | null}
 */
function fontFamilyKey(v) {
  if (!v) return null;
  // Take the first declared family. Stack fallbacks ("Inter, system-ui, sans-serif")
  // are not what people drift on; they drift on the headline family.
  const first = v.split(",")[0].trim().replace(/^["']|["']$/g, "");
  if (!first) return null;
  return first.toLowerCase();
}

/**
 * @param {string} v
 * @returns {string | null} canonical shadow key
 */
function shadowKey(v) {
  if (!v || typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "none" || s === "0 0" || s === "0px 0px") return null;
  // Pull out colour parts and length parts. We don't need to perfectly parse;
  // we need a stable canonical key for equality.
  // Split on commas to get individual shadow layers (a shadow can be multi).
  const layers = splitTopLevelCommas(s).map((layer) => {
    const colours = extractColours(layer);
    const lengths = layer
      .replace(/rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)|#[0-9a-f]{3,8}|\b[a-z]+\b/gi, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => {
        const px = lengthToPx(token);
        return px == null ? token : `${Math.round(px)}px`;
      });
    const inset = /\binset\b/.test(layer) ? "inset " : "";
    const colourCanonical = colours
      .map((c) => normaliseColour(c, 0.02)?.key ?? c)
      .join(",");
    return `${inset}${lengths.join(" ")}|${colourCanonical}`;
  });
  return layers.join(" , ");
}

function splitTopLevelCommas(s) {
  const out = [];
  let depth = 0;
  let buf = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(buf); buf = ""; }
    else buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

function extractColours(s) {
  const out = [];
  const re = /rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)|#[0-9a-f]{3,8}\b/gi;
  let m;
  while ((m = re.exec(s)) !== null) out.push(m[0]);
  return out;
}

/**
 * Normalise a single colour string to a bucket key.
 *
 * @param {string} raw
 * @param {number} tolerance ΔE(OKLCH)
 * @returns {{ key: string; display: string; alpha: number } | null}
 */
function normaliseColour(raw, tolerance) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (COLOR_KEYWORDS.has(trimmed.toLowerCase())) return null;
  if (isTransparent(trimmed)) return null;

  const ok = parseColorToOklch(trimmed);
  if (!ok) return null;

  // Bucket: round OKLCH coordinates to a grid sized by tolerance. ΔE in OKLCH
  // is approximately Euclidean distance in (L, C*cos h, C*sin h); rounding L
  // and C to (tolerance) and h to a hue step ~ tolerance / max-chroma is a
  // cheap, deterministic, and good-enough bucket. We then verify with an
  // explicit ΔE check against existing bucket centres (see normalize()).
  //
  // We return a "draft" key here. The score() pass merges any drafts whose
  // centres are within tolerance.
  const lBucket = Math.round(ok.l / tolerance);
  const cBucket = Math.round(ok.c / tolerance);
  const hBucket = Math.round((ok.h || 0) / 5); // 5deg hue grid
  const alpha = ok.alpha ?? 1;
  const aBucket = Math.round(alpha * 20); // 5% alpha grid
  return {
    key: `clr:${lBucket}:${cBucket}:${hBucket}:${aBucket}`,
    display: oklchToHex(ok) + (alpha < 1 ? `@${Math.round(alpha * 100)}%` : ""),
    alpha,
  };
}

/**
 * Normalise a batch of raw observations into bucketed NormalizedValues per
 * category. Performs the cross-bucket ΔE merge for colours so that the
 * cheap hash above doesn't split perceptually-identical greys across a grid
 * boundary.
 *
 * @param {import('./types').RawObservation[]} observations
 * @param {import('./types').NormalizationConfig} config
 * @returns {Map<import('./types').Category, Map<string, import('./types').NormalizedValue>>}
 */
export function normalize(observations, config) {
  /** @type {Map<string, Map<string, import('./types').NormalizedValue>>} */
  const out = new Map();
  /** Centres for colour buckets, per category, for ΔE merging. */
  const colourCentres = new Map();

  for (const obs of observations) {
    const cat = obs.category;
    const raw = (obs.raw ?? "").trim();
    if (!raw) continue;

    let key = null;
    let display = raw;

    switch (cat) {
      case "textColor":
      case "bgColor":
      case "borderColor": {
        const c = normaliseColour(raw, config.colorToleranceDeltaE);
        if (!c) continue;
        if (config.dropTransparent && c.alpha === 0) continue;

        // Cross-bucket ΔE merge: if any existing centre in this category is
        // within tolerance, fold this observation into it.
        const ok = parseColorToOklch(raw);
        if (!ok) continue;
        const centres = colourCentres.get(cat) || new Map();
        let mergedKey = null;
        for (const [existingKey, centre] of centres) {
          if (oklchDeltaE(ok, centre) <= config.colorToleranceDeltaE) {
            mergedKey = existingKey;
            break;
          }
        }
        if (!mergedKey) {
          mergedKey = c.key;
          centres.set(mergedKey, ok);
          colourCentres.set(cat, centres);
        }
        key = mergedKey;
        display = c.display;
        break;
      }
      case "fontFamily": {
        const f = fontFamilyKey(raw);
        if (!f) continue;
        key = `ff:${f}`;
        display = f;
        break;
      }
      case "fontSize":
      case "spacing":
      case "borderRadius":
      case "lineHeight": {
        // line-height can be unitless; treat unitless < 5 as a ratio.
        if (cat === "lineHeight" && /^\d*\.?\d+$/.test(raw) && parseFloat(raw) < 5) {
          const n = Math.round(parseFloat(raw) * 100) / 100; // 2dp
          key = `lh:${n}`;
          display = String(n);
          break;
        }
        const px = lengthToPx(raw);
        if (px == null) continue;
        if (cat === "spacing" && Math.abs(px) < config.spacingMinPx) continue;
        const bucketed = Math.round(px / config.spacingBucketPx) * config.spacingBucketPx;
        key = `${cat}:${bucketed}`;
        display = `${bucketed}px`;
        break;
      }
      case "fontWeight": {
        const w = fontWeightToNumber(raw);
        if (w == null) continue;
        key = `fw:${w}`;
        display = String(w);
        break;
      }
      case "boxShadow": {
        const sk = shadowKey(raw);
        if (!sk) continue;
        key = `sh:${sk}`;
        display = raw;
        break;
      }
      case "transitionDuration": {
        const ms = durationToMs(raw);
        if (ms == null) continue;
        key = `td:${Math.round(ms)}`;
        display = `${Math.round(ms)}ms`;
        break;
      }
      case "zIndex": {
        const n = parseInt(raw, 10);
        if (!isFinite(n)) continue;
        key = `z:${n}`;
        display = String(n);
        break;
      }
      default:
        continue;
    }

    if (!key) continue;
    let cmap = out.get(cat);
    if (!cmap) { cmap = new Map(); out.set(cat, cmap); }
    let v = cmap.get(key);
    if (!v) {
      v = { key, display, category: cat, occurrences: 0, samples: [] };
      cmap.set(key, v);
    }
    v.occurrences++;
    if (v.samples.length < config.samplesPerValue) v.samples.push(obs);
  }

  return out;
}

// Export internals for tests.
export const __test = { lengthToPx, durationToMs, fontWeightToNumber, fontFamilyKey, shadowKey, normaliseColour };
