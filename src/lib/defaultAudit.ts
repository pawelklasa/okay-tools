// Default Audit — pattern-matching diagnostic for AI-era CSS/JSX defaults.
//
// Pure regex, no AST. Operates on raw pasted text. Detections are grouped
// per "key" so multiple shadcn token names show as ONE row with a count and
// a collapsible evidence list, not eight separate rows.

export type Source =
  | "shadcn/ui"
  | "Tailwind"
  | "Lucide"
  | "Heroicons"
  | "Radix"
  | "Inter"
  | "Geist"
  | "tailwindcss-animate";

export type Category =
  | "components"
  | "color tokens"
  | "spacing"
  | "border radius"
  | "typography"
  | "icons"
  | "layout"
  | "animation";

// Stable detection keys used for both grouping and scoring.
export type DetectionKey =
  | "shadcn_tokens"
  | "shadcn_cn_utility"
  | "cva_import"
  | "radix_imports"
  | "shadcn_classnames"
  | "shadcn_components_path"
  | "shadcn_button_variants"
  | "shadcn_radius_var"
  | "shadcn_neutral_ramp"
  | "tailwind_detected"
  | "tailwind_animate"
  | "shadcn_keyframes"
  | "default_radius_md"
  | "default_radius_lg"
  | "default_radius_full"
  | "default_spacing"
  | "default_shadow"
  | "default_type_scale"
  | "tracking_tight"
  | "inter_or_geist"
  | "lucide_icons"
  | "radix_icons"
  | "heroicons"
  | "layout_max_w_7xl"
  | "sticky_backdrop_blur"
  | "gradient_hero"
  | "responsive_grid";

export interface Evidence {
  line: number;
  text: string;
  match?: string;
}

export interface DetectionGroup {
  key: DetectionKey;
  category: Category;
  name: string;
  source: Source;
  reachedFor: string;
  items: string[];
  evidence: Evidence[];
  note?: string;
}

export interface AuditResult {
  groups: DetectionGroup[];
  byCategory: Record<Category, DetectionGroup[]>;
  fired: Set<DetectionKey>;
  totalEvidence: number;
  score: number;
  scoreLabel: string;
  scoreBreakdown: {
    key: DetectionKey;
    name: string;
    weight: number;
    count: number;
    multiplier: number;
    applied: number;
  }[];
  truncated: boolean;
  inputBytes: number;
  isImage: boolean;
}

export const MAX_BYTES = 2_000_000;

// ---------------------------------------------------------------------------
// Score weights — explicit per detection key. Sum capped at 100.
// ---------------------------------------------------------------------------

// Weights are calibrated so a default-saturated real production site lands
// in the 70–90 band, not 100. The 95 cap reserves 96–100 for hand-crafted
// edge cases that no real site should ever reach.
export const SCORE_WEIGHTS: Partial<Record<DetectionKey, number>> = {
  shadcn_tokens: 18,
  shadcn_classnames: 14,
  shadcn_cn_utility: 10,
  shadcn_keyframes: 8,
  cva_import: 7,
  radix_imports: 7,
  tailwind_detected: 14,
  shadcn_neutral_ramp: 7,
  default_spacing: 7,
  default_type_scale: 6,
  default_shadow: 5,
  gradient_hero: 4,
  inter_or_geist: 6,
  lucide_icons: 6,
  default_radius_md: 4,
  default_radius_lg: 4,
  default_radius_full: 2,
  tailwind_animate: 4,
  layout_max_w_7xl: 4,
  sticky_backdrop_blur: 4,
  tracking_tight: 2,
};

// Softer curve. Single hits are weak signal; saturation needs 11+.
function getCountMultiplier(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 0.5;
  if (count <= 3) return 0.75;
  if (count <= 10) return 0.9;
  return 1;
}

interface GroupSpec {
  category: Category;
  name: string;
  source: Source;
  reachedFor: string;
  note?: string;
}

const GROUP_SPECS: Record<DetectionKey, GroupSpec> = {
  shadcn_tokens: {
    category: "color tokens",
    name: "shadcn color tokens",
    source: "shadcn/ui",
    reachedFor: "AI tools (Claude, Cursor, v0, Lovable), shadcn-init",
    note: "(HSL space-separated)",
  },
  shadcn_cn_utility: {
    category: "components",
    name: "cn() utility from @/lib/utils",
    source: "shadcn/ui",
    reachedFor: "AI tools, shadcn-init",
  },
  cva_import: {
    category: "components",
    name: "class-variance-authority",
    source: "shadcn/ui",
    reachedFor: "AI tools, shadcn-init",
  },
  radix_imports: {
    category: "components",
    name: "Radix primitive imports",
    source: "Radix",
    reachedFor: "AI tools, shadcn-init",
  },
  shadcn_classnames: {
    category: "components",
    name: "shadcn semantic classNames",
    source: "shadcn/ui",
    reachedFor: "AI tools, shadcn-init",
  },
  shadcn_components_path: {
    category: "components",
    name: "components/ui/* file paths",
    source: "shadcn/ui",
    reachedFor: "AI tools, shadcn-init",
  },
  shadcn_button_variants: {
    category: "components",
    name: "shadcn button variant set",
    source: "shadcn/ui",
    reachedFor: "AI tools, shadcn-init",
  },
  shadcn_radius_var: {
    category: "border radius",
    name: "--radius variable",
    source: "shadcn/ui",
    reachedFor: "shadcn-init; AI tools follow",
  },
  shadcn_neutral_ramp: {
    category: "color tokens",
    name: "Tailwind neutral ramp",
    source: "Tailwind",
    reachedFor: "AI tools, Tailwind defaults",
  },
  tailwind_detected: {
    category: "components",
    name: "Tailwind utility classes",
    source: "Tailwind",
    reachedFor: "AI tools — the AI-era CSS default",
  },
  tailwind_animate: {
    category: "animation",
    name: "tailwindcss-animate plugin",
    source: "tailwindcss-animate",
    reachedFor: "AI tools, shadcn-init",
  },
  shadcn_keyframes: {
    category: "animation",
    name: "shadcn accordion keyframes",
    source: "shadcn/ui",
    reachedFor: "shadcn-init",
  },
  default_radius_md: {
    category: "border radius",
    name: "rounded-md",
    source: "Tailwind",
    reachedFor: "AI tools, shadcn — the AI-era button/input default",
  },
  default_radius_lg: {
    category: "border radius",
    name: "rounded-lg",
    source: "Tailwind",
    reachedFor: "AI tools, shadcn — the AI-era card default",
  },
  default_radius_full: {
    category: "border radius",
    name: "rounded-full",
    source: "Tailwind",
    reachedFor: "AI tools — avatars and pills",
  },
  default_spacing: {
    category: "spacing",
    name: "Tailwind default spacing scale",
    source: "Tailwind",
    reachedFor: "AI tools, Tailwind defaults — 4px-base 1/2/4/6/8/12/16",
  },
  default_shadow: {
    category: "layout",
    name: "Tailwind default shadows",
    source: "Tailwind",
    reachedFor: "AI tools — the AI-era card default",
  },
  default_type_scale: {
    category: "typography",
    name: "Tailwind type scale",
    source: "Tailwind",
    reachedFor: "AI tools, Tailwind defaults",
  },
  tracking_tight: {
    category: "typography",
    name: "tracking-tight on headings",
    source: "Tailwind",
    reachedFor: "AI tools — the AI-era heading default",
  },
  inter_or_geist: {
    category: "typography",
    name: "Inter or Geist as sans",
    source: "Inter",
    reachedFor: "AI tools, Vercel/Next.js templates, shadcn-init",
  },
  lucide_icons: {
    category: "icons",
    name: "lucide-react icons",
    source: "Lucide",
    reachedFor: "AI tools, shadcn-init — the AI-era icon default",
  },
  radix_icons: {
    category: "icons",
    name: "@radix-ui/react-icons",
    source: "Radix",
    reachedFor: "AI tools, shadcn-init",
  },
  heroicons: {
    category: "icons",
    name: "@heroicons/react",
    source: "Heroicons",
    reachedFor: "AI tools, Tailwind UI templates",
  },
  layout_max_w_7xl: {
    category: "layout",
    name: "max-w-7xl + mx-auto container",
    source: "Tailwind",
    reachedFor: "AI tools, Tailwind UI templates",
  },
  sticky_backdrop_blur: {
    category: "layout",
    name: "sticky top-0 + backdrop-blur",
    source: "Tailwind",
    reachedFor: "AI tools — the AI-era sticky header default",
  },
  gradient_hero: {
    category: "layout",
    name: "Tailwind gradient backgrounds",
    source: "Tailwind",
    reachedFor: "AI tools — the AI-era hero default",
  },
  responsive_grid: {
    category: "layout",
    name: "1 / 2 / 3 column responsive grid",
    source: "Tailwind",
    reachedFor: "AI tools — the AI-era marketing-grid default",
  },
};

interface Rule {
  key: DetectionKey;
  test: RegExp; // must have global flag
  itemFromMatch?: (match: RegExpExecArray) => string | null;
  skipIf?: (line: string) => boolean;
}

const RULES: Rule[] = [
  {
    key: "shadcn_tokens",
    test: /--(?:background|foreground|primary(?:-foreground)?|secondary(?:-foreground)?|muted(?:-foreground)?|accent(?:-foreground)?|destructive(?:-foreground)?|border|input|ring|card(?:-foreground)?|popover(?:-foreground)?)\b/g,
    itemFromMatch: (m) => m[0],
  },
  {
    key: "shadcn_radius_var",
    test: /--radius\s*:/g,
    itemFromMatch: () => "--radius",
  },
  {
    key: "shadcn_cn_utility",
    test: /from\s+["']@\/lib\/utils["']/g,
    itemFromMatch: () => "@/lib/utils",
  },
  {
    key: "cva_import",
    test: /class-variance-authority/g,
    itemFromMatch: () => "class-variance-authority",
  },
  {
    key: "radix_imports",
    test: /@radix-ui\/react-(?!icons\b)([a-z-]+)/g,
    itemFromMatch: (m) => `@radix-ui/react-${m[1]}`,
  },
  {
    key: "shadcn_components_path",
    test: /components\/ui\/([a-z-]+)\.tsx?/g,
    itemFromMatch: (m) => `components/ui/${m[1]}`,
  },
  {
    key: "shadcn_classnames",
    test: /\b(?:bg-background|text-foreground|text-muted-foreground|bg-primary|text-primary-foreground|ring-ring|bg-card|text-card-foreground|bg-popover|bg-destructive|bg-secondary|bg-accent)\b/g,
    itemFromMatch: (m) => m[0],
  },
  {
    key: "shadcn_button_variants",
    test: /\b(default|destructive|outline|secondary|ghost|link)\s*:\s*["']/g,
    itemFromMatch: (m) => m[1],
    skipIf: (line) => !/variants?|cva\(/i.test(line),
  },
  {
    key: "shadcn_neutral_ramp",
    test: /\b(?:slate|zinc|neutral|stone|gray|grey)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g,
    itemFromMatch: (m) => m[0],
  },
  {
    key: "default_radius_md",
    test: /\brounded-md\b/g,
    itemFromMatch: () => "rounded-md",
  },
  {
    key: "default_radius_lg",
    test: /\brounded-lg\b/g,
    itemFromMatch: () => "rounded-lg",
  },
  {
    key: "default_radius_full",
    test: /\brounded-full\b/g,
    itemFromMatch: () => "rounded-full",
  },
  {
    key: "inter_or_geist",
    test: /["']Inter["']|font-family:\s*Inter\b|fontFamily:\s*\[?\s*["']Inter["']|\bGeist(?:Sans|Mono|Variable)?\b/g,
    itemFromMatch: (m) => (/Geist/.test(m[0]) ? "Geist" : "Inter"),
  },
  {
    key: "tracking_tight",
    test: /\btracking-tight\b/g,
    itemFromMatch: () => "tracking-tight",
  },
  {
    key: "default_type_scale",
    test: /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)\b/g,
    itemFromMatch: (m) => `text-${m[1]}`,
  },
  {
    key: "lucide_icons",
    test: /from\s+["']lucide-react["']/g,
    itemFromMatch: () => "lucide-react",
  },
  {
    key: "radix_icons",
    test: /from\s+["']@radix-ui\/react-icons["']/g,
    itemFromMatch: () => "@radix-ui/react-icons",
  },
  {
    key: "heroicons",
    test: /from\s+["']@heroicons\/react/g,
    itemFromMatch: () => "@heroicons/react",
  },
  {
    key: "gradient_hero",
    test: /\bbg-gradient-to-(?:b|br|t|tr|r|l|bl|tl)\b/g,
    itemFromMatch: (m) => m[0],
  },
  {
    key: "default_shadow",
    test: /\bshadow-(?:sm|md|lg|xl|2xl)\b/g,
    itemFromMatch: (m) => m[0],
  },
  {
    key: "sticky_backdrop_blur",
    test: /\bsticky\s+top-0\b[^"']*\bbackdrop-blur\b|\bbackdrop-blur\b[^"']*\bsticky\s+top-0\b/g,
    itemFromMatch: () => "sticky top-0 backdrop-blur",
  },
  {
    key: "layout_max_w_7xl",
    test: /\bmax-w-7xl\b[^"']*\bmx-auto\b|\bmx-auto\b[^"']*\bmax-w-7xl\b/g,
    itemFromMatch: () => "max-w-7xl mx-auto",
  },
  {
    key: "responsive_grid",
    test: /\bgrid-cols-1\b[^"']*\bmd:grid-cols-2\b[^"']*\blg:grid-cols-3\b/g,
    itemFromMatch: () => "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  },
  {
    key: "tailwind_animate",
    test: /tailwindcss-animate/g,
    itemFromMatch: () => "tailwindcss-animate",
  },
  {
    key: "shadcn_keyframes",
    test: /accordion-(?:down|up)/g,
    itemFromMatch: (m) => m[0],
  },
];

// Spacing — count occurrences. Only fires when ≥3 hits.
const SPACING_RE =
  /\b(?:p|m|gap|space-x|space-y|px|py|pt|pr|pb|pl|mx|my|mt|mr|mb|ml)-(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|8|10|12|16|20|24|32)\b/g;

// Tailwind fingerprint — fires once if any Tailwind utility appears.
const TAILWIND_FINGERPRINT_RE =
  /\b(?:flex|grid|block|hidden|items-(?:center|start|end)|justify-(?:center|between|start|end)|p[xytrbl]?-\d+|m[xytrbl]?-\d+|gap-\d+|rounded(?:-(?:sm|md|lg|xl|full))?|shadow-(?:sm|md|lg|xl)|w-(?:full|screen|\d+)|h-(?:full|screen|\d+)|max-w-\w+|min-h-\w+|space-[xy]-\d+|md:[a-z][a-z0-9-]+|lg:[a-z][a-z0-9-]+|sm:[a-z][a-z0-9-]+|hover:[a-z][a-z0-9-]+|focus:[a-z][a-z0-9-]+)\b/;

const CATEGORIES: Category[] = [
  "components",
  "color tokens",
  "spacing",
  "border radius",
  "typography",
  "icons",
  "layout",
  "animation",
];

function emptyByCategory(): Record<Category, DetectionGroup[]> {
  return CATEGORIES.reduce(
    (acc, c) => ({ ...acc, [c]: [] }),
    {} as Record<Category, DetectionGroup[]>
  );
}

function looksLikeImage(text: string): boolean {
  const head = text.slice(0, 200);
  if (/^data:image\//i.test(head.trim())) return true;
  const firstLine = head.split(/\r?\n/)[0] ?? "";
  if (firstLine.length > 180 && /^[A-Za-z0-9+/=\s]+$/.test(firstLine)) return true;
  return false;
}

export function audit(rawText: string): AuditResult {
  const inputBytes = new Blob([rawText]).size;
  const truncated = inputBytes > MAX_BYTES;
  const text = truncated ? rawText.slice(0, MAX_BYTES) : rawText;
  const isImage = looksLikeImage(text);

  if (!text.trim() || isImage) {
    return {
      groups: [],
      byCategory: emptyByCategory(),
      fired: new Set(),
      totalEvidence: 0,
      score: 0,
      scoreLabel: labelFor(0),
      scoreBreakdown: [],
      truncated,
      inputBytes,
      isImage,
    };
  }

  const lines = text.split(/\r?\n/);
  const groups = new Map<DetectionKey, DetectionGroup>();

  function ensure(key: DetectionKey): DetectionGroup {
    let g = groups.get(key);
    if (!g) {
      const spec = GROUP_SPECS[key];
      g = {
        key,
        category: spec.category,
        name: spec.name,
        source: spec.source,
        reachedFor: spec.reachedFor,
        note: spec.note,
        items: [],
        evidence: [],
      };
      groups.set(key, g);
    }
    return g;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    for (const rule of RULES) {
      if (rule.skipIf?.(line)) continue;
      rule.test.lastIndex = 0;
      let m: RegExpExecArray | null;
      const perLineSeen = new Set<string>();
      while ((m = rule.test.exec(line)) !== null) {
        const item = rule.itemFromMatch ? rule.itemFromMatch(m) : null;
        const dedupeKey = item ?? `${rule.key}:${lineNum}:${m.index}`;
        if (perLineSeen.has(dedupeKey)) {
          if (m.index === rule.test.lastIndex) rule.test.lastIndex++;
          continue;
        }
        perLineSeen.add(dedupeKey);

        const g = ensure(rule.key);
        if (item && !g.items.includes(item)) g.items.push(item);
        if (g.evidence.length < 30) {
          g.evidence.push({ line: lineNum, text: line.trim(), match: item ?? undefined });
        }
        if (m.index === rule.test.lastIndex) rule.test.lastIndex++;
      }
    }
  }

  // Spacing aggregate
  let spacingCount = 0;
  const spacingItems = new Set<string>();
  const spacingEvidence: Evidence[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    SPACING_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    let lineHadHit = false;
    while ((m = SPACING_RE.exec(line)) !== null) {
      spacingCount++;
      spacingItems.add(m[0]);
      lineHadHit = true;
      if (m.index === SPACING_RE.lastIndex) SPACING_RE.lastIndex++;
    }
    if (lineHadHit && spacingEvidence.length < 30) {
      spacingEvidence.push({ line: i + 1, text: line.trim() });
    }
  }
  if (spacingCount >= 3) {
    const g = ensure("default_spacing");
    g.items = [...spacingItems];
    g.evidence = spacingEvidence;
  }

  // Tailwind fingerprint
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(TAILWIND_FINGERPRINT_RE);
    if (m) {
      const g = ensure("tailwind_detected");
      if (g.items.length === 0) g.items.push("tailwind utility classes");
      if (g.evidence.length < 5) {
        g.evidence.push({ line: i + 1, text: line.trim(), match: m[0] });
      }
    }
  }

  const ordered = [...groups.values()].sort((a, b) => {
    const ca = CATEGORIES.indexOf(a.category);
    const cb = CATEGORIES.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.name.localeCompare(b.name);
  });

  const byCategory = emptyByCategory();
  for (const g of ordered) byCategory[g.category].push(g);

  const fired = new Set<DetectionKey>(groups.keys());
  const breakdown: AuditResult["scoreBreakdown"] = [];
  let raw = 0;
  for (const k of fired) {
    const w = SCORE_WEIGHTS[k];
    if (typeof w !== "number" || w <= 0) continue;
    const g = groups.get(k)!;
    // Detection count = unique items where available, else evidence rows.
    const count = g.items.length > 0 ? g.items.length : g.evidence.length;
    const multiplier = getCountMultiplier(count);
    const applied = Math.round(w * multiplier * 10) / 10;
    if (applied <= 0) continue;
    raw += applied;
    breakdown.push({
      key: k,
      name: GROUP_SPECS[k].name,
      weight: w,
      count,
      multiplier,
      applied,
    });
  }
  const score = Math.min(95, Math.round(raw));
  const totalEvidence = ordered.reduce((sum, g) => sum + g.evidence.length, 0);

  return {
    groups: ordered,
    byCategory,
    fired,
    totalEvidence,
    score,
    scoreLabel: labelFor(score),
    scoreBreakdown: breakdown.sort((a, b) => b.applied - a.applied),
    truncated,
    inputBytes,
    isImage,
  };
}

function labelFor(score: number): string {
  if (score <= 10) return "Mostly your own work.";
  if (score <= 30) return "You made some choices. Some defaults remain.";
  if (score <= 55) return "Mixed. Some defaults, some custom work.";
  if (score <= 75) return "Mostly defaults with light customisation.";
  return "Default-heavy. AI built most of this, or you built what AI builds.";
}

// ---------------------------------------------------------------------------

export type InputMode = "url" | "css" | "jsx" | "classes";

export const SAMPLES: Record<InputMode, string> = {
  url: "https://linear.app",
  css: `:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --border: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}

@layer base {
  body {
    font-family: 'Inter', sans-serif;
  }
}
`,
  jsx: `import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { cva } from "class-variance-authority"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ChevronDown } from "lucide-react"

export function Card() {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <header className="sticky top-0 backdrop-blur bg-background/80">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <h1 className="text-2xl font-semibold tracking-tight">Hello</h1>
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
        <Button className="bg-primary text-primary-foreground rounded-md">
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
`,
  classes: `flex items-center gap-4 rounded-lg border bg-card text-muted-foreground shadow-sm px-6 py-4 max-w-7xl mx-auto tracking-tight`,
};

export const MODE_LABELS: Record<InputMode, string> = {
  url: "Paste URL",
  css: "Paste CSS",
  jsx: "Paste HTML/JSX",
  classes: "Paste class names",
};

export const SOURCE_COLORS: Record<Source, string> = {
  "shadcn/ui": "oklch(0.78 0.16 80)",
  Tailwind: "oklch(0.74 0.15 230)",
  Lucide: "oklch(0.78 0.14 160)",
  Heroicons: "oklch(0.78 0.14 200)",
  Radix: "oklch(0.74 0.16 290)",
  Inter: "oklch(0.85 0.05 270)",
  Geist: "oklch(0.85 0.05 270)",
  "tailwindcss-animate": "oklch(0.74 0.15 200)",
};
