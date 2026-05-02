import { RAMP_STOPS, oklchCss, oklchToHex, type OKLCH, type RampStop } from "./oklch";

export type Ramp = Record<RampStop, OKLCH>;

export function exportTailwindV4(name: string, ramp: Ramp): string {
  const lines = RAMP_STOPS.map(
    (s) => `  --color-${name}-${s}: ${oklchCss(ramp[s])};`,
  );
  return `@theme {\n${lines.join("\n")}\n}\n`;
}

export function exportShadcn(name: string, ramp: Ramp): string {
  const lines = RAMP_STOPS.map(
    (s) => `  --${name}-${s}: ${oklchCss(ramp[s])};`,
  );
  return `:root {\n${lines.join("\n")}\n}\n`;
}

export function exportCssVars(name: string, ramp: Ramp): string {
  const lines = RAMP_STOPS.map(
    (s) => `  --${name}-${s}: ${oklchCss(ramp[s])};`,
  );
  return `:root {\n${lines.join("\n")}\n}\n`;
}

export function exportJsonTokens(name: string, ramp: Ramp): string {
  const out: Record<string, { $value: string; $type: "color" }> = {};
  RAMP_STOPS.forEach((s) => {
    out[String(s)] = { $value: oklchCss(ramp[s]), $type: "color" };
  });
  return JSON.stringify({ [name]: out }, null, 2);
}

export function exportHexList(name: string, ramp: Ramp): string {
  return RAMP_STOPS.map((s) => `${name}-${s}: ${oklchToHex(ramp[s])}`).join("\n");
}

export function exportSCSS(name: string, ramp: Ramp): string {
  return RAMP_STOPS.map(
    (s) => `$${name}-${s}: ${oklchCss(ramp[s])};`,
  ).join("\n") + "\n";
}

export const EXPORT_FORMATS = [
  { id: "tailwind", label: "Tailwind v4 @theme", fn: exportTailwindV4 },
  { id: "shadcn", label: "shadcn/ui CSS vars", fn: exportShadcn },
  { id: "css", label: "CSS custom properties", fn: exportCssVars },
  { id: "json", label: "Design tokens (DTCG JSON)", fn: exportJsonTokens },
  { id: "scss", label: "SCSS variables", fn: exportSCSS },
  { id: "hex", label: "Hex fallback list", fn: exportHexList },
] as const;
