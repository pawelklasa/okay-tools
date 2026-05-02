import { useState } from "react";
import { Link } from "react-router-dom";
import { converter, parse } from "culori";
import { buildRamp, formatRamp, oklchToHex, type OKLCH } from "../lib/oklch";

const toOklch = converter("oklch");

// ---------------------------------------------------------------------------
// Hero demo — interactive Reveal
// ---------------------------------------------------------------------------

const HERO_HUES = [
  { name: "yellow", hue: 60 },
  { name: "green", hue: 130 },
  { name: "red", hue: 0 },
  { name: "magenta", hue: 300 },
  { name: "blue", hue: 240 },
];

function actualLForHsl(hue: number, hslL: number) {
  const css = `hsl(${hue} 100% ${hslL * 100}%)`;
  const o = toOklch(parse(css)!)!;
  return o.l ?? 0;
}

export function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Hero />
      <ToolGrid />
      <Footer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero() {
  const [hslL, setHslL] = useState(0.5);

  return (
    <section className="px-8 lg:px-16 pt-16 pb-14">
      <p className="mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-6">
        OKLCH-native · no HSL approximations
      </p>

      {/* The demo */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 lg:p-7 max-w-4xl">
        <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
          <p className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)]">
            Live demo
          </p>
          <p className="mono text-[10.5px] text-[var(--color-fg-muted)]">
            HSL lightness: <span className="text-[var(--color-fg)] tabular-nums">{Math.round(hslL * 100)}%</span>
          </p>
        </div>

        {/* Strip 1: actual rendered colours at HSL L */}
        <StripLabel caption="Your colours at HSL L" sub="What you see on screen" />
        <div
          className="grid h-14 rounded-md overflow-hidden border border-[var(--color-border)] mb-4"
          style={{ gridTemplateColumns: `repeat(${HERO_HUES.length}, 1fr)` }}
        >
          {HERO_HUES.map((h) => (
            <div
              key={h.hue}
              style={{ background: `hsl(${h.hue} 100% ${hslL * 100}%)` }}
              title={`hsl(${h.hue} 100% ${Math.round(hslL * 100)}%)`}
            />
          ))}
        </div>

        {/* Strip 2: greyscale at HSL's claimed L (all identical) */}
        <StripLabel caption="What HSL thinks they are" sub={`All grey, all L=${Math.round(hslL * 100)}%`} />
        <div
          className="grid h-9 rounded-md overflow-hidden border border-[var(--color-border)] mb-3"
          style={{ gridTemplateColumns: `repeat(${HERO_HUES.length}, 1fr)` }}
        >
          {HERO_HUES.map((h) => (
            <div key={h.hue} style={{ background: `oklch(${hslL} 0 0)` }} />
          ))}
        </div>

        {/* Strip 3: greyscale at actual perceptual L */}
        <StripLabel caption="What they actually are" sub="True perceptual brightness" />
        <div
          className="grid h-9 rounded-md overflow-hidden border border-[var(--color-border)] mb-2"
          style={{ gridTemplateColumns: `repeat(${HERO_HUES.length}, 1fr)` }}
        >
          {HERO_HUES.map((h) => {
            const actual = actualLForHsl(h.hue, hslL);
            return (
              <div
                key={h.hue}
                style={{ background: `oklch(${actual} 0 0)` }}
                title={`Actually L=${Math.round(actual * 100)}%`}
              />
            );
          })}
        </div>

        {/* Slider */}
        <div className="mt-4 flex items-center gap-4">
          <input
            type="range"
            min={0.05}
            max={0.95}
            step={0.01}
            value={hslL}
            onChange={(e) => setHslL(parseFloat(e.target.value))}
            className="flex-1"
            aria-label="HSL lightness"
          />
          <button
            onClick={() => setHslL(0.5)}
            className="mono text-[10.5px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
          >
            Reset to 50%
          </button>
        </div>

        <p className="mt-3 text-[13px] text-[var(--color-fg-muted)]">
          These are all the same lightness in HSL. Obviously, they aren't.
        </p>
      </div>

      {/* Headline below the demo */}
      <h1 className="mt-12 text-[40px] md:text-[56px] lg:text-[64px] font-semibold tracking-[-0.035em] leading-[1.04] text-[var(--color-fg)] max-w-4xl">
        OKLCH tools that{" "}
        <span className="text-[var(--color-fg-dim)]">show you the difference.</span>
      </h1>
      <p className="mt-6 text-[16px] leading-relaxed text-[var(--color-fg-muted)] max-w-xl">
        Every popular colour-picker site treats OKLCH as the answer. The interesting part is what
        it reveals about the colours you've been shipping. That's what this is. Companion to{" "}
        <a
          href="https://medium.com/design-bootcamp/color-is-finally-ok-82f368f3408c"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-fg)] underline decoration-[var(--color-border-strong)] underline-offset-[5px] hover:decoration-[var(--color-fg)]"
        >
          the article
        </a>
        .
      </p>
      <div className="mt-7 flex items-center gap-3">
        <Link
          to="/hsl-to-oklch"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#FFDD00] text-black text-sm font-semibold hover:scale-[1.02] active:scale-[0.99] transition shadow-[0_4px_14px_rgba(255,221,0,0.15)]"
        >
          Migrate your HSL palette
          <span aria-hidden>→</span>
        </Link>
        <Link
          to="/hsl-lies"
          className="inline-flex items-center gap-2 px-4 py-3 rounded-full text-[var(--color-fg-muted)] text-sm font-medium hover:text-[var(--color-fg)] transition"
        >
          Or play with the lie →
        </Link>
      </div>
    </section>
  );
}

function StripLabel({ caption, sub }: { caption: string; sub: string }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <p className="mono text-[11px] text-[var(--color-fg)] font-semibold">{caption}</p>
      <p className="mono text-[10px] text-[var(--color-fg-dim)]">{sub}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool grid — reordered, self-demonstrating
// ---------------------------------------------------------------------------

function ToolGrid() {
  return (
    <section className="px-8 lg:px-16 py-16">
      <h2 className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-dim)] mb-6">
        Tools
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HslLiesCard />
        <MigratorCard />
        <RampCard />
        <ThemeBuilderCard />
        <ContrastCard />
        <GradientCard />
      </div>
    </section>
  );
}

function CardShell({
  to,
  title,
  blurb,
  preview,
  className = "",
}: {
  to: string;
  title: string;
  blurb: string;
  preview: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`group rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-border-strong)] transition flex flex-col ${className}`}
    >
      <div className="aspect-[16/9] bg-[var(--color-bg)] border-b border-[var(--color-border)] overflow-hidden flex flex-col justify-center">
        {preview}
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-[15px] font-semibold text-[var(--color-fg)]">{title}</h3>
          <span className="text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)] transition">
            →
          </span>
        </div>
        <p className="text-[13px] leading-relaxed text-[var(--color-fg-muted)]">{blurb}</p>
      </div>
    </Link>
  );
}

// HSL Lies — twin sliders mini-demo
function HslLiesCard() {
  return (
    <CardShell
      to="/hsl-lies"
      title="HSL Lies"
      blurb="Twin sliders. One drifts the hue. The other holds it."
      preview={
        <div className="px-4 py-5 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mono text-[9px] uppercase tracking-wider text-[var(--color-fg-dim)] mb-1">HSL</p>
              <div className="grid grid-cols-7 h-7 rounded overflow-hidden">
                {[0, 30, 60, 120, 200, 270, 330].map((h) => (
                  <div key={h} style={{ background: `hsl(${h} 80% 50%)` }} />
                ))}
              </div>
            </div>
            <div>
              <p className="mono text-[9px] uppercase tracking-wider text-[var(--color-fg-dim)] mb-1">OKLCH</p>
              <div className="grid grid-cols-7 h-7 rounded overflow-hidden">
                {[0, 30, 60, 120, 200, 270, 330].map((h) => (
                  <div key={h} style={{ background: `oklch(0.66 0.18 ${h})` }} />
                ))}
              </div>
            </div>
          </div>
          <p className="mono text-[9.5px] text-[var(--color-fg-dim)] mt-1">
            Same hues, both spaces. One row balanced, one not.
          </p>
        </div>
      }
    />
  );
}

// Migrator — drift bars
function MigratorCard() {
  const samples = [
    { label: "hsl(60 100% 50%)", drift: 0.47 },
    { label: "hsl(120 100% 50%)", drift: 0.37 },
    { label: "hsl(0 100% 50%)", drift: 0.04 },
    { label: "hsl(240 100% 50%)", drift: -0.21 },
  ];
  return (
    <CardShell
      to="/hsl-to-oklch"
      title="HSL → OKLCH"
      blurb="Paste HSL. Get OKLCH. See exactly which colours HSL was lying about."
      preview={
        <div className="px-4 py-4 flex flex-col gap-2">
          {samples.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5">
              <span className="mono text-[10px] text-[var(--color-fg-muted)] w-[120px] truncate">
                {s.label}
              </span>
              <div className="relative h-2 flex-1 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                <div className="absolute top-0 left-1/2 w-px h-full bg-[var(--color-border-strong)]/60" />
                <div
                  className="absolute top-0 h-full"
                  style={{
                    [s.drift >= 0 ? "left" : "right"]: "50%",
                    width: `${Math.min(1, Math.abs(s.drift) / 0.5) * 50}%`,
                    background: s.drift >= 0 ? "oklch(0.78 0.17 75)" : "oklch(0.65 0.18 240)",
                  }}
                />
              </div>
              <span
                className={`mono text-[10px] tabular-nums w-9 text-right ${
                  Math.abs(s.drift) > 0.3 ? "text-[#FFDD00] font-semibold" : "text-[var(--color-fg-dim)]"
                }`}
              >
                {s.drift > 0 ? "+" : ""}
                {Math.round(s.drift * 100)}%
              </span>
            </div>
          ))}
        </div>
      }
    />
  );
}

function RampCard() {
  const accent: OKLCH = { l: 0.66, c: 0.2, h: 25 };
  const ramp = buildRamp({ anchor: accent, taperChroma: true });
  const rows = formatRamp(ramp);
  return (
    <CardShell
      to="/ramp"
      title="Ramp Generator"
      blurb="One anchor in. Eleven balanced steps out. Export to your stack."
      preview={
        <div className="grid grid-cols-11 h-full">
          {rows.map((r) => (
            <div key={r.stop} style={{ background: r.css }} />
          ))}
        </div>
      }
    />
  );
}

function ThemeBuilderCard() {
  const accent: OKLCH = { l: 0.66, c: 0.2, h: 290 };
  const lightStops = [0.985, 0.95, 0.88, 0.78, 0.66, 0.55, 0.4, 0.25];
  return (
    <CardShell
      to="/dark-mode"
      title="Light + Dark Theme"
      blurb="One brand colour. Both modes. Semantic tokens you can paste."
      preview={
        <div className="grid grid-cols-2 h-full">
          <div className="flex" style={{ background: "#FAFAFA" }}>
            {lightStops.map((l, i) => (
              <div
                key={i}
                className="flex-1"
                style={{ background: oklchToHex({ l, c: accent.c * 0.9, h: accent.h }) }}
              />
            ))}
          </div>
          <div className="flex" style={{ background: "#0A0A0A" }}>
            {[...lightStops].reverse().map((l, i) => (
              <div
                key={i}
                className="flex-1"
                style={{ background: oklchToHex({ l, c: accent.c * 0.9, h: accent.h }) }}
              />
            ))}
          </div>
        </div>
      }
    />
  );
}

function ContrastCard() {
  const fg = "oklch(0.95 0.02 230)";
  const bg = "oklch(0.30 0.06 230)";
  return (
    <CardShell
      to="/contrast"
      title="Contrast Finder"
      blurb="Every WCAG + APCA passing pair from your ramp, ranked by ΔL."
      preview={
        <div className="grid grid-cols-2 h-full">
          <div
            className="flex flex-col items-center justify-center font-semibold text-[28px]"
            style={{ background: bg, color: fg }}
          >
            Aa
            <span className="mono text-[9px] mt-1 opacity-70">7.4 : 1</span>
          </div>
          <div
            className="flex flex-col items-center justify-center font-semibold text-[28px]"
            style={{ background: fg, color: bg }}
          >
            Aa
            <span className="mono text-[9px] mt-1 opacity-70">7.4 : 1</span>
          </div>
        </div>
      }
    />
  );
}

function GradientCard() {
  // Show two gradient bands — sRGB collapses through grey, OKLCH stays vivid
  return (
    <CardShell
      to="/gradient"
      title="Gradient Lab"
      blurb="The same blend across five colour spaces. Watch sRGB collapse."
      preview={
        <div className="px-4 py-4 flex flex-col gap-3 justify-center h-full">
          <div>
            <p className="mono text-[9px] uppercase tracking-wider text-[var(--color-fg-dim)] mb-1">sRGB</p>
            <div
              className="h-6 rounded"
              style={{
                background:
                  "linear-gradient(90deg, oklch(0.65 0.22 30), oklch(0.65 0.22 240))",
              }}
            />
          </div>
          <div>
            <p className="mono text-[9px] uppercase tracking-wider text-[var(--color-fg-dim)] mb-1">OKLCH</p>
            <div
              className="h-6 rounded"
              style={{
                background:
                  "linear-gradient(in oklch 90deg, oklch(0.65 0.22 30), oklch(0.65 0.22 240))",
              }}
            />
          </div>
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer() {
  return (
    <footer className="mt-auto px-8 lg:px-16 py-8 flex flex-wrap gap-x-6 gap-y-3 items-center justify-between text-xs text-[var(--color-fg-dim)] border-t border-[var(--color-border)]">
      <p>
        Built by{" "}
        <a
          href="https://pavka.design/"
          className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          Pawel Klasa
        </a>
        .
      </p>
      <div className="flex gap-5">
        <a
          href="https://medium.com/design-bootcamp/color-is-finally-ok-82f368f3408c"
          target="_blank"
          rel="noreferrer"
          className="hover:text-[var(--color-fg)]"
        >
          Article
        </a>
        <a
          href="https://github.com/pawelklasa/okay-tools"
          target="_blank"
          rel="noreferrer"
          className="hover:text-[var(--color-fg)]"
        >
          GitHub
        </a>
        <a
          href="https://buy.stripe.com/5kQ6oJ6Qebt63GN9G71wY00"
          target="_blank"
          rel="noreferrer"
          className="hover:text-[var(--color-fg)]"
        >
          Tip
        </a>
      </div>
      <p className="mono">v0.1 · MIT</p>
    </footer>
  );
}
