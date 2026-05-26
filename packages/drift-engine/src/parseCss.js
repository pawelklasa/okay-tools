// Extract raw observations from arbitrary CSS-ish text.
//
// This is the "paste" and "repo" mode primary input. It is intentionally a
// regex-based recogniser, not a full CSS parser:
//   - We do not need to build an AST.
//   - We need to be robust to SCSS/LESS, Tailwind class strings, CSS-in-JS
//     template literals, inline style="..." attributes, and broken/partial
//     CSS. A real parser would error out on any of these.
//   - Every value we extract is paired with a source line for the offender
//     report; we use the original text's line numbers.

// Properties that contain colour values. box-shadow is handled separately
// (it contains both a colour and a set of lengths in one declaration).
const COLOR_PROPS = [
  "color", "background", "background-color", "border", "border-color",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "outline-color", "fill", "stroke", "caret-color", "text-decoration-color",
  "accent-color", "column-rule-color",
];

const SPACING_PROPS = [
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "gap", "row-gap", "column-gap", "grid-gap",
];

// Map a CSS property to the engine category for colour-related values.
function categoryForColorProp(prop) {
  if (prop === "color" || prop === "caret-color" || prop === "text-decoration-color") return "textColor";
  if (prop.startsWith("border") || prop === "outline-color" || prop === "column-rule-color") return "borderColor";
  if (prop === "background" || prop === "background-color" || prop === "fill" || prop === "stroke" || prop === "accent-color") return "bgColor";
  if (prop === "box-shadow") return null; // handled separately
  return "bgColor";
}

const COLOR_VALUE_RE =
  /(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)|\b(?:aqua|black|blue|brown|coral|crimson|cyan|fuchsia|gold|gray|grey|green|indigo|khaki|lavender|lime|magenta|maroon|navy|olive|orange|pink|purple|red|salmon|silver|tan|teal|turquoise|violet|wheat|white|yellow)\b)/g;

const LENGTH_VALUE_RE = /(-?\d*\.?\d+)(px|rem|em|pt)\b/g;
const UNITLESS_NUMBER_RE = /(?<![.\d-])(\d*\.?\d+)(?![.\dA-Za-z%])/g;
const DURATION_RE = /(\d*\.?\d+)(ms|s)\b/g;
const FONT_FAMILY_RE = /font-family\s*:\s*([^;}\n]+)/g;
const FONT_SIZE_RE   = /font-size\s*:\s*([^;}\n]+)/g;
const FONT_WEIGHT_RE = /font-weight\s*:\s*([^;}\n]+)/g;
const LINE_HEIGHT_RE = /line-height\s*:\s*([^;}\n]+)/g;
const Z_INDEX_RE     = /z-index\s*:\s*(-?\d+)/g;
const BORDER_RADIUS_RE = /border(?:-(?:top|right|bottom|left)(?:-(?:left|right))?)?-radius\s*:\s*([^;}\n]+)/g;
const BOX_SHADOW_RE = /box-shadow\s*:\s*([^;}]+)/g;
const TRANSITION_RE = /(?:transition|transition-duration|animation-duration)\s*:\s*([^;}\n]+)/g;
const COLOR_DECL_RE = new RegExp(`(${COLOR_PROPS.join("|")})\\s*:\\s*([^;}\\n]+)`, "g");
const SPACING_DECL_RE = new RegExp(`(${SPACING_PROPS.join("|")})\\s*:\\s*([^;}\\n]+)`, "g");
const INLINE_STYLE_RE = /style\s*=\s*["']([^"']+)["']/g;

/**
 * @param {string} text
 * @param {{ file?: string }} [meta]
 * @returns {import('./types').RawObservation[]}
 */
export function extractObservationsFromCss(text, meta = {}) {
  /** @type {import('./types').RawObservation[]} */
  const out = [];
  if (!text) return out;
  const file = meta.file;

  // Precompute line offsets so we can attach a line number to each match.
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") lineStarts.push(i + 1);
  const lineOf = (idx) => {
    // binary search
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };

  /** @param {import('./types').Category} category @param {string} raw @param {number} idx */
  const push = (category, raw, idx) => {
    if (!raw) return;
    out.push({ category, raw: raw.trim(), source: { file, line: lineOf(idx) } });
  };

  // Walk colour-bearing declarations.
  for (const m of text.matchAll(COLOR_DECL_RE)) {
    const prop = m[1];
    const val = m[2];
    const cat = categoryForColorProp(prop);
    if (!cat) continue;
    let cm;
    const valueIdx = (m.index || 0) + m[0].indexOf(val);
    COLOR_VALUE_RE.lastIndex = 0;
    while ((cm = COLOR_VALUE_RE.exec(val)) !== null) push(cat, cm[0], valueIdx + cm.index);
  }

  // Box shadows independently (catches multi-line declarations too).
  for (const m of text.matchAll(BOX_SHADOW_RE)) {
    push("boxShadow", m[1], m.index || 0);
  }

  // Spacing
  for (const m of text.matchAll(SPACING_DECL_RE)) {
    const val = m[2];
    const valueIdx = (m.index || 0) + m[0].indexOf(val);
    let lm;
    LENGTH_VALUE_RE.lastIndex = 0;
    while ((lm = LENGTH_VALUE_RE.exec(val)) !== null) push("spacing", lm[0], valueIdx + lm.index);
  }

  // Typography
  for (const m of text.matchAll(FONT_FAMILY_RE)) push("fontFamily", m[1], m.index || 0);
  for (const m of text.matchAll(FONT_SIZE_RE)) {
    const valueIdx = (m.index || 0) + m[0].indexOf(m[1]);
    let lm; LENGTH_VALUE_RE.lastIndex = 0;
    while ((lm = LENGTH_VALUE_RE.exec(m[1])) !== null) push("fontSize", lm[0], valueIdx + lm.index);
  }
  for (const m of text.matchAll(FONT_WEIGHT_RE)) push("fontWeight", m[1], m.index || 0);
  for (const m of text.matchAll(LINE_HEIGHT_RE)) push("lineHeight", m[1], m.index || 0);

  // Radii
  for (const m of text.matchAll(BORDER_RADIUS_RE)) {
    const valueIdx = (m.index || 0) + m[0].indexOf(m[1]);
    let lm; LENGTH_VALUE_RE.lastIndex = 0;
    while ((lm = LENGTH_VALUE_RE.exec(m[1])) !== null) push("borderRadius", lm[0], valueIdx + lm.index);
  }

  // Transitions / durations
  for (const m of text.matchAll(TRANSITION_RE)) {
    const valueIdx = (m.index || 0) + m[0].indexOf(m[1]);
    let dm; DURATION_RE.lastIndex = 0;
    while ((dm = DURATION_RE.exec(m[1])) !== null) push("transitionDuration", dm[0], valueIdx + dm.index);
  }

  // z-index
  for (const m of text.matchAll(Z_INDEX_RE)) push("zIndex", m[1], m.index || 0);

  // Inline style="..." in JSX/HTML — parse the contents recursively as CSS.
  for (const m of text.matchAll(INLINE_STYLE_RE)) {
    const inner = m[1];
    if (!inner.includes(":")) continue;
    // Recurse; pretend the inline text is CSS at the same file (line attribution
    // collapses to the style attribute's start line, which is good enough for the
    // offender view).
    const sub = extractObservationsFromCss(inner, { file });
    const baseLine = lineOf((m.index || 0));
    for (const o of sub) {
      o.source = { ...(o.source || {}), file, line: baseLine, role: "inline" };
      out.push(o);
    }
  }

  return out;
}

// Alias for external use.
export const parseCss = extractObservationsFromCss;
