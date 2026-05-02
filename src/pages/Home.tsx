import { Link } from "react-router-dom";
import { buildRamp, formatRamp, type OKLCH } from "../lib/oklch";

const tools = [
  {
    to: "/ramp",
    title: "Ramp Generator",
    blurb: "Anchor in. 11 steps out. Even on the L axis. Tailwind / shadcn / DTCG / SCSS / CSS / hex exports.",
    accent: { l: 0.65, c: 0.2, h: 25 } as OKLCH,
  },
  {
    to: "/gradient",
    title: "Gradient Lab",
    blurb: "Watch the dead-grey middle die in sRGB and HSL. Stay alive in OKLCH. Side by side.",
    accent: { l: 0.7, c: 0.2, h: 95 } as OKLCH,
  },
  {
    to: "/hsl-lies",
    title: "HSL Lies, OKLCH Doesn't",
    blurb: "Twin sliders. Same hue. Same lightness target. One drifts, one holds. The five-second proof.",
    accent: { l: 0.65, c: 0.18, h: 165 } as OKLCH,
  },
  {
    to: "/contrast",
    title: "Contrast Pair Finder",
    blurb: "Every WCAG + APCA passing pair from your ramp, ranked by ΔL. The OKLCH-native shortcut.",
    accent: { l: 0.65, c: 0.2, h: 230 } as OKLCH,
  },
  {
    to: "/dark-mode",
    title: "Dark Mode Inverter",
    blurb: "Take a light ramp. Flip the L axis. Watch dark mode behave the way the article describes.",
    accent: { l: 0.65, c: 0.2, h: 290 } as OKLCH,
  },
];

export function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="relative px-8 lg:px-12 pt-20 pb-24 border-b border-[var(--color-border)] overflow-hidden">
        <HeroSwatches />
        <div className="relative max-w-4xl">
          <p className="mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent-400)] mb-5">
            Free · open source · no signup
          </p>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-[-0.03em] leading-[0.95] text-[var(--color-fg)]">
            Colour is finally OK.
            <br />
            <span className="text-[var(--color-fg-dim)]">Here are the tools.</span>
          </h1>
          <p className="mt-8 text-lg leading-relaxed text-[var(--color-fg-muted)] max-w-2xl">
            A small suite of OKLCH-native utilities for designers and developers
            who finished{" "}
            <a
              href="https://medium.com/design-bootcamp/color-is-finally-ok-82f368f3408c"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-fg)] underline decoration-[var(--color-border-strong)] underline-offset-4 hover:decoration-[var(--color-fg)]"
            >
              the article
            </a>{" "}
            and want to actually try it. Everything runs in your browser. Exports
            clean tokens. Free forever.
          </p>
          <div className="mt-10 flex items-center gap-3 flex-wrap">
            <Link
              to="/ramp"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--radius-sm)] bg-[var(--color-fg)] text-[var(--color-bg)] text-sm font-medium hover:opacity-90 transition"
            >
              Start with the Ramp Generator
              <span aria-hidden>→</span>
            </Link>
            <Link
              to="/gradient"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--radius-sm)] text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              See the dead-grey demo
            </Link>
          </div>
        </div>
      </section>

      {/* Tools grid */}
      <section className="px-8 lg:px-12 py-16">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="text-2xl font-semibold tracking-tight">Tools</h2>
          <p className="mono text-xs text-[var(--color-fg-dim)]">{tools.length} live · more shipping</p>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {tools.map((t) => (
            <ToolCard key={t.to} {...t} />
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="px-8 lg:px-12 pb-20">
        <h2 className="text-2xl font-semibold tracking-tight mb-6">Coming next</h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2.5 text-sm text-[var(--color-fg-muted)]">
          {[
            "HSL → OKLCH migrator",
            "Multi-scale palette builder",
            "Colourblind simulator",
            "Data-viz scale builder",
            "Gamut visualiser (3D)",
            "Albers interactive demo",
            "Figma plugin & Variables JSON",
            "Embeddable picker component",
          ].map((x) => (
            <li key={x} className="flex items-center gap-2">
              <span className="text-[var(--color-fg-dim)]">·</span>
              {x}
            </li>
          ))}
        </ul>
      </section>

      <footer className="px-8 lg:px-12 py-8 border-t border-[var(--color-border)] flex flex-wrap gap-4 justify-between text-xs text-[var(--color-fg-dim)]">
        <p>
          Built by{" "}
          <a href="https://pavka.design/" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
            Pawel Klasa
          </a>
          . Math by culori. OKLCH by Björn Ottosson.
        </p>
        <p className="mono">v0.1 · MIT</p>
      </footer>
    </div>
  );
}

function ToolCard({
  to,
  title,
  blurb,
  accent,
}: {
  to: string;
  title: string;
  blurb: string;
  accent: OKLCH;
}) {
  const ramp = buildRamp({ anchor: accent, taperChroma: true });
  const rows = formatRamp(ramp);

  return (
    <Link
      to={to}
      className="group relative rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-border-strong)] transition"
    >
      <div className="grid grid-cols-11">
        {rows.map((r) => (
          <div key={r.stop} className="h-3" style={{ background: r.css }} />
        ))}
      </div>
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h3 className="text-lg font-semibold text-[var(--color-fg)] group-hover:text-[var(--color-accent-300)] transition-colors">
            {title}
          </h3>
          <span className="text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)] transition-colors">→</span>
        </div>
        <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">{blurb}</p>
      </div>
    </Link>
  );
}

function HeroSwatches() {
  // Decorative band of OKLCH colors at constant L=0.7, varying H
  const swatches = Array.from({ length: 36 }, (_, i) => {
    const h = (i / 36) * 360;
    return `oklch(0.72 0.18 ${h})`;
  });
  return (
    <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
      <div className="grid grid-cols-12 gap-px h-full">
        {swatches.slice(0, 36).map((c, i) => (
          <div key={i} className="h-full" style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}
