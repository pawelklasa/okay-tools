import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  buildRamp,
  clampToSrgb,
  oklchCss,
  oklchToHex,
  parseColor,
  RAMP_STOPS,
  type OKLCH,
  type RampStop,
} from "../lib/oklch";
import { encodeRamp } from "../lib/share";
import { Button, Field, HexInput, PageHeader } from "../components/ui";

type Harmony = "monochrome" | "complementary" | "analogous" | "split" | "triad" | "tetrad";
type Ramp = Record<RampStop, OKLCH>;

const HARMONY_LABELS: Record<Harmony, string> = {
  monochrome: "Monochrome",
  complementary: "Complementary",
  analogous: "Analogous",
  split: "Split-complement",
  triad: "Triad",
  tetrad: "Tetrad",
};

function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

function harmonyOffsets(harmony: Harmony, spread: number): number[] {
  if (harmony === "monochrome") return [0];
  if (harmony === "complementary") return [180];
  if (harmony === "analogous") return [-spread / 2, spread / 2];
  if (harmony === "split") return [180 - spread / 2, 180 + spread / 2];
  if (harmony === "triad") return [120, 240];
  return [90, 180, 270];
}

function inferHarmonyChroma(anchorC: number): number {
  // Keep harmony anchors vivid enough to feel related while avoiding clipping spikes.
  if (anchorC < 0.1) return 1;
  if (anchorC < 0.18) return 0.92;
  return 0.84;
}

function makeHarmonyAnchors(anchor: OKLCH, harmony: Harmony, spread: number, chromaScale: number) {
  const offsets = harmonyOffsets(harmony, spread);
  const names = ["accent-1", "accent-2", "accent-3"];
  return offsets.slice(0, 3).map((off, i) => {
    const color = clampToSrgb({
      l: anchor.l,
      c: Math.max(0.01, anchor.c * chromaScale),
      h: wrapHue(anchor.h + off),
    });
    return { name: names[i], color };
  });
}

function makeNeutralAnchor(anchor: OKLCH): OKLCH {
  return clampToSrgb({
    l: 0.62,
    c: Math.min(0.035, Math.max(0.008, anchor.c * 0.14)),
    h: anchor.h,
  });
}

function makeSemanticRampFromPrimary(primary: Ramp, hue: number): Ramp {
  const out = {} as Ramp;
  RAMP_STOPS.forEach((stop) => {
    const p = primary[stop];
    out[stop] = clampToSrgb({ l: p.l, c: p.c, h: wrapHue(hue) });
  });
  return out;
}

function exportRampLines(name: string, ramp: Ramp): string {
  return RAMP_STOPS.map((s) => `  --${name}-${s}: ${oklchCss(ramp[s])};`).join("\n");
}

export function PaletteGenerator() {
  const [anchor, setAnchor] = useState<OKLCH>({ l: 0.68, c: 0.17, h: 265 });
  const [hexInput, setHexInput] = useState(oklchToHex(anchor));
  const [harmony, setHarmony] = useState<Harmony>("analogous");
  const [spread, setSpread] = useState(90);
  const [copied, setCopied] = useState(false);

  const system = useMemo(() => {
    const primaryRamp = buildRamp({ anchor, taperChroma: true });

    const harmonyChroma = inferHarmonyChroma(anchor.c);
    const harmonyAnchors = makeHarmonyAnchors(anchor, harmony, spread, harmonyChroma);
    const harmonyRamps = harmonyAnchors.map((h) => ({
      name: h.name,
      anchor: h.color,
      ramp: buildRamp({ anchor: h.color, taperChroma: true }),
    }));

    const neutralAnchor = makeNeutralAnchor(anchor);
    const neutralRamp = buildRamp({ anchor: neutralAnchor, taperChroma: true });

    const semantic = {
      success: makeSemanticRampFromPrimary(primaryRamp, 145),
      warning: makeSemanticRampFromPrimary(primaryRamp, 85),
      danger: makeSemanticRampFromPrimary(primaryRamp, 25),
    };

    return { primaryRamp, harmonyAnchors, harmonyRamps, neutralAnchor, neutralRamp, semantic };
  }, [anchor, harmony, spread]);

  const cssBlock = useMemo(() => {
    const lines: string[] = [];
    lines.push(":root {");
    lines.push("  /* Core brand ramps */");
    lines.push(exportRampLines("primary", system.primaryRamp));
    lines.push("");
    system.harmonyRamps.forEach((r) => {
      lines.push(exportRampLines(r.name, r.ramp));
      lines.push("");
    });
    lines.push("  /* Hue-aware neutrals */");
    lines.push(exportRampLines("neutral", system.neutralRamp));
    lines.push("");
    lines.push("  /* Semantic ramps with matched visual weight */");
    lines.push(exportRampLines("success", system.semantic.success));
    lines.push(exportRampLines("warning", system.semantic.warning));
    lines.push(exportRampLines("danger", system.semantic.danger));
    lines.push("");
    lines.push("  /* Starter semantic aliases */");
    lines.push("  --bg: var(--neutral-50);");
    lines.push("  --surface: var(--neutral-100);");
    lines.push("  --border: var(--neutral-300);");
    lines.push("  --fg-muted: var(--neutral-700);");
    lines.push("  --fg: var(--neutral-950);");
    lines.push("  --brand: var(--primary-500);");
    lines.push("  --brand-hover: var(--primary-600);");
    lines.push("  --ok: var(--success-500);");
    lines.push("  --warn: var(--warning-500);");
    lines.push("  --err: var(--danger-500);");
    lines.push("}");
    return lines.join("\n");
  }, [system]);

  const onHexChange = (v: string) => {
    setHexInput(v);
    const parsed = parseColor(v);
    if (parsed) setAnchor(parsed);
  };

  const copyCss = async () => {
    await navigator.clipboard.writeText(cssBlock);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const rampUrl = `/color/ramp?s=${encodeRamp({
    anchor,
    name: "primary",
    curve: "linear",
  })}`;

  return (
    <>
      <PageHeader
        eyebrow="Palette generator"
        title="From one colour to a system."
        description="Primary ramp, harmony anchors, neutral ramp, and semantic colors with matched weight. Export a real design-system starter in one copy."
        actions={<Button onClick={copyCss}>{copied ? "Copied ✓" : "Copy system CSS"}</Button>}
      />

      <section className="px-8 lg:px-12 pb-16 grid lg:grid-cols-[360px_1fr] gap-8">
        <aside className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5 space-y-4">
          <Field label="Anchor colour" hint={oklchCss(anchor)}>
            <HexInput value={hexInput} onChange={onHexChange} />
          </Field>

          <div>
            <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-dim)] mb-2">
              Harmony rule
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(HARMONY_LABELS) as Harmony[]).map((h) => (
                <button
                  key={h}
                  onClick={() => setHarmony(h)}
                  className={`px-3 py-2 rounded-[var(--radius-sm)] text-[12px] text-left transition ${
                    harmony === h
                      ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                      : "bg-[var(--color-bg)] text-[var(--color-fg-muted)] border border-[var(--color-border)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  {HARMONY_LABELS[h]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Link
              to={rampUrl}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[12px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition inline-flex items-center justify-between gap-2"
            >
              <span className="inline-flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <rect x="1" y="9" width="2" height="6" fill="currentColor" />
                  <rect x="5" y="6" width="2" height="9" fill="currentColor" />
                  <rect x="9" y="3" width="2" height="12" fill="currentColor" />
                  <rect x="13" y="1" width="2" height="14" fill="currentColor" />
                </svg>
                Tune primary in Ramp Generator
              </span>
              <span aria-hidden>→</span>
            </Link>
            <Link
              to="/color/dark-mode"
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[12px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition inline-flex items-center justify-between gap-2"
            >
              <span className="inline-flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" />
                  <path d="M8 2v12" stroke="currentColor" />
                </svg>
                Build light/dark tokens
              </span>
              <span aria-hidden>→</span>
            </Link>
          </div>

          <details className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <summary className="mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-fg-dim)] cursor-pointer select-none">
              Harmony tuning (optional)
            </summary>
            <div className="pt-3">
              <Field label="Hue spread" hint={`${spread}°`}>
                <input
                  type="range"
                  min={30}
                  max={180}
                  step={1}
                  value={spread}
                  onChange={(e) => setSpread(parseFloat(e.target.value))}
                />
              </Field>
            </div>
          </details>

          <div className="pt-2 border-t border-[var(--color-border)] text-[13px] text-[var(--color-fg-muted)] leading-relaxed space-y-2">
            <p>
              Harmony generated <span className="mono">{system.harmonyAnchors.length}</span> additional
              anchor{system.harmonyAnchors.length > 1 ? "s" : ""}.
            </p>
            <p>
              Semantic ramps reuse primary L and C, so <span className="mono">success/warning/danger</span>
              sit at the same visual weight.
            </p>
          </div>
        </aside>

        <div className="space-y-5 min-w-0">
          <RampPanel title="Primary" name="primary" ramp={system.primaryRamp} emphasize />

          {system.harmonyRamps.map((r) => (
            <RampPanel
              key={r.name}
              title={`Harmony · ${r.name}`}
              name={r.name}
              ramp={r.ramp}
            />
          ))}

          <RampPanel
            title="Neutrals"
            subtitle="Neutrals · tinted toward your primary."
            name="neutral"
            ramp={system.neutralRamp}
          />

          <div className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-4 space-y-3">
            <p className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)]">
              Semantic ramps · same visual weight as primary
            </p>
            <RampMiniRow name="success" ramp={system.semantic.success} />
            <RampMiniRow name="warning" ramp={system.semantic.warning} />
            <RampMiniRow name="danger" ramp={system.semantic.danger} />
          </div>

          <details className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
            <summary className="mono text-[11px] text-[var(--color-fg-dim)] cursor-pointer select-none">
              Generated {(5 + system.harmonyRamps.length) * 11} colour tokens, 10 semantic aliases. Preview copied system CSS
            </summary>
            <pre className="mt-3 mono text-[11.5px] text-[var(--color-fg-muted)] overflow-x-auto whitespace-pre">
              {cssBlock}
            </pre>
          </details>
        </div>
      </section>
    </>
  );
}

function RampPanel({
  title,
  subtitle,
  name,
  ramp,
  emphasize = false,
}: {
  title: string;
  subtitle?: string;
  name: string;
  ramp: Ramp;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-start justify-between gap-3">
        <div>
          <p className={`text-[13px] ${emphasize ? "text-[var(--color-fg)] font-semibold" : "text-[var(--color-fg-muted)]"}`}>
            {title}
          </p>
          {subtitle && <p className="text-[11px] text-[var(--color-fg-dim)] mt-0.5">{subtitle}</p>}
        </div>
        <p className="mono text-[10px] text-[var(--color-fg-dim)]">11 steps</p>
      </div>
      <div className="grid grid-cols-11">
        {RAMP_STOPS.map((s) => (
          <div key={s} className="h-20 sm:h-24 p-2 flex items-end" style={{ background: oklchToHex(ramp[s]) }}>
            <span className="mono text-[9px] px-1 py-0.5 rounded bg-black/40 text-white/85">{s}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] mono text-[10.5px] text-[var(--color-fg-dim)] overflow-x-auto whitespace-nowrap">
        {RAMP_STOPS.map((s) => `--${name}-${s}`).join("  ·  ")}
      </div>
    </div>
  );
}

function RampMiniRow({ name, ramp }: { name: string; ramp: Ramp }) {
  return (
    <div className="grid grid-cols-[90px_1fr] items-center gap-3">
      <span className="mono text-[10.5px] text-[var(--color-fg-muted)]">{name}</span>
      <div className="grid grid-cols-11 rounded overflow-hidden border border-[var(--color-border)]">
        {RAMP_STOPS.map((s) => (
          <div key={s} className="h-7" style={{ background: oklchToHex(ramp[s]) }} />
        ))}
      </div>
    </div>
  );
}
