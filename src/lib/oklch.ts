import {
  converter,
  formatHex,
  formatCss,
  parse,
  inGamut,
  clampChroma,
  wcagContrast,
  type Color,
} from "culori";

const toOklch = converter("oklch");
const toRgb = converter("rgb");

export type OKLCH = { l: number; c: number; h: number };

export function parseColor(input: string): OKLCH | null {
  const c = parse(input);
  if (!c) return null;
  const o = toOklch(c)!;
  return { l: o.l ?? 0, c: o.c ?? 0, h: o.h ?? 0 };
}

export function oklchCss({ l, c, h }: OKLCH, alpha = 1): string {
  const a = alpha === 1 ? "" : ` / ${alpha}`;
  return `oklch(${round(l, 4)} ${round(c, 4)} ${round(h, 2)}${a})`;
}

export function oklchToHex({ l, c, h }: OKLCH): string {
  const css = `oklch(${l} ${c} ${h})`;
  const clamped = clampChroma(css, "oklch");
  return formatHex(clamped) ?? "#000000";
}

export function isInSrgb(o: OKLCH): boolean {
  return inGamut("rgb")({ mode: "oklch", l: o.l, c: o.c, h: o.h } as Color);
}

export function isInP3(o: OKLCH): boolean {
  return inGamut("p3")({ mode: "oklch", l: o.l, c: o.c, h: o.h } as Color);
}

export function clampToSrgb(o: OKLCH): OKLCH {
  const css = `oklch(${o.l} ${o.c} ${o.h})`;
  const clamped = toOklch(clampChroma(css, "oklch"))!;
  return { l: clamped.l ?? 0, c: clamped.c ?? 0, h: clamped.h ?? o.h };
}

/**
 * Build a Tailwind-style ramp from an anchor.
 * Steps map to symmetrical L positions around the anchor's L (default 500 = anchor L).
 */
export const RAMP_STOPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;
export type RampStop = (typeof RAMP_STOPS)[number];

export interface RampOptions {
  anchor: OKLCH;
  /** Top L (lightest, e.g. for 50). Default 0.985 */
  lMax?: number;
  /** Bottom L (darkest, e.g. for 950). Default 0.13 */
  lMin?: number;
  /** Anchor stop. Default 500. */
  anchorStop?: RampStop;
  /** Curve: linear or eased L distribution. */
  curve?: "linear" | "ease";
  /** If true, taper chroma at extremes (recommended). */
  taperChroma?: boolean;
}

export function buildRamp(opts: RampOptions): Record<RampStop, OKLCH> {
  const {
    anchor,
    lMax = 0.985,
    lMin = 0.13,
    anchorStop = 500,
    curve = "linear",
    taperChroma = true,
  } = opts;

  const stops = RAMP_STOPS;
  const anchorIdx = stops.indexOf(anchorStop);

  // Map each stop to a 0..1 position where 0 = lightest, 1 = darkest
  const positions = stops.map((_, i) => i / (stops.length - 1));

  const ease = (t: number) =>
    curve === "ease" ? 0.5 - 0.5 * Math.cos(Math.PI * t) : t;

  // Force the curve to pass through the anchor's L at the anchor index.
  const tAnchor = ease(positions[anchorIdx]);
  const out = {} as Record<RampStop, OKLCH>;

  stops.forEach((stop, i) => {
    const t = ease(positions[i]);
    // Two-piece linear interpolation: above and below the anchor
    let l: number;
    if (t <= tAnchor) {
      const k = tAnchor === 0 ? 0 : t / tAnchor;
      l = lMax + (anchor.l - lMax) * k;
    } else {
      const k = (t - tAnchor) / (1 - tAnchor || 1);
      l = anchor.l + (lMin - anchor.l) * k;
    }

    // Chroma: hold near anchor, taper at extremes (chroma cannot survive at L→0 or L→1)
    let c = anchor.c;
    if (taperChroma) {
      const distFromAnchor = Math.abs(i - anchorIdx) / Math.max(anchorIdx, stops.length - 1 - anchorIdx);
      const taper = 1 - Math.pow(distFromAnchor, 2) * 0.45;
      c = anchor.c * taper;
    }

    out[stop] = clampToSrgb({ l, c, h: anchor.h });
  });

  return out;
}

/** Invert a ramp's L axis for dark mode: 50 ↔ 950, 100 ↔ 900, etc. */
export function invertRamp(
  ramp: Record<RampStop, OKLCH>,
): Record<RampStop, OKLCH> {
  const stops = RAMP_STOPS;
  const out = {} as Record<RampStop, OKLCH>;
  stops.forEach((stop, i) => {
    const mirror = stops[stops.length - 1 - i];
    out[stop] = ramp[mirror];
  });
  return out;
}

/** Interpolate between two colors in a chosen color space. Returns CSS color() string. */
export function interpolateCss(
  from: string,
  to: string,
  steps: number,
  space: "oklch" | "oklab" | "hsl" | "srgb" | "lab",
): string[] {
  const a = parse(from);
  const b = parse(to);
  if (!a || !b) return [];
  const conv = converter(space === "srgb" ? "rgb" : space);
  const A = conv(a)!;
  const B = conv(b)!;
  const result: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const mix: Record<string, number | string> = { mode: A.mode };
    for (const k of Object.keys(A)) {
      if (k === "mode") continue;
      const av = (A as unknown as Record<string, number | undefined>)[k];
      const bv = (B as unknown as Record<string, number | undefined>)[k];
      if (typeof av === "number" && typeof bv === "number") {
        // Hue: shortest-path
        if (k === "h") {
          const diff = ((bv - av + 540) % 360) - 180;
          mix[k] = (av + diff * t + 360) % 360;
        } else {
          mix[k] = av + (bv - av) * t;
        }
      }
    }
    const hex = formatHex(clampChroma(mix as unknown as Color, "oklch")) ?? "#000";
    result.push(hex);
  }
  return result;
}

export function contrastRatio(fg: string, bg: string): number {
  return wcagContrast(fg, bg) ?? 1;
}

/** APCA Lc — simplified implementation of SAPC-APCA 0.98G-4g
 * https://github.com/Myndex/SAPC-APCA — MIT licensed.
 * Returns Lc in -108..+106 range (sign indicates polarity).
 */
export function apcaLc(textHex: string, bgHex: string): number {
  const sRGBtoY = (hex: string) => {
    const c = toRgb(parse(hex)!);
    if (!c) return 0;
    const r = Math.max(0, Math.min(1, c.r));
    const g = Math.max(0, Math.min(1, c.g));
    const b = Math.max(0, Math.min(1, c.b));
    const sR = Math.pow(r, 2.4);
    const sG = Math.pow(g, 2.4);
    const sB = Math.pow(b, 2.4);
    return 0.2126729 * sR + 0.7151522 * sG + 0.072175 * sB;
  };
  const Ytxt = sRGBtoY(textHex);
  const Ybg = sRGBtoY(bgHex);

  const normBG = 0.56;
  const normTXT = 0.57;
  const revTXT = 0.62;
  const revBG = 0.65;
  const blkThrs = 0.022;
  const blkClmp = 1.414;
  const scaleBoW = 1.14;
  const scaleWoB = 1.14;
  const loBoWoffset = 0.027;
  const loWoBoffset = 0.027;
  const deltaYmin = 0.0005;
  const loClip = 0.1;

  const Ytxt2 = Ytxt < blkThrs ? Ytxt + Math.pow(blkThrs - Ytxt, blkClmp) : Ytxt;
  const Ybg2 = Ybg < blkThrs ? Ybg + Math.pow(blkThrs - Ybg, blkClmp) : Ybg;

  if (Math.abs(Ybg2 - Ytxt2) < deltaYmin) return 0;

  let outputContrast = 0;
  if (Ybg2 > Ytxt2) {
    const SAPC = (Math.pow(Ybg2, normBG) - Math.pow(Ytxt2, normTXT)) * scaleBoW;
    outputContrast = SAPC < loClip ? 0 : SAPC - loBoWoffset;
  } else {
    const SAPC = (Math.pow(Ybg2, revBG) - Math.pow(Ytxt2, revTXT)) * scaleWoB;
    outputContrast = SAPC > -loClip ? 0 : SAPC + loWoBoffset;
  }

  return outputContrast * 100;
}

export function formatRamp(ramp: Record<RampStop, OKLCH>) {
  return RAMP_STOPS.map((s) => ({
    stop: s,
    oklch: ramp[s],
    css: oklchCss(ramp[s]),
    hex: oklchToHex(ramp[s]),
    inSrgb: isInSrgb(ramp[s]),
    inP3: isInP3(ramp[s]),
  }));
}

function round(n: number, digits = 3): number {
  const m = Math.pow(10, digits);
  return Math.round(n * m) / m;
}

export { formatCss };

// ---------------------------------------------------------------------------
// HSL → OKLCH migration
// ---------------------------------------------------------------------------

const toHsl = converter("hsl");

export type HslConvertMode = "literal" | "perceptual";

export interface HslConvertResult {
  /** Original input string (trimmed). */
  input: string;
  /** OKLCH chosen for output (literal or perceptual). */
  oklch: OKLCH;
  /** Literal OKLCH (always the appearance-preserving conversion). */
  literal: OKLCH;
  /** HSL channels parsed from the input. */
  hsl: { h: number; s: number; l: number };
  /** Difference between HSL's claimed L (0..1) and literal OKLCH L (0..1). */
  lDrift: number;
  /** True if the input string was an hsl()/hsla() value. */
  wasHsl: boolean;
  /** sRGB gamut state of the chosen oklch. */
  inSrgb: boolean;
  inP3: boolean;
  /** If chroma had to be reduced to fit sRGB, the original chroma. Else null. */
  chromaClipped: { from: number; to: number } | null;
  /** CSS string of the chosen oklch. */
  css: string;
}

export interface HslConvertError {
  input: string;
  error: string;
}

export type HslConvertEntry =
  | { ok: true; value: HslConvertResult }
  | { ok: false; value: HslConvertError };

const HSL_TOKEN_RE = /\bhsla?\([^)]*\)/gi;

export function isHslString(s: string): boolean {
  return /^\s*hsla?\(/i.test(s);
}

/** Convert one input string. Accepts any culori-parseable colour. */
export function convertHslLine(
  input: string,
  mode: HslConvertMode,
): HslConvertEntry {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, value: { input, error: "empty" } };
  const parsed = parse(trimmed);
  if (!parsed) {
    return { ok: false, value: { input: trimmed, error: `couldn't parse ${trimmed}` } };
  }
  const hslC = toHsl(parsed)!;
  const literalC = toOklch(parsed)!;
  const hsl = {
    h: hslC.h ?? 0,
    s: hslC.s ?? 0,
    l: hslC.l ?? 0,
  };
  const literal: OKLCH = {
    l: literalC.l ?? 0,
    c: literalC.c ?? 0,
    h: literalC.h ?? hsl.h,
  };

  let chosen: OKLCH;
  if (mode === "literal") {
    chosen = literal;
  } else {
    // Perceptual: remap HSL's L (0..1) to a useful OKLCH L range, keep literal chroma & hue.
    const lMin = 0.13;
    const lMax = 0.985;
    const newL = lMin + hsl.l * (lMax - lMin);
    chosen = { l: newL, c: literal.c, h: literal.h };
  }

  // Clamp to sRGB and report whether chroma was reduced.
  const beforeC = chosen.c;
  const clamped = clampToSrgb(chosen);
  const chromaReduced = beforeC - clamped.c > 0.0005;
  const finalC: OKLCH = clamped;

  return {
    ok: true,
    value: {
      input: trimmed,
      oklch: finalC,
      literal,
      hsl,
      lDrift: hsl.l - literal.l,
      wasHsl: isHslString(trimmed),
      inSrgb: isInSrgb(finalC),
      inP3: isInP3(finalC),
      chromaClipped: chromaReduced ? { from: beforeC, to: clamped.c } : null,
      css: oklchCss(finalC),
    },
  };
}

/** Parse multiline input — one colour per non-empty line. */
export function convertHslLines(
  text: string,
  mode: HslConvertMode,
): HslConvertEntry[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => convertHslLine(l, mode));
}

export interface CssReplaceMatch {
  from: string;
  to: string;
  result: HslConvertResult;
  /** Character index of the match in the original input. */
  index: number;
}

export interface CssReplaceOutput {
  output: string;
  matches: CssReplaceMatch[];
  errors: { from: string; index: number; error: string }[];
}

/** Find every hsl()/hsla() occurrence in CSS text and replace with oklch(). */
export function replaceHslInCss(
  text: string,
  mode: HslConvertMode,
): CssReplaceOutput {
  const matches: CssReplaceMatch[] = [];
  const errors: { from: string; index: number; error: string }[] = [];
  const output = text.replace(HSL_TOKEN_RE, (raw, offset: number) => {
    const entry = convertHslLine(raw, mode);
    if (entry.ok) {
      matches.push({ from: raw, to: entry.value.css, result: entry.value, index: offset });
      return entry.value.css;
    }
    errors.push({ from: raw, index: offset, error: entry.value.error });
    return raw;
  });
  return { output, matches, errors };
}
