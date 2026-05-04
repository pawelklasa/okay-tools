// honest-tokens generator engine.
// Given a brand anchor (and optional secondary), build a complete
// three-layer token system in OKLCH and emit it to multiple formats
// (DTCG JSON, vanilla CSS variables, Tailwind v4 @theme, shadcn/ui).
// Also generates an AI-tool brand contract file.

import {
  buildRamp,
  oklchCss,
  oklchToHex,
  parseColor,
  RAMP_STOPS,
  type OKLCH,
  type RampStop,
} from "./oklch";

export type Stack = "tailwind" | "shadcn" | "css" | "vue" | "dtcg";
export type AiTool = "claude" | "cursor" | "copilot" | "agents" | "none";

export const STACK_LABELS: Record<Stack, string> = {
  tailwind: "Tailwind v4",
  shadcn: "shadcn/ui",
  css: "CSS variables (vanilla)",
  vue: "Vue + CSS modules",
  dtcg: "DTCG JSON only",
};

export const AI_LABELS: Record<AiTool, string> = {
  claude: "Claude / Claude Code → CLAUDE.md",
  cursor: "Cursor → .cursorrules",
  copilot: "GitHub Copilot → custom instructions",
  agents: "Generic / multi-AI → AGENTS.md",
  none: "None — skip the contract file",
};

export const AI_FILENAMES: Record<AiTool, string> = {
  claude: "CLAUDE.md",
  cursor: ".cursorrules",
  copilot: ".github/copilot-instructions.md",
  agents: "AGENTS.md",
  none: "",
};

// ----------------------------------------------------------------------------
// Hue → name lookup
// ----------------------------------------------------------------------------

export function hueName(h: number): string {
  const a = ((h % 360) + 360) % 360;
  if (a < 15 || a >= 350) return "red";
  if (a < 45) return "orange";
  if (a < 70) return "yellow";
  if (a < 160) return "green";
  if (a < 200) return "teal";
  if (a < 250) return "blue";
  if (a < 290) return "indigo";
  if (a < 330) return "violet";
  return "pink";
}

// ----------------------------------------------------------------------------
// Build the system
// ----------------------------------------------------------------------------

export type GeneratedRamp = {
  name: string;
  steps: { stop: RampStop; oklch: OKLCH; hex: string; css: string }[];
};

export type SemanticAlias = { name: string; refs: string };
export type ComponentAlias = { name: string; refs: string };

export type GeneratedSystem = {
  anchor: { input: string; oklch: OKLCH; name: string };
  secondary: { input: string; oklch: OKLCH; name: string } | null;
  primitives: GeneratedRamp[];
  /** White and black anchors used by bg/fg semantics. */
  basics: { name: string; css: string; hex: string }[];
  semantics: SemanticAlias[];
  components: ComponentAlias[];
};

const STATE_HUES = {
  green: { l: 0.65, c: 0.16, h: 145 },
  yellow: { l: 0.82, c: 0.16, h: 90 },
  red: { l: 0.62, c: 0.21, h: 25 },
} as const;

function buildNamedRamp(name: string, anchor: OKLCH): GeneratedRamp {
  const ramp = buildRamp({ anchor });
  return {
    name,
    steps: RAMP_STOPS.map((stop) => ({
      stop,
      oklch: ramp[stop],
      hex: oklchToHex(ramp[stop]),
      css: oklchCss(ramp[stop]),
    })),
  };
}

export function generateSystem(
  anchorInput: string,
  secondaryInput?: string,
): GeneratedSystem | { error: string } {
  const anchor = parseColor(anchorInput);
  if (!anchor) {
    return { error: "Couldn't parse anchor colour. Try hex, oklch(), or hsl()." };
  }
  const secondary = secondaryInput?.trim() ? parseColor(secondaryInput) : null;
  if (secondaryInput?.trim() && !secondary) {
    return { error: "Couldn't parse secondary colour." };
  }

  const anchorName = hueName(anchor.h);
  const secondaryName = secondary ? deriveSecondaryName(anchorName, secondary.h) : null;

  // Neutrals: use the anchor hue with very low chroma (max 5%).
  const neutralAnchor: OKLCH = { l: 0.5, c: Math.min(0.012, anchor.c * 0.06), h: anchor.h };

  const primitives: GeneratedRamp[] = [];
  primitives.push(buildNamedRamp(anchorName, anchor));
  if (secondary && secondaryName) {
    primitives.push(buildNamedRamp(secondaryName, secondary));
  }
  primitives.push(buildNamedRamp("neutral", neutralAnchor));

  // State ramps. Skip any whose name collides with the anchor or secondary.
  const taken = new Set([anchorName, secondaryName]);
  for (const [stateName, sa] of Object.entries(STATE_HUES)) {
    if (taken.has(stateName)) continue;
    primitives.push(buildNamedRamp(stateName, sa as OKLCH));
  }

  const basics = [
    { name: "white", css: "oklch(1 0 0)", hex: "#ffffff" },
    { name: "black", css: "oklch(0 0 0)", hex: "#000000" },
  ];

  const greenName = taken.has("green") ? anchorName : "green";
  const yellowName = taken.has("yellow") ? anchorName : "yellow";
  const redName = taken.has("red") ? anchorName : "red";

  const semantics: SemanticAlias[] = [
    { name: "action", refs: `var(--color-${anchorName}-500)` },
    { name: "action-hover", refs: `var(--color-${anchorName}-600)` },
    { name: "success", refs: `var(--color-${greenName}-500)` },
    { name: "danger", refs: `var(--color-${redName}-500)` },
    { name: "warning", refs: `var(--color-${yellowName}-500)` },
    { name: "fg", refs: `var(--color-neutral-950)` },
    { name: "fg-muted", refs: `var(--color-neutral-600)` },
    { name: "bg", refs: `var(--color-white)` },
    { name: "bg-elevated", refs: `var(--color-neutral-50)` },
    { name: "border", refs: `var(--color-neutral-200)` },
  ];

  const components: ComponentAlias[] = [
    { name: "button-bg", refs: "var(--color-action)" },
    { name: "button-bg-hover", refs: "var(--color-action-hover)" },
    { name: "link", refs: "var(--color-action)" },
    { name: "ring", refs: "var(--color-action)" },
  ];

  return {
    anchor: { input: anchorInput, oklch: anchor, name: anchorName },
    secondary: secondary && secondaryName
      ? { input: secondaryInput!.trim(), oklch: secondary, name: secondaryName }
      : null,
    primitives,
    basics,
    semantics,
    components,
  };
}

function deriveSecondaryName(anchorName: string, secondaryH: number): string {
  const n = hueName(secondaryH);
  return n === anchorName ? "accent" : n;
}

// ----------------------------------------------------------------------------
// Format emitters
// ----------------------------------------------------------------------------

export function emitCss(sys: GeneratedSystem): string {
  const lines: string[] = [];
  lines.push(":root {");
  lines.push("  /* Primitives — values live here. */");
  for (const ramp of sys.primitives) {
    for (const step of ramp.steps) {
      lines.push(`  --color-${ramp.name}-${step.stop}: ${step.css};`);
    }
    lines.push("");
  }
  for (const b of sys.basics) {
    lines.push(`  --color-${b.name}: ${b.css};`);
  }
  lines.push("");
  lines.push("  /* Semantics — name a purpose, alias a primitive. */");
  for (const s of sys.semantics) {
    lines.push(`  --color-${s.name}: ${s.refs};`);
  }
  lines.push("");
  lines.push("  /* Components — alias semantics, never primitives. */");
  for (const c of sys.components) {
    lines.push(`  --${c.name}: ${c.refs};`);
  }
  lines.push("}");
  return lines.join("\n");
}

export function emitTailwind(sys: GeneratedSystem): string {
  const lines: string[] = [];
  lines.push("@theme {");
  for (const ramp of sys.primitives) {
    for (const step of ramp.steps) {
      lines.push(`  --color-${ramp.name}-${step.stop}: ${step.css};`);
    }
  }
  for (const b of sys.basics) {
    lines.push(`  --color-${b.name}: ${b.css};`);
  }
  lines.push("");
  lines.push("  /* Semantic aliases */");
  for (const s of sys.semantics) {
    lines.push(`  --color-${s.name}: ${s.refs};`);
  }
  lines.push("}");
  return lines.join("\n");
}

export function emitDtcg(sys: GeneratedSystem): string {
  const color: Record<string, { $value: string; $type: "color" }> = {};
  for (const ramp of sys.primitives) {
    for (const step of ramp.steps) {
      color[`${ramp.name}-${step.stop}`] = { $value: step.css, $type: "color" };
    }
  }
  for (const b of sys.basics) {
    color[b.name] = { $value: b.css, $type: "color" };
  }
  for (const s of sys.semantics) {
    color[s.name] = { $value: refToDtcg(s.refs), $type: "color" };
  }
  const out = { color };
  return JSON.stringify(out, null, 2);
}

function refToDtcg(refs: string): string {
  // var(--color-blue-500) → {color.blue-500}
  // var(--color-action) → {color.action}
  const m = refs.match(/var\(--color-([a-z0-9-]+)\)/i);
  if (m) return `{color.${m[1]}}`;
  return refs;
}

export function emitShadcn(sys: GeneratedSystem): string {
  const a = sys.anchor.name;
  const lines: string[] = [];
  lines.push(":root {");
  lines.push(`  --background: oklch(1 0 0);`);
  lines.push(`  --foreground: ${cssRef(sys, "neutral-950")};`);
  lines.push(`  --card: oklch(1 0 0);`);
  lines.push(`  --card-foreground: ${cssRef(sys, "neutral-950")};`);
  lines.push(`  --popover: oklch(1 0 0);`);
  lines.push(`  --popover-foreground: ${cssRef(sys, "neutral-950")};`);
  lines.push(`  --primary: ${cssRef(sys, `${a}-500`)};`);
  lines.push(`  --primary-foreground: ${cssRef(sys, `${a}-50`)};`);
  lines.push(`  --secondary: ${cssRef(sys, "neutral-100")};`);
  lines.push(`  --secondary-foreground: ${cssRef(sys, "neutral-900")};`);
  lines.push(`  --muted: ${cssRef(sys, "neutral-100")};`);
  lines.push(`  --muted-foreground: ${cssRef(sys, "neutral-600")};`);
  lines.push(`  --accent: ${cssRef(sys, "neutral-100")};`);
  lines.push(`  --accent-foreground: ${cssRef(sys, "neutral-900")};`);
  lines.push(`  --destructive: ${cssRef(sys, "red-500", a)};`);
  lines.push(`  --destructive-foreground: oklch(0.98 0.01 0);`);
  lines.push(`  --border: ${cssRef(sys, "neutral-200")};`);
  lines.push(`  --input: ${cssRef(sys, "neutral-200")};`);
  lines.push(`  --ring: ${cssRef(sys, `${a}-500`)};`);
  lines.push("}");
  lines.push("");
  lines.push(".dark {");
  lines.push(`  --background: ${cssRef(sys, "neutral-950")};`);
  lines.push(`  --foreground: ${cssRef(sys, "neutral-50")};`);
  lines.push(`  --card: ${cssRef(sys, "neutral-900")};`);
  lines.push(`  --card-foreground: ${cssRef(sys, "neutral-50")};`);
  lines.push(`  --popover: ${cssRef(sys, "neutral-900")};`);
  lines.push(`  --popover-foreground: ${cssRef(sys, "neutral-50")};`);
  lines.push(`  --primary: ${cssRef(sys, `${a}-400`)};`);
  lines.push(`  --primary-foreground: ${cssRef(sys, `${a}-950`)};`);
  lines.push(`  --secondary: ${cssRef(sys, "neutral-800")};`);
  lines.push(`  --secondary-foreground: ${cssRef(sys, "neutral-50")};`);
  lines.push(`  --muted: ${cssRef(sys, "neutral-800")};`);
  lines.push(`  --muted-foreground: ${cssRef(sys, "neutral-400")};`);
  lines.push(`  --accent: ${cssRef(sys, "neutral-800")};`);
  lines.push(`  --accent-foreground: ${cssRef(sys, "neutral-50")};`);
  lines.push(`  --destructive: ${cssRef(sys, "red-500", a)};`);
  lines.push(`  --destructive-foreground: ${cssRef(sys, "neutral-50")};`);
  lines.push(`  --border: ${cssRef(sys, "neutral-800")};`);
  lines.push(`  --input: ${cssRef(sys, "neutral-800")};`);
  lines.push(`  --ring: ${cssRef(sys, `${a}-500`)};`);
  lines.push("}");
  return lines.join("\n");
}

function cssRef(sys: GeneratedSystem, key: string, fallback?: string): string {
  // Resolve a primitive ramp step name → its OKLCH value.
  const m = key.match(/^([a-z]+)-(\d+)$/);
  if (m) {
    const want = sys.primitives.find((r) => r.name === m[1]);
    const stop = Number(m[2]);
    const step = want?.steps.find((s) => s.stop === stop);
    if (step) return step.css;
    if (fallback) {
      const fb = sys.primitives.find((r) => r.name === fallback);
      const fbStep = fb?.steps.find((s) => s.stop === stop);
      if (fbStep) return fbStep.css;
    }
  }
  return "oklch(0.5 0 0)";
}

// ----------------------------------------------------------------------------
// AI brand contract
// ----------------------------------------------------------------------------

export function emitContract(sys: GeneratedSystem, ai: AiTool): string {
  if (ai === "none") return "";

  const a = sys.anchor.name;
  const second = sys.secondary?.name;

  const core = [
    "## Colour",
    "",
    "Always reference semantic tokens, not primitives:",
    "",
    "- Use `--color-action` for primary actions (buttons, links)",
    "- Use `--color-success`, `--color-danger`, `--color-warning` for state",
    "- Use `--color-fg`, `--color-fg-muted`, `--color-bg`, `--color-bg-elevated`, `--color-border` for layout",
    "",
    `Never use Tailwind named colours like \`bg-purple-600\` or \`text-red-500\`.`,
    `Never use arbitrary values like \`bg-[#3b82f6]\`.`,
    "",
    "## Spacing",
    "",
    "Use multiples of 4px from the spacing scale.",
    "Never use arbitrary values.",
    "",
    `## Brand colours`,
    "",
    `- Anchor: \`${sys.anchor.input}\` → primitive ramp \`--color-${a}-50\` through \`--color-${a}-950\``,
    second
      ? `- Secondary: \`${sys.secondary!.input}\` → primitive ramp \`--color-${second}-50\` through \`--color-${second}-950\``
      : "",
    "",
    "## Generated by okay.tools — generate.okay.tools",
  ]
    .filter(Boolean)
    .join("\n");

  if (ai === "claude") {
    return `# Brand contract\n\nThis project uses a token-based design system. Always reference tokens; never use raw values or arbitrary classes.\n\n${core}\n`;
  }
  if (ai === "agents") {
    return `# AGENTS.md — Brand contract\n\nThis project uses a token-based design system. All AI agents must reference tokens; never use raw values or arbitrary classes.\n\n${core}\n`;
  }
  if (ai === "cursor") {
    // .cursorrules is plain text rules, not markdown.
    return [
      "You are working in a project with a strict design token system.",
      "",
      "RULES:",
      "- Always reference semantic CSS custom properties; never use raw hex, rgb, or oklch values.",
      "- Use --color-action for primary actions, --color-success / --color-danger / --color-warning for state.",
      "- Use --color-fg, --color-fg-muted, --color-bg, --color-bg-elevated, --color-border for layout.",
      "- Never use Tailwind named colours like bg-purple-600 or text-red-500.",
      "- Never use arbitrary values like bg-[#3b82f6].",
      "- Use multiples of 4px from the spacing scale; never arbitrary spacing.",
      "",
      `Brand anchor: ${sys.anchor.input} (--color-${a}-* ramp).`,
      second ? `Secondary: ${sys.secondary!.input} (--color-${second}-* ramp).` : "",
      "",
      "Generated by okay.tools.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (ai === "copilot") {
    return `# GitHub Copilot — Custom instructions\n\nWhen generating code for this repository, follow these rules.\n\n${core}\n`;
  }
  return "";
}

// ----------------------------------------------------------------------------
// Audit summary
// ----------------------------------------------------------------------------

export type SystemSummary = {
  primitiveCount: number;
  semanticCount: number;
  componentCount: number;
  rampCount: number;
};

export function summarise(sys: GeneratedSystem): SystemSummary {
  const primitiveCount =
    sys.primitives.reduce((n, r) => n + r.steps.length, 0) + sys.basics.length;
  return {
    primitiveCount,
    semanticCount: sys.semantics.length,
    componentCount: sys.components.length,
    rampCount: sys.primitives.length,
  };
}
