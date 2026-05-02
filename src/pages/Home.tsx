import { Link } from "react-router-dom";
import { buildRamp, formatRamp, type OKLCH } from "../lib/oklch";

const tools = [
  {
    to: "/ramp",
    title: "Ramp Generator",
    blurb: "One anchor in. Eleven balanced steps out. Export to your stack.",
    accent: { l: 0.66, c: 0.2, h: 25 } as OKLCH,
  },
  {
    to: "/gradient",
    title: "Gradient Lab",
    blurb: "The same blend across five colour spaces. Watch sRGB collapse.",
    accent: { l: 0.7, c: 0.18, h: 95 } as OKLCH,
  },
  {
    to: "/hsl-lies",
    title: "HSL Lies",
    blurb: "Twin sliders. One drifts the hue. The other holds it.",
    accent: { l: 0.66, c: 0.18, h: 165 } as OKLCH,
  },
  {
    to: "/contrast",
    title: "Contrast Finder",
    blurb: "Every WCAG + APCA passing pair from your ramp, ranked by ΔL.",
    accent: { l: 0.66, c: 0.2, h: 230 } as OKLCH,
  },
  {
    to: "/dark-mode",
    title: "Light + Dark Theme Builder",
    blurb: "One brand colour. Both modes. Semantic tokens you can paste into CSS, Tailwind or SCSS.",
    accent: { l: 0.66, c: 0.2, h: 290 } as OKLCH,
  },
];

export function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="px-8 lg:px-16 pt-24 pb-16">
        <p className="mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-6">
          Free · open source · runs in your browser
        </p>
        <h1 className="text-[44px] md:text-6xl lg:text-7xl font-semibold tracking-[-0.035em] leading-[1.02] text-[var(--color-fg)] max-w-4xl">
          Colour is finally OK.
          <br />
          <span className="text-[var(--color-fg-dim)]">Here are the tools.</span>
        </h1>
        <p className="mt-7 text-[17px] leading-relaxed text-[var(--color-fg-muted)] max-w-xl">
          A small suite of OKLCH-native utilities — companion to{" "}
          <a
            href="https://medium.com/design-bootcamp/color-is-finally-ok-82f368f3408c"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-fg)] underline decoration-[var(--color-border-strong)] underline-offset-[5px] hover:decoration-[var(--color-fg)]"
          >
            the article
          </a>
          . Generate ramps, see how colour spaces really behave, find contrast
          pairs that work.
        </p>
        <div className="mt-9">
          <Link
            to="/ramp"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--color-fg)] text-[var(--color-bg)] text-sm font-semibold hover:opacity-90 transition"
          >
            Start with the Ramp Generator
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* Spectrum strip — quiet hero asset */}
      <Spectrum />

      {/* Tools */}
      <section className="px-8 lg:px-16 py-20">
        <h2 className="text-sm font-medium tracking-tight text-[var(--color-fg-dim)] uppercase mb-6 mono text-[11px]">
          Tools
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((t) => (
            <ToolCard key={t.to} {...t} />
          ))}
        </div>
      </section>

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
            href="https://buy.stripe.com/fZueVdgDiaqo9xyaIZ3gk00"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--color-fg)]"
          >
            Tip
          </a>
        </div>
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
      className="group rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-border-strong)] transition"
    >
      <div className="grid grid-cols-11 h-2.5">
        {rows.map((r) => (
          <div key={r.stop} style={{ background: r.css }} />
        ))}
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

function Spectrum() {
  const swatches = Array.from({ length: 24 }, (_, i) => {
    const h = (i / 24) * 360;
    return `oklch(0.72 0.17 ${h})`;
  });
  return (
    <div className="mx-8 lg:mx-16 mb-4 grid grid-cols-24 h-2 rounded-full overflow-hidden" style={{ gridTemplateColumns: `repeat(${swatches.length}, 1fr)` }}>
      {swatches.map((c, i) => (
        <div key={i} style={{ background: c }} />
      ))}
    </div>
  );
}
