import { useMemo, useState } from "react";
import {
  buildRamp,
  invertRamp,
  oklchCss,
  parseColor,
  type OKLCH,
  type RampStop,
} from "../lib/oklch";
import { Button, Field, HexInput, PageHeader } from "../components/ui";

type Ramp = Record<RampStop, OKLCH>;

/**
 * Maps a ramp into semantic theme tokens (the names a designer/dev actually
 * wires up in their app). For light mode we use the natural ramp; for dark
 * mode the inverted ramp — same token names, opposite L axis.
 */
function semanticTokens(ramp: Ramp) {
  return {
    bg: ramp[50],
    surface: ramp[100],
    "surface-2": ramp[200],
    border: ramp[300],
    "border-strong": ramp[400],
    "fg-dim": ramp[500],
    "fg-muted": ramp[700],
    fg: ramp[900],
    "fg-strong": ramp[950],
    accent: ramp[500],
    "accent-fg": ramp[50],
    "accent-hover": ramp[600],
  } as const;
}

type SemanticTokens = ReturnType<typeof semanticTokens>;

export function DarkModeInverter() {
  const [hex, setHex] = useState("#2563eb");
  const [name, setName] = useState("brand");
  const [exportId, setExportId] = useState<"css" | "tailwind" | "scss">("css");

  const anchor: OKLCH = parseColor(hex) ?? { l: 0.62, c: 0.2, h: 255 };
  const light = useMemo(() => buildRamp({ anchor, taperChroma: true }), [anchor]);
  const dark = useMemo(() => invertRamp(light), [light]);

  const lightTokens = semanticTokens(light);
  const darkTokens = semanticTokens(dark);

  const exported = formatExport(exportId, name, lightTokens, darkTokens);

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(exported);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <PageHeader
        eyebrow="Light + Dark theme builder"
        title="One brand colour. Both modes. Same token names."
        description="Paste your brand colour. Get a complete light + dark theme with semantic tokens (bg, surface, fg, accent…) ready to drop into your CSS, Tailwind config or SCSS."
      />

      <div className="px-8 lg:px-12 pt-6 grid sm:grid-cols-[260px_200px] gap-5 max-w-2xl">
        <Field label="Brand colour">
          <HexInput value={hex} onChange={setHex} />
        </Field>
        <Field label="Token prefix">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
          />
        </Field>
      </div>

      {/* Side-by-side previews using the actual semantic tokens */}
      <div className="px-8 lg:px-12 py-8 grid lg:grid-cols-2 gap-5">
        <ThemePreview label="Light" tokens={lightTokens} />
        <ThemePreview label="Dark" tokens={darkTokens} />
      </div>

      {/* Token table — the useful bit */}
      <div className="px-8 lg:px-12 pb-8">
        <h2 className="mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-3">
          Token map
        </h2>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden">
          <table className="w-full mono text-xs">
            <thead className="bg-[var(--color-surface)] text-[var(--color-fg-dim)]">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium uppercase tracking-wider text-[10px]">
                  Token
                </th>
                <th className="text-left px-4 py-2.5 font-medium uppercase tracking-wider text-[10px]">
                  Light
                </th>
                <th className="text-left px-4 py-2.5 font-medium uppercase tracking-wider text-[10px]">
                  Dark
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(lightTokens).map((k) => {
                const key = k as keyof SemanticTokens;
                return (
                  <tr key={k} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-2 text-[var(--color-fg)]">--{name}-{k}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-sm border border-[var(--color-border)]"
                          style={{ background: oklchCss(lightTokens[key]) }}
                        />
                        <span className="text-[var(--color-fg-muted)]">
                          {oklchCss(lightTokens[key])}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-sm border border-[var(--color-border)]"
                          style={{ background: oklchCss(darkTokens[key]) }}
                        />
                        <span className="text-[var(--color-fg-muted)]">
                          {oklchCss(darkTokens[key])}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export */}
      <div className="px-8 lg:px-12 pb-12">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden">
          <div className="flex items-center gap-1 p-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
            {(
              [
                { id: "css", label: "CSS variables" },
                { id: "tailwind", label: "Tailwind v4 @theme" },
                { id: "scss", label: "SCSS" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setExportId(f.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded text-xs transition ${
                  exportId === f.id
                    ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                {f.label}
              </button>
            ))}
            <Button onClick={copy} variant="primary" className="ml-auto">
              {copied ? "Copied ✓" : "Copy"}
            </Button>
          </div>
          <pre className="mono text-xs text-[var(--color-fg-muted)] leading-relaxed p-5 overflow-x-auto whitespace-pre">
            {exported}
          </pre>
        </div>
      </div>
    </>
  );
}

function ThemePreview({ label, tokens }: { label: string; tokens: SemanticTokens }) {
  const t = (k: keyof SemanticTokens) => oklchCss(tokens[k]);
  return (
    <div
      className="rounded-[var(--radius)] overflow-hidden border"
      style={{ background: t("bg"), borderColor: t("border"), color: t("fg") }}
    >
      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: t("border") }}>
        <span className="text-sm font-semibold">{label}</span>
        <span className="mono text-[10px] uppercase tracking-wider" style={{ color: t("fg-dim") }}>
          live preview
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Card */}
        <div
          className="rounded-[var(--radius-sm)] p-4 border"
          style={{ background: t("surface"), borderColor: t("border") }}
        >
          <div className="text-sm font-semibold" style={{ color: t("fg-strong") }}>
            Card title
          </div>
          <div className="text-xs mt-1 leading-relaxed" style={{ color: t("fg-muted") }}>
            Body text on a surface. The contrast is wired by token name, not stop number.
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            className="flex-1 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium"
            style={{ background: t("accent"), color: t("accent-fg") }}
          >
            Primary
          </button>
          <button
            className="flex-1 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium border"
            style={{ borderColor: t("border-strong"), color: t("fg-muted"), background: "transparent" }}
          >
            Secondary
          </button>
        </div>

        {/* Input */}
        <input
          placeholder="email@example.com"
          className="w-full px-3 py-2 rounded-[var(--radius-sm)] text-sm border focus:outline-none"
          style={{ background: t("surface-2"), borderColor: t("border"), color: t("fg") }}
        />

        {/* Body text scale */}
        <div className="text-xs leading-relaxed" style={{ color: t("fg-dim") }}>
          Caption / hint
        </div>
      </div>
    </div>
  );
}

function tokenLines(prefix: string, tokens: SemanticTokens, sep: string) {
  return Object.entries(tokens)
    .map(([k, v]) => `  --${prefix}-${k}${sep} ${oklchCss(v)};`)
    .join("\n");
}

function formatExport(
  id: "css" | "tailwind" | "scss",
  prefix: string,
  light: SemanticTokens,
  dark: SemanticTokens,
): string {
  if (id === "css") {
    return `:root {\n${tokenLines(prefix, light, ":")}\n}\n\n[data-theme="dark"], .dark {\n${tokenLines(prefix, dark, ":")}\n}\n`;
  }
  if (id === "tailwind") {
    return `@theme {\n${tokenLines(prefix, light, ":")}\n}\n\n@layer base {\n  .dark {\n${tokenLines(prefix, dark, ":")}\n  }\n}\n`;
  }
  // scss
  const toScss = (tokens: SemanticTokens, suffix: string) =>
    Object.entries(tokens)
      .map(([k, v]) => `$${prefix}-${k}-${suffix}: ${oklchCss(v)};`)
      .join("\n");
  return `// Light\n${toScss(light, "light")}\n\n// Dark\n${toScss(dark, "dark")}\n`;
}
