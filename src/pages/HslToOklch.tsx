import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  convertHslLines,
  oklchToHex,
  replaceHslInCss,
  type CssReplaceMatch,
  type HslConvertEntry,
  type HslConvertMode,
  type HslConvertResult,
} from "../lib/oklch";
import { encodeRamp } from "../lib/share";
import { PageHeader, Pill } from "../components/ui";

type InputMode = "list" | "css";

// Eight seed examples spanning the full drift range — yellow/green up, blue/navy down,
// neutrals near zero. The yellow row is the screenshot.
const SEED_LIST = `hsl(60 100% 50%)
hsl(120 100% 50%)
hsl(0 100% 50%)
hsl(300 100% 50%)
hsl(240 100% 50%)
hsl(210 25% 60%)
hsl(0 0% 90%)
hsl(0 0% 20%)`;

const SEED_CSS = `:root {
  --brand: hsl(240 100% 50%);
  --accent: hsl(60 100% 50%);
  --success: hsl(140 70% 45%);
  --muted: hsl(210 25% 60%);
  --bg: hsla(0 0% 98% / 1);
  --fg: hsl(220 15% 12%);
}`;

export function HslToOklch() {
  const [inputMode, setInputMode] = useState<InputMode>("list");
  const [convertMode, setConvertMode] = useState<HslConvertMode>("literal");
  const [listText, setListText] = useState(SEED_LIST);
  const [cssText, setCssText] = useState(SEED_CSS);

  return (
    <>
      <PageHeader
        eyebrow="HSL → OKLCH"
        title="See the lie. Then migrate."
        description="HSL claims a single L slider controls brightness. It doesn't. Paste your palette and watch the drift — yellow at L=50% is near-white. Blue at L=50% is mid-grey. Same number, different brightness."
      />

      <div className="px-8 lg:px-12 flex flex-wrap gap-x-8 gap-y-4 items-end">
        <Toggle
          label="Input"
          value={inputMode}
          onChange={(v) => setInputMode(v as InputMode)}
          options={[
            { value: "list", label: "One per line" },
            { value: "css", label: "CSS snippet" },
          ]}
        />
        <Toggle
          label="Conversion"
          value={convertMode}
          onChange={(v) => setConvertMode(v as HslConvertMode)}
          options={[
            { value: "literal", label: "Literal" },
            { value: "perceptual", label: "Perceptual" },
          ]}
        />
        <p className="mono text-[11px] text-[var(--color-fg-dim)] pb-1.5 max-w-md">
          {convertMode === "literal"
            ? "Appearance preserved. The migration-safe default."
            : "Lightness re-mapped so 50% reads as mid-grey. Colours will shift."}{" "}
          <Link
            to="/hsl-lies"
            className="underline decoration-[var(--color-border-strong)] underline-offset-[3px] hover:decoration-[var(--color-fg)] text-[var(--color-fg-muted)]"
          >
            What's the difference? →
          </Link>
        </p>
      </div>

      {inputMode === "list" ? (
        <ListView
          text={listText}
          setText={setListText}
          mode={convertMode}
          resetText={() => setListText(SEED_LIST)}
        />
      ) : (
        <CssView
          text={cssText}
          setText={setCssText}
          mode={convertMode}
          resetText={() => setCssText(SEED_CSS)}
        />
      )}
    </>
  );
}

// ===========================================================================
// LIST VIEW
// ===========================================================================

function ListView({
  text,
  setText,
  mode,
  resetText,
}: {
  text: string;
  setText: (v: string) => void;
  mode: HslConvertMode;
  resetText: () => void;
}) {
  const entries = useMemo(() => convertHslLines(text, mode), [text, mode]);
  const successes = entries.filter(
    (e): e is Extract<HslConvertEntry, { ok: true }> => e.ok,
  );

  // Stats
  const drifts = successes.map((e) => Math.abs(e.value.lDrift));
  const avgDrift = drifts.length > 0 ? drifts.reduce((a, b) => a + b, 0) / drifts.length : 0;
  const maxIdx = drifts.length > 0 ? drifts.indexOf(Math.max(...drifts)) : -1;
  const maxEntry = maxIdx >= 0 ? successes[maxIdx] : null;

  const cssBlock = useMemo(() => {
    const lines = successes.map((e, i) => `  --color-${i + 1}: ${e.value.css};`).join("\n");
    return `:root {\n${lines}\n}`;
  }, [successes]);

  const [copied, setCopied] = useState(false);
  const copyAll = async () => {
    await navigator.clipboard.writeText(cssBlock);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="px-8 lg:px-12 pt-8 pb-16 grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-8">
      {/* Left: input + stats + CTA */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-dim)]">
            Input
          </span>
          <button
            onClick={resetText}
            className="mono text-[11px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
          >
            Reset to example
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={Math.max(8, text.split("\n").length + 1)}
          className="mono w-full text-[12.5px] leading-[1.6] p-3.5 rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-[var(--color-border-strong)] outline-none resize-none"
          placeholder="hsl(220 80% 50%)&#10;hsl(60 100% 50%)"
        />

        {successes.length > 0 && (
          <>
            <StatBlock
              count={successes.length}
              skipped={entries.length - successes.length}
              avgDrift={avgDrift}
              maxEntry={maxEntry}
            />

            <CopyAsCss block={cssBlock} copied={copied} onCopy={copyAll} />
          </>
        )}
      </div>

      {/* Right: drift visualisation + reveal strip + rows */}
      <div className="flex flex-col gap-8 min-w-0">
        {successes.length > 0 && <RevealStrip successes={successes} />}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-dim)]">
              Per colour
            </span>
            <span className="mono text-[10px] text-[var(--color-fg-dim)]">
              ← cooler than HSL claims · warmer than HSL claims →
            </span>
          </div>
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden divide-y divide-[var(--color-border)]">
            {entries.map((entry, i) => (
              <DriftRow
                key={i}
                entry={entry}
                isHero={maxEntry !== null && entry.ok && entry === maxEntry}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  count,
  skipped,
  avgDrift,
  maxEntry,
}: {
  count: number;
  skipped: number;
  avgDrift: number;
  maxEntry: Extract<HslConvertEntry, { ok: true }> | null;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Converted" value={String(count)} />
        <Stat
          label="Avg drift"
          value={`${(avgDrift * 100).toFixed(0)}%`}
          tone={avgDrift > 0.15 ? "warn" : "default"}
        />
      </div>
      {maxEntry && (
        <div className="pt-3 border-t border-[var(--color-border)]">
          <p className="mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-dim)] mb-1.5">
            Worst offender
          </p>
          <div className="flex items-center gap-2.5">
            <span
              className="block w-9 h-9 rounded-md border border-[var(--color-border-strong)] shrink-0"
              style={{ background: oklchToHex(maxEntry.value.oklch) }}
            />
            <div className="min-w-0 flex-1">
              <p className="mono text-[11px] text-[var(--color-fg-muted)] truncate">
                {maxEntry.value.input}
              </p>
              <p className="text-[18px] font-semibold tabular-nums text-[#FFDD00] leading-tight">
                {maxEntry.value.lDrift > 0 ? "+" : ""}
                {(maxEntry.value.lDrift * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      )}
      {skipped > 0 && (
        <p className="mono text-[10.5px] text-[var(--color-fg-dim)]">{skipped} skipped</p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <div>
      <p className="mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-dim)] mb-0.5">
        {label}
      </p>
      <p
        className={`text-[20px] font-semibold tabular-nums ${
          tone === "warn" ? "text-[var(--color-warn)]" : "text-[var(--color-fg)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ===========================================================================
// COPY AS CSS — yellow CTA with preview disclosure
// ===========================================================================

function CopyAsCss({
  block,
  copied,
  onCopy,
}: {
  block: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onCopy}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[var(--radius)] bg-[#FFDD00] text-black text-[13px] font-semibold hover:scale-[1.01] active:scale-[0.99] transition shadow-[0_4px_14px_rgba(255,221,0,0.15)]"
      >
        {copied ? "Copied ✓" : "Copy all as CSS"}
      </button>
      <button
        onClick={() => setShowPreview((v) => !v)}
        className="self-start mono text-[10.5px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
      >
        {showPreview ? "Hide preview ↑" : "Preview what gets copied ↓"}
      </button>
      {showPreview && (
        <pre className="mono text-[11.5px] leading-[1.55] p-3 rounded-[var(--radius)] bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg-muted)] overflow-x-auto whitespace-pre">
          {block}
        </pre>
      )}
    </div>
  );
}

// ===========================================================================
// THE REVEAL — three swatch strips
// ===========================================================================

function RevealStrip({
  successes,
}: {
  successes: Extract<HslConvertEntry, { ok: true }>[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-dim)]">
        The reveal
      </span>
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col gap-3">
        <Strip
          caption="Your colours"
          subcaption="What you actually get on screen"
          rows={successes}
          render={(r) => oklchToHex(r.oklch)}
        />
        <Strip
          caption="What HSL claims they are"
          subcaption="Greyscale at the L value HSL says"
          rows={successes}
          render={(r) => `oklch(${r.hsl.l} 0 0)`}
        />
        <DeltaStrip rows={successes} />
        <Strip
          caption="What they actually look like"
          subcaption="Greyscale at the true perceptual L"
          rows={successes}
          render={(r) => `oklch(${r.literal.l} 0 0)`}
        />
        <p className="mono text-[10.5px] text-[var(--color-fg-dim)] pt-1">
          If HSL were honest, the top and bottom greyscale rows would match. The bars in between
          are the gap.
        </p>
      </div>
    </div>
  );
}

function Strip({
  caption,
  subcaption,
  rows,
  render,
}: {
  caption: string;
  subcaption: string;
  rows: Extract<HslConvertEntry, { ok: true }>[];
  render: (r: HslConvertResult) => string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="mono text-[11px] text-[var(--color-fg)] font-semibold">{caption}</p>
        <p className="mono text-[10px] text-[var(--color-fg-dim)]">{subcaption}</p>
      </div>
      <div
        className="grid h-12 rounded-md overflow-hidden border border-[var(--color-border)]"
        style={{ gridTemplateColumns: `repeat(${rows.length}, 1fr)` }}
      >
        {rows.map((r, i) => (
          <div key={i} style={{ background: render(r.value) }} title={r.value.input} />
        ))}
      </div>
    </div>
  );
}

/** A thin per-swatch delta bar between the two greyscale strips. */
function DeltaStrip({
  rows,
}: {
  rows: Extract<HslConvertEntry, { ok: true }>[];
}) {
  const max = 0.5;
  return (
    <div
      className="grid h-5 rounded-md overflow-hidden bg-[var(--color-surface-2)]/50"
      style={{ gridTemplateColumns: `repeat(${rows.length}, 1fr)` }}
      aria-label="Per-colour lightness delta"
    >
      {rows.map((r, i) => {
        const drift = r.value.lDrift;
        const positive = drift >= 0;
        const pct = Math.min(1, Math.abs(drift) / max) * 50;
        const color = positive ? "oklch(0.78 0.17 75)" : "oklch(0.65 0.18 240)";
        return (
          <div
            key={i}
            className="relative border-r border-[var(--color-bg)] last:border-r-0"
            title={`${r.value.input} · ${drift > 0 ? "+" : ""}${(drift * 100).toFixed(0)}%`}
          >
            <div className="absolute top-0 left-1/2 w-px h-full bg-[var(--color-border-strong)]/60" />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full"
              style={{
                [positive ? "left" : "right"]: "50%",
                width: `${pct}%`,
                background: color,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ===========================================================================
// DRIFT ROW — drift bar is the dominant element
// ===========================================================================

function DriftRow({ entry, isHero }: { entry: HslConvertEntry; isHero: boolean }) {
  const [copied, setCopied] = useState(false);

  if (!entry.ok) {
    return (
      <div className="px-4 py-3 flex items-center gap-3">
        <span className="block w-8 h-8 rounded-md border border-dashed border-[var(--color-border-strong)] shrink-0" />
        <span className="mono text-[12px] text-[var(--color-fg-muted)] truncate">
          {entry.value.input}
        </span>
        <span className="mono text-[11px] text-[var(--color-err)] ml-auto">
          {entry.value.error}
        </span>
      </div>
    );
  }

  const r = entry.value;
  const copy = async () => {
    await navigator.clipboard.writeText(r.css);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const rampUrl = `#/ramp?s=${encodeRamp({
    anchor: r.oklch,
    name: "imported",
    curve: "linear",
  })}`;

  // Plain-English drift label
  const hslPctClaimed = Math.round(r.hsl.l * 100);
  const oklchPctActual = Math.round(r.literal.l * 100);
  const driftPct = (r.lDrift * 100).toFixed(0);

  return (
    <div
      className={`px-4 py-3.5 flex items-center gap-4 transition ${
        isHero
          ? "bg-[oklch(0.20_0.06_85)]/30 hover:bg-[oklch(0.20_0.06_85)]/40"
          : "hover:bg-[var(--color-surface-2)]/40"
      }`}
    >
      <span
        className={`block rounded-md border border-[var(--color-border-strong)] shrink-0 ${
          isHero ? "w-12 h-12" : "w-9 h-9"
        }`}
        style={{ background: oklchToHex(r.oklch) }}
      />

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="mono text-[12px] text-[var(--color-fg-muted)] truncate">
            {r.input}
          </span>
          {isHero && (
            <span className="mono text-[10px] uppercase tracking-[0.12em] text-[#FFDD00] shrink-0">
              ★ worst offender
            </span>
          )}
        </div>

        {/* Big drift bar */}
        <BigDriftBar drift={r.lDrift} />

        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p
            className={`text-[12px] ${
              isHero ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)]"
            }`}
          >
            HSL said L={hslPctClaimed}%. It's really L={oklchPctActual}%.{" "}
            <span className={isHero ? "text-[#FFDD00] font-semibold" : "text-[var(--color-fg-muted)]"}>
              ({r.lDrift > 0 ? "+" : ""}
              {driftPct}% off)
            </span>
          </p>
          <span className="mono text-[11px] text-[var(--color-fg-dim)]">{r.css}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <GamutBadge result={r} />
        <div className="flex items-center gap-1">
          <a
            href={rampUrl}
            className="mono text-[10.5px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] whitespace-nowrap"
            title="Open in Ramp Generator with this colour as anchor"
          >
            Use as ramp →
          </a>
          <button
            onClick={copy}
            className="p-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition"
            aria-label="Copy OKLCH"
            title={copied ? "Copied" : "Copy OKLCH"}
          >
            <CopyIcon copied={copied} />
          </button>
        </div>
      </div>
    </div>
  );
}

function BigDriftBar({ drift }: { drift: number }) {
  const max = 0.5;
  const pct = Math.min(1, Math.abs(drift) / max) * 50;
  const positive = drift >= 0;
  const driftColor = positive ? "oklch(0.78 0.17 75)" : "oklch(0.65 0.18 240)";

  return (
    <div className="relative h-3 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden">
      {/* centre tick */}
      <div className="absolute top-0 left-1/2 w-px h-full bg-[var(--color-border-strong)]/70 z-10" />
      {/* fill */}
      <div
        className="absolute top-0 h-full"
        style={{
          [positive ? "left" : "right"]: "50%",
          width: `${pct}%`,
          background: driftColor,
        }}
      />
    </div>
  );
}

function GamutBadge({ result }: { result: HslConvertResult }) {
  if (result.chromaClipped) {
    const { from, to } = result.chromaClipped;
    return (
      <span title={`Chroma reduced ${from.toFixed(3)} → ${to.toFixed(3)} to fit sRGB`}>
        <Pill tone="warn">
          C {from.toFixed(2)} → {to.toFixed(2)}
        </Pill>
      </span>
    );
  }
  if (result.inSrgb) return <Pill tone="ok">sRGB</Pill>;
  if (result.inP3) return <Pill tone="warn">P3 only</Pill>;
  return <Pill tone="err">out of gamut</Pill>;
}

function CopyIcon({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path
          d="M3 8.5l3 3 7-7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect
        x="4.5"
        y="4.5"
        width="8"
        height="9"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M2.5 11.5V3.2A1.2 1.2 0 0 1 3.7 2h6.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ===========================================================================
// CSS VIEW — diff
// ===========================================================================

function CssView({
  text,
  setText,
  mode,
  resetText,
}: {
  text: string;
  setText: (v: string) => void;
  mode: HslConvertMode;
  resetText: () => void;
}) {
  const result = useMemo(() => replaceHslInCss(text, mode), [text, mode]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(result.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const drifts = result.matches.map((m) => Math.abs(m.result.lDrift));
  const avgDrift = drifts.length > 0 ? drifts.reduce((a, b) => a + b, 0) / drifts.length : 0;
  const maxDrift = drifts.length > 0 ? Math.max(...drifts) : 0;

  return (
    <div className="px-8 lg:px-12 pt-8 pb-16 grid lg:grid-cols-2 gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-dim)]">
            Input · CSS
          </span>
          <button
            onClick={resetText}
            className="mono text-[11px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
          >
            Reset to example
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={14}
          className="mono w-full text-[13px] leading-[1.6] p-4 rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-[var(--color-border-strong)] outline-none resize-y"
          placeholder=":root { --brand: hsl(220 80% 50%); }"
        />
      </div>

      <div className="flex flex-col gap-3">
        <span className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-dim)]">
          Output · diff
        </span>
        {result.matches.length === 0 && result.errors.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-6 text-[13px] text-[var(--color-fg-dim)]">
            No <span className="mono">hsl(…)</span> values found.
          </div>
        ) : (
          <>
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <DiffView original={text} matches={result.matches} />
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <Stat label="Replaced" value={String(result.matches.length)} />
              <Stat label="Avg drift" value={`${(avgDrift * 100).toFixed(0)}%`} />
              <Stat
                label="Max drift"
                value={`${(maxDrift * 100).toFixed(0)}%`}
                tone={maxDrift > 0.3 ? "warn" : "default"}
              />
            </div>
            <button
              onClick={copy}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[var(--radius)] bg-[#FFDD00] text-black text-[13px] font-semibold hover:scale-[1.01] active:scale-[0.99] transition shadow-[0_4px_14px_rgba(255,221,0,0.15)]"
            >
              {copied ? "Copied ✓" : "Copy result"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function DiffView({
  original,
  matches,
}: {
  original: string;
  matches: CssReplaceMatch[];
}) {
  const segments: { type: "text" | "match"; text: string; match?: CssReplaceMatch }[] = [];
  let cursor = 0;
  const sorted = [...matches].sort((a, b) => a.index - b.index);
  for (const m of sorted) {
    if (m.index > cursor) {
      segments.push({ type: "text", text: original.slice(cursor, m.index) });
    }
    segments.push({ type: "match", text: m.from, match: m });
    cursor = m.index + m.from.length;
  }
  if (cursor < original.length) {
    segments.push({ type: "text", text: original.slice(cursor) });
  }

  return (
    <pre className="mono text-[12.5px] leading-[1.7] p-4 overflow-x-auto whitespace-pre-wrap break-words">
      {segments.map((s, i) => {
        if (s.type === "text") {
          return (
            <span key={i} className="text-[var(--color-fg-muted)]">
              {s.text}
            </span>
          );
        }
        const m = s.match!;
        return (
          <span key={i}>
            <span
              className="line-through"
              style={{
                background: "oklch(0.30 0.08 25 / 0.4)",
                color: "oklch(0.85 0.08 25)",
                padding: "0 2px",
                borderRadius: 3,
              }}
              title={`HSL drift: ${m.result.lDrift > 0 ? "+" : ""}${(
                m.result.lDrift * 100
              ).toFixed(0)}%`}
            >
              {m.from}
            </span>
            <span
              style={{
                background: "oklch(0.30 0.06 155 / 0.4)",
                color: "oklch(0.85 0.10 155)",
                padding: "0 2px",
                borderRadius: 3,
                marginLeft: 4,
              }}
            >
              {m.to}
            </span>
          </span>
        );
      })}
    </pre>
  );
}

// ===========================================================================
// Toggle
// ===========================================================================

function Toggle({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-dim)]">
        {label}
      </span>
      <div className="inline-flex rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-[calc(var(--radius-sm)-2px)] text-[12px] mono transition ${
              value === o.value
                ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
