// token-costumes audit engine.
// Parses W3C DTCG JSON, CSS custom properties, or Tailwind-shaped color
// objects. Detects costume tokens, polysemy by value-collision, missing
// layers, naming-convention drift, and CSS orphans.

export type Token = {
  /** Dot-path display name, e.g. "color.primary". */
  name: string;
  /** Normalised CSS custom property form, e.g. "--color-primary". */
  cssName: string;
  /** Resolved value text. Aliases keep their original form. */
  value: string;
  /** True if value is `var(--x)` or `{token.path}` reference. */
  isAlias: boolean;
  /** Referenced cssName when isAlias. */
  aliasOf?: string;
};

export type Format = "json" | "css" | "tailwind" | "unknown";

export type CostumeFinding = { kind: "costume"; token: Token; reason: string };
export type PolysemyFinding = {
  kind: "polysemy";
  token: Token;
  siblings: string[];
  reason: string;
};
export type NamingFinding = {
  kind: "naming";
  conventions: string[];
  tokens: Token[];
};
export type OrphanFinding = { kind: "orphan"; token: Token };
export type Finding = CostumeFinding | PolysemyFinding | NamingFinding | OrphanFinding;

export type Layers = {
  primitive: number;
  semantic: number;
  component: number;
  fakeSemantic: boolean;
  missing: ("primitive" | "semantic" | "component")[];
};

export type Verdict = "HEALTHY" | "DRIFT-PRONE" | "WEARING COSTUMES";

export type Audit = {
  format: Format;
  tokens: Token[];
  findings: Finding[];
  costumes: CostumeFinding[];
  polysemic: PolysemyFinding[];
  naming?: NamingFinding;
  orphans: OrphanFinding[];
  costumeCount: number;
  polysemicCount: number;
  layers: Layers;
  verdict: Verdict;
};

// ----------------------------------------------------------------------------
// Vocabulary
// ----------------------------------------------------------------------------

const SEMANTIC_WORDS = new Set([
  "primary","secondary","tertiary","accent","brand",
  "success","danger","error","warning","warn","info",
  "action","link","focus","active","hover","disabled",
  "fg","foreground","text","content",
  "bg","background","surface","elevated","raised",
  "border","outline","ring","divider",
  "positive","negative","neutral","muted","dim","subtle",
]);

const PRIMITIVE_HUE_WORDS = new Set([
  "red","orange","amber","yellow","lime","green","emerald","teal","cyan",
  "sky","blue","indigo","violet","purple","fuchsia","pink","rose",
  "gray","grey","slate","zinc","stone","black","white",
]);

const COMPONENT_PREFIXES = [
  "button","btn","input","field","card","modal","dialog","menu","nav","tab",
  "tooltip","badge","chip","pill","alert","toast","banner","table","row",
];

// ----------------------------------------------------------------------------
// Detect format
// ----------------------------------------------------------------------------

export function detectFormat(text: string): Format {
  const t = text.trim();
  if (!t) return "unknown";
  if (t.startsWith("{")) {
    if (/"\$value"|"\$type"/.test(t)) return "json";
    if (/colors?\s*:|theme\s*:|extend\s*:/.test(t)) return "tailwind";
    return "json";
  }
  if (/--[a-zA-Z][a-zA-Z0-9_-]*\s*:/.test(t)) return "css";
  if (/colors?\s*:\s*\{/.test(t)) return "tailwind";
  return "unknown";
}

// ----------------------------------------------------------------------------
// Parsers
// ----------------------------------------------------------------------------

export function parseTokens(text: string, format: Format): Token[] {
  if (format === "json") return parseJson(text);
  if (format === "css") return parseCss(text);
  if (format === "tailwind") return parseTailwind(text);
  return [];
}

function parseJson(text: string): Token[] {
  const data = JSON.parse(text);
  const out: Token[] = [];
  walkJson(data, [], out);
  return out;
}

function walkJson(node: unknown, path: string[], out: Token[]): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if ("$value" in obj) {
    const raw = String(obj.$value);
    const aliasMatch = /^\{([^}]+)\}$/.exec(raw);
    const isAlias = !!aliasMatch;
    const cssName = "--" + path.map(slug).join("-");
    const aliasOf = aliasMatch
      ? "--" + aliasMatch[1].split(".").map(slug).join("-")
      : undefined;
    out.push({
      name: path.join("."),
      cssName,
      value: isAlias ? `var(${aliasOf})` : raw,
      isAlias,
      aliasOf,
    });
    return;
  }
  for (const k of Object.keys(obj)) walkJson(obj[k], [...path, k], out);
}

function parseCss(text: string): Token[] {
  const out: Token[] = [];
  const re = /(--[a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const cssName = m[1];
    const value = m[2].trim();
    const aliasMatch = /var\((--[a-zA-Z][a-zA-Z0-9_-]*)\)/.exec(value);
    out.push({
      name: cssName.replace(/^--/, "").replace(/-/g, "."),
      cssName,
      value,
      isAlias: !!aliasMatch,
      aliasOf: aliasMatch?.[1],
    });
  }
  return out;
}

// Best-effort Tailwind: extract leaf string values from any `colors: { ... }`
// or top-level `{ ... }` block. Picks up { name: "#..." } and nested
// { hue: { 500: "#..." } } shapes.
function parseTailwind(text: string): Token[] {
  const out: Token[] = [];
  const seen = new Set<string>();
  const re =
    /['"]?([a-zA-Z][\w-]*)['"]?\s*:\s*['"]((?:#[A-Fa-f0-9]{3,8})|(?:rgba?\([^)]+\))|(?:oklch\([^)]+\))|(?:hsla?\([^)]+\)))['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const key = m[1];
    const val = m[2];
    // Try to find parent key for nested shapes by walking backwards.
    const before = text.slice(0, m.index);
    const parent = /['"]?([a-zA-Z][\w-]*)['"]?\s*:\s*\{[^{}]*$/.exec(before);
    const path = parent ? [parent[1], key] : [key];
    const cssName = "--color-" + path.map(slug).join("-");
    if (seen.has(cssName)) continue;
    seen.add(cssName);
    out.push({
      name: "color." + path.join("."),
      cssName,
      value: val,
      isAlias: false,
    });
  }
  return out;
}

function slug(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

// ----------------------------------------------------------------------------
// Heuristics
// ----------------------------------------------------------------------------

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);
}

function isSemanticName(name: string): boolean {
  return nameTokens(name).some((p) => SEMANTIC_WORDS.has(p));
}

function isPrimitiveName(name: string): boolean {
  return nameTokens(name).some((p) => PRIMITIVE_HUE_WORDS.has(p));
}

function isComponentName(name: string): boolean {
  const parts = nameTokens(name);
  return parts.some((p) => COMPONENT_PREFIXES.includes(p));
}

function detectConvention(rawName: string): "kebab" | "camel" | "snake" | "single" {
  const stripped = rawName.replace(/^--/, "").replace(/^color[.-]/, "");
  if (stripped.includes("_")) return "snake";
  if (/[a-z][A-Z]/.test(stripped)) return "camel";
  if (stripped.includes("-")) return "kebab";
  return "single";
}

// ----------------------------------------------------------------------------
// Audit
// ----------------------------------------------------------------------------

export function auditTokens(tokens: Token[], format: Format, raw: string): Audit {
  // ---- Costumes: semantic-named, literal-valued, not a hue primitive ----
  const costumes: CostumeFinding[] = [];
  for (const t of tokens) {
    if (t.isAlias) continue;
    if (!isSemanticName(t.name)) continue;
    // Hue primitives like blue-500 are fine even if they sneak past the
    // semantic check (they don't, but keep the guard cheap).
    const semWords = nameTokens(t.name).filter((p) => SEMANTIC_WORDS.has(p));
    const hueWords = nameTokens(t.name).filter((p) => PRIMITIVE_HUE_WORDS.has(p));
    if (hueWords.length && !semWords.length) continue;
    costumes.push({
      kind: "costume",
      token: t,
      reason: "wears a semantic name, defined as a primitive",
    });
  }

  // ---- Polysemy: tokens sharing a literal value ----
  const polysemic: PolysemyFinding[] = [];
  const byValue = new Map<string, Token[]>();
  for (const t of tokens) {
    if (t.isAlias) continue;
    const key = t.value.replace(/\s+/g, "").toLowerCase();
    const arr = byValue.get(key) ?? [];
    arr.push(t);
    byValue.set(key, arr);
  }
  for (const arr of byValue.values()) {
    if (arr.length < 2) continue;
    for (const t of arr) {
      const others = arr.filter((x) => x.cssName !== t.cssName);
      polysemic.push({
        kind: "polysemy",
        token: t,
        siblings: others.map((o) => o.cssName),
        reason: `shares a value with ${others.length} other token${
          others.length === 1 ? "" : "s"
        }: ${others.map((o) => o.cssName).join(", ")}`,
      });
    }
  }

  // ---- Layers ----
  const primitiveTokens = tokens.filter((t) => !t.isAlias && !isComponentName(t.name));
  const semanticTokens = tokens.filter(
    (t) => t.isAlias && !isComponentName(t.name)
  );
  const componentTokens = tokens.filter((t) => isComponentName(t.name));
  const fakeSemantic = semanticTokens.length === 0 && costumes.length > 0;
  const missing: Layers["missing"] = [];
  if (primitiveTokens.length === 0) missing.push("primitive");
  if (semanticTokens.length === 0) missing.push("semantic");
  if (componentTokens.length === 0) missing.push("component");

  const layers: Layers = {
    primitive: primitiveTokens.length,
    semantic: semanticTokens.length,
    component: componentTokens.length,
    fakeSemantic,
    missing,
  };

  // ---- Naming drift ----
  const conventions = new Set<string>();
  for (const t of tokens) {
    const c = detectConvention(t.cssName);
    if (c !== "single") conventions.add(c);
  }
  let naming: NamingFinding | undefined;
  if (conventions.size >= 2) {
    naming = {
      kind: "naming",
      conventions: Array.from(conventions),
      tokens,
    };
  }

  // ---- Orphans (CSS only) ----
  const orphans: OrphanFinding[] = [];
  if (format === "css" && raw) {
    for (const t of tokens) {
      const refRe = new RegExp(`var\\(\\s*${escapeRe(t.cssName)}\\s*[,)]`);
      // Count uses outside of this token's own declaration line.
      const matches = raw.match(new RegExp(refRe.source, "g")) ?? [];
      if (matches.length === 0) orphans.push({ kind: "orphan", token: t });
    }
  }

  // ---- Verdict ----
  const costumeCount = costumes.length;
  const polysemicCount = polysemic.length;
  const allPrimitive = tokens.length > 0 && tokens.every((t) => !t.isAlias);
  let verdict: Verdict;
  if (costumeCount >= 4 || (allPrimitive && costumeCount > 0 && fakeSemantic)) {
    verdict = "WEARING COSTUMES";
  } else if (
    costumeCount > 0 ||
    polysemicCount > 0 ||
    missing.length > 0 ||
    !!naming
  ) {
    verdict = "DRIFT-PRONE";
  } else {
    verdict = "HEALTHY";
  }

  const findings: Finding[] = [
    ...costumes,
    ...polysemic,
    ...(naming ? [naming] : []),
    ...orphans,
  ];

  return {
    format,
    tokens,
    findings,
    costumes,
    polysemic,
    naming,
    orphans,
    costumeCount,
    polysemicCount,
    layers,
    verdict,
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ----------------------------------------------------------------------------
// Sample input
// ----------------------------------------------------------------------------

export const SAMPLE_JSON = `{
  "color": {
    "primary":   { "$value": "#3b82f6", "$type": "color" },
    "secondary": { "$value": "#8b5cf6", "$type": "color" },
    "success":   { "$value": "#10b981", "$type": "color" },
    "danger":    { "$value": "#ef4444", "$type": "color" },
    "primary-500": { "$value": "#3b82f6", "$type": "color" },
    "blue-500":    { "$value": "#3b82f6", "$type": "color" },
    "colorBackground": { "$value": "#ffffff", "$type": "color" },
    "color-text":      { "$value": "#0a0a0a", "$type": "color" }
  }
}`;

// ----------------------------------------------------------------------------
// Draft three-layer system generator
// ----------------------------------------------------------------------------

const HUE_BUCKETS: { name: string; min: number; max: number }[] = [
  { name: "red",     min: 345, max: 360 },
  { name: "red",     min: 0,   max: 15 },
  { name: "orange",  min: 15,  max: 40 },
  { name: "amber",   min: 40,  max: 55 },
  { name: "yellow",  min: 55,  max: 70 },
  { name: "lime",    min: 70,  max: 90 },
  { name: "green",   min: 90,  max: 150 },
  { name: "teal",    min: 150, max: 180 },
  { name: "cyan",    min: 180, max: 200 },
  { name: "blue",    min: 200, max: 250 },
  { name: "indigo",  min: 250, max: 270 },
  { name: "violet",  min: 270, max: 290 },
  { name: "purple",  min: 290, max: 310 },
  { name: "pink",    min: 310, max: 345 },
];

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hueFamily(value: string): string | null {
  const rgb = hexToRgb(value);
  if (!rgb) return null;
  const [h, s, l] = rgbToHsl(...rgb);
  if (l < 0.05) return "black";
  if (l > 0.95 && s < 0.05) return "white";
  if (s < 0.08) return "gray";
  for (const b of HUE_BUCKETS) if (h >= b.min && h < b.max) return b.name;
  return null;
}

export function generateDraftSystem(audit: Audit): string {
  const lines: string[] = [];
  lines.push("/* Draft three-layer system from token-costumes.");
  lines.push("   Negotiate this with your team. The semantic layer is suggested,");
  lines.push("   not authoritative. */");
  lines.push("");

  // 1. Primitives — dedupe by value, name by hue family.
  const literals = audit.tokens.filter((t) => !t.isAlias);
  const valueToName = new Map<string, string>();
  const familyCount = new Map<string, number>();

  // Prefer existing primitive-named tokens as canonical names.
  for (const t of literals) {
    const fam = hueFamily(t.value);
    if (!fam) continue;
    const isPrim = isPrimitiveName(t.name);
    if (isPrim && !valueToName.has(t.value)) {
      valueToName.set(t.value, t.cssName);
    }
  }

  // Generate names for the rest, bucketed by hue family.
  for (const t of literals) {
    if (valueToName.has(t.value)) continue;
    const fam = hueFamily(t.value);
    if (!fam) {
      valueToName.set(t.value, `--color-${slug(nameTokens(t.name).join("-")) || "raw"}`);
      continue;
    }
    if (fam === "white") {
      valueToName.set(t.value, "--color-white");
      continue;
    }
    if (fam === "black") {
      valueToName.set(t.value, "--color-black");
      continue;
    }
    const next = (familyCount.get(fam) ?? 0) + 1;
    familyCount.set(fam, next);
    const step = next === 1 ? "500" : `${500 + next * 100}`;
    valueToName.set(t.value, `--color-${fam}-${step}`);
  }

  lines.push("/* 1. Primitives — raw values, hue-bucketed names */");
  const written = new Set<string>();
  const primEntries: { name: string; value: string }[] = [];
  for (const [value, name] of valueToName.entries()) {
    if (written.has(name)) continue;
    written.add(name);
    primEntries.push({ name, value });
  }
  primEntries.sort((a, b) => a.name.localeCompare(b.name));
  for (const p of primEntries) lines.push(`${p.name}: ${p.value};`);
  lines.push("");

  // 2. Semantic — map by family where possible.
  lines.push("/* 2. Semantic — purpose-bound aliases */");
  const byFamily = (fam: string) => {
    for (const t of literals) {
      if (hueFamily(t.value) === fam) return valueToName.get(t.value);
    }
    return null;
  };
  const action = byFamily("blue") ?? byFamily("indigo") ?? null;
  const success = byFamily("green") ?? byFamily("emerald") ?? byFamily("teal") ?? null;
  const danger = byFamily("red") ?? null;
  const warning = byFamily("amber") ?? byFamily("yellow") ?? byFamily("orange") ?? null;
  const fg = (() => {
    for (const t of literals) {
      const rgb = hexToRgb(t.value);
      if (rgb && rgbToHsl(...rgb)[2] < 0.2) return valueToName.get(t.value);
    }
    return null;
  })();
  const bg = (() => {
    for (const t of literals) {
      const rgb = hexToRgb(t.value);
      if (rgb && rgbToHsl(...rgb)[2] > 0.95) return valueToName.get(t.value);
    }
    return null;
  })();

  const sem = (label: string, ref: string | null | undefined) => {
    if (ref) lines.push(`${label}: var(${ref});`);
    else lines.push(`${label}: /* set me — no match in your tokens */;`);
  };
  sem("--color-action", action);
  sem("--color-success", success);
  sem("--color-danger", danger);
  sem("--color-warning", warning);
  sem("--color-fg", fg);
  lines.push("--color-fg-muted: /* set me */;");
  sem("--color-bg", bg);
  lines.push("--color-bg-elevated: /* set me */;");
  lines.push("--color-border: /* set me */;");
  lines.push("");

  // 3. Component
  lines.push("/* 3. Component — add component-specific aliases as the system grows.");
  lines.push("   --button-bg: var(--color-action);");
  lines.push("   --link:      var(--color-action);");
  lines.push("   --ring:      var(--color-action); */");

  return lines.join("\n");
}
