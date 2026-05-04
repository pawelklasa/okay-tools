/**
 * token-costumes audit engine.
 *
 * Three jobs:
 *   1. parse() — turn pasted CSS / DTCG JSON / Tailwind config into a list of
 *      tokens with normalised names, raw values, and (for CSS) usage contexts.
 *   2. audit() — find costumes, polysemy, missing layers, naming drift, orphans.
 *   3. generateFix() — emit a draft three-layer reorganisation.
 *
 * Pure, sync, client-only. No deps beyond culori (already a project dep,
 * used here to map primitive hex values to OKLCH hue families when picking
 * primitive names for the fix output).
 */

import { converter, parse as parseColor } from "culori";

const toOklch = converter("oklch");

// --- Types -----------------------------------------------------------------

export type Format = "json" | "css" | "tailwind";

export type ParsedToken = {
  /** Original name as authored ("color-primary", "colorPrimary", "color.primary") */
  name: string;
  /** Normalised CSS-style identifier ("--color-primary") */
  cssName: string;
  /** Raw value as written ("#3b82f6", "var(--color-blue-500)", "oklch(...)") */
  rawValue: string;
  /** True when value is var(...) reference */
  isAlias: boolean;
  aliasTarget?: string;
  /** Naming convention class detected from the original `name` */
  convention: Convention;
  /** CSS-only: the property contexts where this token is referenced via var() */
  usageContexts: string[];
};

export type Convention = "kebab" | "camel" | "snake" | "dotted" | "other";

export type Layer = "primitive" | "semantic" | "component";

export type Finding =
  | { kind: "costume"; token: ParsedToken; reason: string }
  | { kind: "polysemic"; token: ParsedToken; ways: string[] }
  | { kind: "naming-drift"; conventions: Convention[]; examples: string[] }
  | { kind: "orphan"; token: ParsedToken }
  | { kind: "fake-semantic" };

export type LayerStatus = {
  layer: Layer;
  present: boolean;
  count: number;
  /** True when present but every token in this layer is a costume (semantic-only). */
  fake?: boolean;
  note?: string;
};

export type Verdict = "HEALTHY" | "DRIFT-PRONE" | "WEARING COSTUMES";

export type AuditResult = {
  format: Format;
  tokens: ParsedToken[];
  findings: Finding[];
  layers: LayerStatus[];
  verdict: Verdict;
  /** Convenience metric counts for the headline tiles. */
  costumeCount: number;
  polysemicCount: number;
};

// --- Format detection -------------------------------------------------------

const KNOWN_SEMANTIC_NAMES = [
  "primary",
  "secondary",
  "tertiary",
  "brand",
  "accent",
  "action",
  "link",
  "success",
  "danger",
  "error",
  "warning",
  "warn",
  "info",
  "neutral",
  "background",
  "bg",
  "foreground",
  "fg",
  "text",
  "border",
  "surface",
  "muted",
  "subtle",
  "ring",
  "focus",
  "destructive",
  "positive",
  "negative",
];

const KNOWN_COMPONENT_HINTS = [
  "button",
  "btn",
  "card",
  "input",
  "modal",
  "dialog",
  "tooltip",
  "popover",
  "tab",
  "nav",
  "header",
  "footer",
  "table",
  "row",
  "cell",
  "badge",
  "alert",
];

const PRIMITIVE_NUMERIC_RE = /-(?:50|100|200|300|400|500|600|700|800|900|950)\b/i;
const PRIMITIVE_VALUE_RE =
  /^(#|rgb\b|rgba\b|hsl\b|hsla\b|oklch\b|oklab\b|lab\b|lch\b|color\b|\d+(\.\d+)?(px|rem|em|%)?$)/i;

export function detectFormat(input: string): Format | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // DTCG JSON: starts with { and contains $value or $type
  if (trimmed.startsWith("{") && /\$value\s*:|"\$value"/.test(trimmed)) {
    return "json";
  }

  // Tailwind config: contains theme.extend.colors or module.exports / export default
  if (
    /(?:module\.exports|export\s+default)\s*=?\s*{/.test(trimmed) ||
    /theme\s*:\s*{[\s\S]*?colors\s*:/.test(trimmed) ||
    /extend\s*:\s*{[\s\S]*?colors\s*:/.test(trimmed)
  ) {
    return "tailwind";
  }

  // CSS custom properties
  if (/--[\w-]+\s*:/.test(trimmed)) return "css";

  // Plain JSON object that doesn't have $value — try as JSON colour map
  if (trimmed.startsWith("{")) return "json";

  return null;
}

// --- Naming convention -----------------------------------------------------

export function detectConvention(name: string): Convention {
  if (name.includes(".")) return "dotted";
  if (name.includes("_")) return "snake";
  if (/^[a-z]+(?:[A-Z][a-z0-9]*)+$/.test(name.replace(/^--/, ""))) return "camel";
  if (/[a-z]/.test(name) && /-/.test(name)) return "kebab";
  return "other";
}

function toCssName(name: string): string {
  // "color.primary" → "--color-primary"
  // "colorPrimary" → "--color-primary"
  // "--color-primary" → "--color-primary"
  let n = name.trim();
  if (n.startsWith("--")) return n;
  // Convert dotted to dashed
  n = n.replace(/\./g, "-");
  // Convert camelCase to kebab-case
  n = n.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  // Convert snake_case to kebab-case
  n = n.replace(/_/g, "-");
  return `--${n}`;
}

// --- Parsers ---------------------------------------------------------------

const ALIAS_RE = /var\(\s*(--[\w-]+)\s*\)/;

function makeToken(name: string, value: string): ParsedToken {
  const aliasMatch = ALIAS_RE.exec(value);
  return {
    name,
    cssName: toCssName(name),
    rawValue: value.trim(),
    isAlias: !!aliasMatch,
    aliasTarget: aliasMatch?.[1],
    convention: detectConvention(name),
    usageContexts: [],
  };
}

function parseCss(input: string): ParsedToken[] {
  const tokens: ParsedToken[] = [];
  // Match  --name: value;  inside any ruleset OR top level
  const declRe = /(--[\w-]+)\s*:\s*([^;{}]+?)\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(input))) {
    tokens.push(makeToken(m[1], m[2]));
  }

  // Walk the source again to populate usage contexts: find  property: ...var(--name)...
  const usageRe = /([a-z][a-z-]*)\s*:\s*([^;{}]+?);/gi;
  const byCssName = new Map<string, ParsedToken>();
  for (const t of tokens) byCssName.set(t.cssName, t);

  let u: RegExpExecArray | null;
  while ((u = usageRe.exec(input))) {
    const property = u[1].toLowerCase();
    if (property.startsWith("--")) continue; // declaration, not a usage
    const value = u[2];
    const refRe = /var\(\s*(--[\w-]+)\s*\)/g;
    let r: RegExpExecArray | null;
    while ((r = refRe.exec(value))) {
      const target = byCssName.get(r[1]);
      if (target) {
        const ctx = categoriseProperty(property);
        if (!target.usageContexts.includes(ctx)) target.usageContexts.push(ctx);
      }
    }
  }

  return tokens;
}

function categoriseProperty(prop: string): string {
  if (prop === "background" || prop.startsWith("background-")) return "bg";
  if (prop === "color") return "text";
  if (prop === "border" || prop.startsWith("border-")) return "border";
  if (prop === "outline" || prop.startsWith("outline-")) return "outline";
  if (prop === "fill") return "icon";
  if (prop === "stroke") return "stroke";
  if (prop === "box-shadow" || prop === "shadow") return "ring";
  if (prop === "caret-color") return "caret";
  if (prop === "accent-color") return "accent";
  if (prop === "text-decoration-color") return "link";
  return prop;
}

/** Walk a DTCG-style object, emitting tokens. Joins the path with "-". */
function parseJson(input: string): ParsedToken[] {
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch {
    throw new Error("Could not parse JSON. Check for trailing commas or quotes.");
  }
  const out: ParsedToken[] = [];
  walk(data, [], out);
  return out;
}

function walk(node: unknown, path: string[], out: ParsedToken[]): void {
  if (node === null || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  // DTCG token: has $value
  if (Object.prototype.hasOwnProperty.call(obj, "$value")) {
    const value = obj["$value"];
    if (typeof value === "string" || typeof value === "number") {
      out.push(makeToken(path.join("-"), String(value)));
    }
    return;
  }

  // Tailwind / plain colour map: leaf is a string (hex/rgb/etc.)
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("$")) continue;
    if (typeof v === "string" || typeof v === "number") {
      out.push(makeToken([...path, k].join("-"), String(v)));
    } else if (v && typeof v === "object") {
      walk(v, [...path, k], out);
    }
  }
}

/** Tailwind config: rip the `colors: { ... }` block and feed it through parseJson. */
function parseTailwind(input: string): ParsedToken[] {
  const colorsBlock = extractBalancedBlock(input, /colors\s*:\s*{/);
  if (!colorsBlock) {
    throw new Error("Couldn't find a colors: { ... } block in the Tailwind config.");
  }
  // Convert JS object literal to JSON: quote unquoted keys, drop trailing commas
  const json = jsObjectToJson(colorsBlock);
  return parseJson(json).map((t) => ({ ...t, name: `color-${t.name}`, cssName: toCssName(`color-${t.name}`) }));
}

function extractBalancedBlock(input: string, opener: RegExp): string | null {
  const m = opener.exec(input);
  if (!m) return null;
  const start = m.index + m[0].length - 1; // position of the opening {
  let depth = 0;
  for (let i = start; i < input.length; i++) {
    const c = input[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return null;
}

function jsObjectToJson(src: string): string {
  return src
    // strip /* ... */ comments
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // strip // line comments
    .replace(/\/\/[^\n]*/g, "")
    // quote bare keys: { foo: ... } / { "foo-bar": ... } stays
    .replace(/([{,]\s*)([A-Za-z_][\w-]*)\s*:/g, '$1"$2":')
    // single-quoted strings → double-quoted
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
    // strip trailing commas
    .replace(/,(\s*[}\]])/g, "$1");
}

export function parse(input: string, format?: Format): { format: Format; tokens: ParsedToken[]; source: string } {
  const fmt = format ?? detectFormat(input);
  if (!fmt) throw new Error("Couldn't detect token format. Try CSS, DTCG JSON, or a Tailwind config.");
  let tokens: ParsedToken[];
  if (fmt === "css") tokens = parseCss(input);
  else if (fmt === "json") tokens = parseJson(input);
  else tokens = parseTailwind(input);
  if (tokens.length === 0) {
    throw new Error("Parsed cleanly but found no tokens. Check the input.");
  }
  return { format: fmt, tokens, source: input };
}

// --- Audit -----------------------------------------------------------------

function isPrimitiveValue(value: string): boolean {
  if (ALIAS_RE.test(value)) return false;
  return PRIMITIVE_VALUE_RE.test(value.trim());
}

function isSemanticName(cssName: string): boolean {
  const stripped = cssName.replace(/^--/, "").replace(/^color-/, "").replace(/-\d+$/, "");
  // Strip numeric scale suffix and the conventional "color-" prefix, then
  // check whether what remains is one of the known semantic words.
  return KNOWN_SEMANTIC_NAMES.some(
    (s) => stripped === s || stripped.startsWith(`${s}-`) || stripped.endsWith(`-${s}`)
  );
}

function isPrimitiveStyleName(cssName: string): boolean {
  // *-500, *-100, etc. — a numeric scale step is the strongest signal.
  return PRIMITIVE_NUMERIC_RE.test(cssName);
}

function hasComponentHint(cssName: string): boolean {
  const stripped = cssName.replace(/^--/, "");
  return KNOWN_COMPONENT_HINTS.some((c) => stripped.includes(c));
}

export function audit(parsed: { format: Format; tokens: ParsedToken[]; source: string }): AuditResult {
  const { format, tokens, source } = parsed;
  const findings: Finding[] = [];

  // --- Costume detection ---
  for (const t of tokens) {
    if (isSemanticName(t.cssName) && !isPrimitiveStyleName(t.cssName) && isPrimitiveValue(t.rawValue)) {
      findings.push({
        kind: "costume",
        token: t,
        reason: "wears a semantic name, defined as a primitive",
      });
    }
  }

  // --- Polysemy ---
  // CSS: usageContexts populated from real refs. JSON/Tailwind: synthesise from
  // shared primitive values across token names (the next-best signal we have).
  if (format === "css") {
    for (const t of tokens) {
      if (t.usageContexts.length >= 4) {
        findings.push({ kind: "polysemic", token: t, ways: t.usageContexts });
      }
    }
  } else {
    // Group primitive-valued tokens by normalised value
    const groups = new Map<string, ParsedToken[]>();
    for (const t of tokens) {
      if (!isPrimitiveValue(t.rawValue)) continue;
      const key = t.rawValue.toLowerCase().replace(/\s+/g, "");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    for (const group of groups.values()) {
      if (group.length >= 3) {
        // Pick the most "primitive-shaped" name as the canonical, list the rest as ways
        const sorted = [...group].sort((a, b) => {
          const aPrim = isPrimitiveStyleName(a.cssName) ? 1 : 0;
          const bPrim = isPrimitiveStyleName(b.cssName) ? 1 : 0;
          return bPrim - aPrim;
        });
        const canonical = sorted[0];
        const ways = sorted.slice(1).map((t) => t.cssName);
        findings.push({ kind: "polysemic", token: canonical, ways });
      }
    }
  }

  // --- Naming drift ---
  const conventionSet = new Map<Convention, string[]>();
  for (const t of tokens) {
    if (t.convention === "other") continue;
    if (!conventionSet.has(t.convention)) conventionSet.set(t.convention, []);
    conventionSet.get(t.convention)!.push(t.name);
  }
  if (conventionSet.size >= 2) {
    findings.push({
      kind: "naming-drift",
      conventions: [...conventionSet.keys()],
      examples: [...conventionSet.values()].map((arr) => arr[0]),
    });
  }

  // --- Orphans (CSS only) ---
  if (format === "css") {
    for (const t of tokens) {
      const refRe = new RegExp(`var\\(\\s*${t.cssName.replace(/-/g, "\\-")}\\s*\\)`, "g");
      const refs = source.match(refRe) ?? [];
      if (refs.length === 0) {
        findings.push({ kind: "orphan", token: t });
      }
    }
  }

  // --- Layers ---
  let primitiveCount = 0;
  let semanticCount = 0;
  let semanticHonestCount = 0;
  let componentCount = 0;
  for (const t of tokens) {
    const primStyle = isPrimitiveStyleName(t.cssName);
    const sem = isSemanticName(t.cssName);
    const comp = hasComponentHint(t.cssName);
    if (primStyle && isPrimitiveValue(t.rawValue)) primitiveCount++;
    else if (comp && t.isAlias) componentCount++;
    else if (sem) {
      semanticCount++;
      if (t.isAlias) semanticHonestCount++;
    } else if (isPrimitiveValue(t.rawValue)) primitiveCount++;
  }

  const layers: LayerStatus[] = [
    {
      layer: "primitive",
      present: primitiveCount > 0,
      count: primitiveCount,
    },
    {
      layer: "semantic",
      present: semanticCount > 0,
      count: semanticCount,
      fake: semanticCount > 0 && semanticHonestCount === 0,
      note:
        semanticCount > 0 && semanticHonestCount === 0
          ? "every semantic name is a costume"
          : undefined,
    },
    {
      layer: "component",
      present: componentCount > 0,
      count: componentCount,
    },
  ];

  if (layers[1].fake) findings.push({ kind: "fake-semantic" });

  // --- Verdict ---
  const costumeCount = findings.filter((f) => f.kind === "costume").length;
  const polysemicCount = findings.filter((f) => f.kind === "polysemic").length;
  const missingLayers = layers.filter((l) => !l.present).length;
  const allCostumes = layers[1].fake === true;

  let verdict: Verdict;
  if (costumeCount >= 4 || allCostumes) verdict = "WEARING COSTUMES";
  else if (costumeCount >= 1 || polysemicCount >= 1 || missingLayers >= 1) verdict = "DRIFT-PRONE";
  else verdict = "HEALTHY";

  return { format, tokens, findings, layers, verdict, costumeCount, polysemicCount };
}

// --- Fix generator ---------------------------------------------------------

const HUE_FAMILIES: { name: string; min: number; max: number }[] = [
  { name: "red", min: 0, max: 25 },
  { name: "orange", min: 25, max: 55 },
  { name: "amber", min: 55, max: 90 },
  { name: "yellow", min: 90, max: 110 },
  { name: "lime", min: 110, max: 135 },
  { name: "green", min: 135, max: 165 },
  { name: "teal", min: 165, max: 200 },
  { name: "cyan", min: 200, max: 230 },
  { name: "blue", min: 230, max: 270 },
  { name: "indigo", min: 270, max: 285 },
  { name: "violet", min: 285, max: 305 },
  { name: "purple", min: 305, max: 325 },
  { name: "pink", min: 325, max: 350 },
  { name: "red2", min: 350, max: 360 },
];

function familyForValue(value: string): { family: string; step: number } | null {
  const parsed = parseColor(value);
  if (!parsed) return null;
  const ok = toOklch(parsed);
  if (!ok || ok.l == null) return null;
  if ((ok.c ?? 0) < 0.04) {
    // Neutral. Map L to a gray scale step.
    const step = mapLightnessToStep(ok.l);
    return { family: "gray", step };
  }
  const h = ((ok.h ?? 0) + 360) % 360;
  const fam = HUE_FAMILIES.find((f) => h >= f.min && h < f.max);
  const family = fam ? (fam.name === "red2" ? "red" : fam.name) : "gray";
  const step = mapLightnessToStep(ok.l);
  return { family, step };
}

function mapLightnessToStep(l: number): number {
  // 0.10 → 950, 0.20 → 900, 0.30 → 800, 0.40 → 700, 0.50 → 600, 0.55 → 500,
  // 0.65 → 400, 0.75 → 300, 0.85 → 200, 0.92 → 100, 0.97 → 50
  const stops: [number, number][] = [
    [0.97, 50],
    [0.92, 100],
    [0.85, 200],
    [0.75, 300],
    [0.65, 400],
    [0.55, 500],
    [0.45, 600],
    [0.35, 700],
    [0.25, 800],
    [0.15, 900],
    [0.05, 950],
  ];
  let best = stops[0];
  let bestDiff = Math.abs(l - stops[0][0]);
  for (const s of stops) {
    const diff = Math.abs(l - s[0]);
    if (diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }
  return best[1];
}

const SEMANTIC_TARGETS: { semantic: string; preferFamily?: string; preferStep?: number; preferKeyword?: string }[] = [
  { semantic: "--color-action", preferFamily: "blue", preferStep: 500, preferKeyword: "primary" },
  { semantic: "--color-success", preferFamily: "green", preferStep: 500, preferKeyword: "success" },
  { semantic: "--color-danger", preferFamily: "red", preferStep: 500, preferKeyword: "danger" },
  { semantic: "--color-warning", preferFamily: "amber", preferStep: 500, preferKeyword: "warning" },
  { semantic: "--color-fg", preferFamily: "gray", preferStep: 900, preferKeyword: "text" },
  { semantic: "--color-fg-muted", preferFamily: "gray", preferStep: 600 },
  { semantic: "--color-bg", preferFamily: "gray", preferStep: 50, preferKeyword: "background" },
  { semantic: "--color-bg-elevated", preferFamily: "gray", preferStep: 100 },
  { semantic: "--color-border", preferFamily: "gray", preferStep: 200 },
];

export function generateFix(audit: AuditResult): string {
  // Collect distinct primitive values, naming each with family-step.
  const primitives = new Map<string, string>(); // value → primitive name
  const primitiveLines: string[] = [];
  const usedNames = new Set<string>();

  for (const t of audit.tokens) {
    if (!isPrimitiveValue(t.rawValue)) continue;
    const key = t.rawValue.toLowerCase().replace(/\s+/g, "");
    if (primitives.has(key)) continue;
    let name: string;
    if (isPrimitiveStyleName(t.cssName)) {
      name = t.cssName;
    } else {
      const fam = familyForValue(t.rawValue);
      const base = fam ? `--color-${fam.family}-${fam.step}` : `--color-x-500`;
      name = base;
      let n = 1;
      while (usedNames.has(name)) {
        name = `${base}-${++n}`;
      }
    }
    usedNames.add(name);
    primitives.set(key, name);
    primitiveLines.push(`  ${name}: ${t.rawValue};`);
  }

  // Map each semantic target to the best-matching primitive.
  const semanticLines: string[] = [];
  for (const target of SEMANTIC_TARGETS) {
    let chosen: string | undefined;

    // 1. If a token in the audit already references this semantic name and is
    //    primitive-valued, use its value's primitive name.
    if (target.preferKeyword) {
      const match = audit.tokens.find(
        (t) =>
          isPrimitiveValue(t.rawValue) &&
          t.cssName.includes(target.preferKeyword!)
      );
      if (match) chosen = primitives.get(match.rawValue.toLowerCase().replace(/\s+/g, ""));
    }

    // 2. Fall back to family/step preference among the primitives we generated.
    if (!chosen && target.preferFamily) {
      const wanted = `--color-${target.preferFamily}-${target.preferStep}`;
      if (usedNames.has(wanted)) chosen = wanted;
      else {
        // Find any primitive in the same family
        const sameFamily = [...usedNames].find((n) =>
          n.startsWith(`--color-${target.preferFamily}-`)
        );
        if (sameFamily) chosen = sameFamily;
      }
    }

    if (chosen) {
      semanticLines.push(`  ${target.semantic}: var(${chosen});`);
    } else {
      semanticLines.push(`  ${target.semantic}: /* TODO: no matching primitive */;`);
    }
  }

  return [
    `/* Draft three-layer system from token-costumes.`,
    `   Negotiate this with your team. The semantic layer is suggested,`,
    `   not authoritative. */`,
    ``,
    `/* Primitives — raw colour ramps */`,
    `:root {`,
    ...primitiveLines,
    `}`,
    ``,
    `/* Semantic — purpose-bound aliases */`,
    `:root {`,
    ...semanticLines,
    `}`,
    ``,
  ].join("\n");
}

// --- Sample input ----------------------------------------------------------

export const SAMPLE_TOKENS = `{
  "color": {
    "primary": { "$value": "#3b82f6", "$type": "color" },
    "secondary": { "$value": "#8b5cf6", "$type": "color" },
    "success": { "$value": "#10b981", "$type": "color" },
    "danger": { "$value": "#ef4444", "$type": "color" },
    "primary-500": { "$value": "#3b82f6", "$type": "color" },
    "blue-500": { "$value": "#3b82f6", "$type": "color" },
    "colorBackground": { "$value": "#ffffff", "$type": "color" },
    "color-text": { "$value": "#0a0a0a", "$type": "color" }
  }
}`;
