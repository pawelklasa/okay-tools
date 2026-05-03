import { Link } from "react-router-dom";
import { EmailCapture } from "../components/EmailCapture";

export function BrandHome() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="px-8 lg:px-16 pt-7 flex items-center gap-2.5">
        <span
          className="w-7 h-7 rounded-md"
          style={{
            background:
              "conic-gradient(from 0deg, oklch(0.72 0.18 30), oklch(0.72 0.18 110), oklch(0.72 0.18 200), oklch(0.72 0.18 290), oklch(0.72 0.18 30))",
          }}
        />
        <span className="font-semibold tracking-tight text-[15px]">
          okay<span className="text-[var(--color-fg-dim)]">.tools</span>
        </span>
      </header>

      {/* Hero */}
      <section className="px-8 lg:px-16 pt-20 lg:pt-28 pb-12 max-w-5xl">
        <p className="mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-6">
          A small studio of tools that make the invisible obvious
        </p>
        <h1 className="text-[44px] md:text-[64px] lg:text-[76px] font-semibold tracking-[-0.035em] leading-[1.02] text-[var(--color-fg)]">
          <span className="text-[var(--color-fg-dim)]">Pick your</span>{" "}
          poison.
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-[var(--color-fg-muted)] max-w-xl">
          Two apps. Both reveal something your design system pretends isn't broken.
        </p>
      </section>

      {/* Apps */}
      <section className="px-8 lg:px-16 pb-20 grid md:grid-cols-2 gap-5">
        <ColorAppCard />
        <FormsAppCard />
      </section>

      {/* Email capture — full-bleed band so it can't be missed */}
      <section className="px-8 lg:px-16 pb-20">
        <div
          className="rounded-[var(--radius-lg)] border border-[#FFDD00]/40 p-8 lg:p-12 grid md:grid-cols-[1fr_auto] gap-8 items-center"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.22 0.10 95 / 0.18), oklch(0.18 0.05 95 / 0.10))",
          }}
        >
          <div className="max-w-xl">
            <p className="mono text-[10px] uppercase tracking-[0.18em] text-[#FFDD00] mb-3">
              Get the next one
            </p>
            <h2 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.02em] leading-[1.1] text-[var(--color-fg)] mb-3">
              I'll email you when the next tool ships.
            </h2>
            <p className="text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
              Two emails a year. Maybe three. No newsletter, no marketing.
            </p>
          </div>
          <div className="md:min-w-[360px]">
            <EmailCapture source="landing" prompt="" hideHeading />
          </div>
        </div>
      </section>

      {/* Footer */}
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
        <p className="mono">v0.2 · MIT</p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ColorAppCard() {
  const hues = [30, 60, 130, 200, 290];
  return (
    <Link
      to="/color"
      className="group rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-border-strong)] transition flex flex-col"
    >
      {/* Preview: HSL row vs OKLCH row, classic reveal */}
      <div className="aspect-[16/10] bg-[var(--color-bg)] border-b border-[var(--color-border)] p-5 flex flex-col justify-center gap-3">
        <div>
          <p className="mono text-[9.5px] uppercase tracking-wider text-[var(--color-fg-dim)] mb-1.5">
            HSL — same lightness, very much not
          </p>
          <div className="grid h-8 rounded overflow-hidden" style={{ gridTemplateColumns: `repeat(${hues.length}, 1fr)` }}>
            {hues.map((h) => (
              <div key={h} style={{ background: `hsl(${h} 100% 50%)` }} />
            ))}
          </div>
        </div>
        <div>
          <p className="mono text-[9.5px] uppercase tracking-wider text-[var(--color-fg-dim)] mb-1.5">
            OKLCH — actually balanced
          </p>
          <div className="grid h-8 rounded overflow-hidden" style={{ gridTemplateColumns: `repeat(${hues.length}, 1fr)` }}>
            {hues.map((h) => (
              <div key={h} style={{ background: `oklch(0.68 0.17 ${h})` }} />
            ))}
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-[22px] font-semibold tracking-tight text-[var(--color-fg)]">
            Color is finally OK
          </h2>
          <span className="text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)] transition text-lg">
            →
          </span>
        </div>
        <p className="text-[14px] leading-relaxed text-[var(--color-fg-muted)] mb-4">
          Migrate HSL to OKLCH, generate balanced palettes, and see exactly which colours your old
          system was lying about.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["HSL → OKLCH", "Palette", "Ramp", "Contrast", "Gradient"].map((t) => (
            <span
              key={t}
              className="mono text-[10px] px-2 py-1 rounded bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function FormsAppCard() {
  return (
    <Link
      to="/forms"
      className="group relative rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden hover:border-[#FFDD00]/60 transition flex flex-col shadow-[0_0_0_0_rgba(255,221,0,0)] hover:shadow-[0_0_40px_-12px_rgba(255,221,0,0.35)]"
    >
      {/* Preview: tiny mock form with eager error vs calm field */}
      <div className="aspect-[16/10] bg-[var(--color-bg)] border-b border-[var(--color-border)] p-5 flex flex-col justify-center gap-3">
        <div className="flex flex-col gap-1.5">
          <p className="mono text-[9.5px] uppercase tracking-wider text-[var(--color-fg-dim)]">
            Eager — punishes typing
          </p>
          <div className="rounded border border-[oklch(0.65_0.18_75)] bg-[var(--color-surface)] px-3 py-2 flex items-center justify-between shadow-[0_0_0_3px_oklch(0.65_0.18_75/0.18)]">
            <span className="mono text-[11px] text-[var(--color-fg)]">paw</span>
            <span className="mono text-[10px] font-semibold text-[#FFDD00]">
              ⚠ not a valid email
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="mono text-[9.5px] uppercase tracking-wider text-[var(--color-fg-dim)]">
            Smart — waits its turn
          </p>
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 flex items-center justify-between">
            <span className="mono text-[11px] text-[var(--color-fg)]">paw</span>
            <span className="mono text-[10px] text-[oklch(0.78_0.16_155)]">✓ still typing…</span>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-[22px] font-semibold tracking-tight text-[var(--color-fg)]">
            form-hostility
          </h2>
          <span className="text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)] transition text-lg">
            →
          </span>
        </div>
        <p className="text-[14px] leading-relaxed text-[var(--color-fg-muted)] mb-4">
          A validation timing playground. Toggle strategies and watch the same form go from helpful
          to outright hostile.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["Eager", "Lazy", "On-blur", "Smart"].map((t) => (
            <span
              key={t}
              className="mono text-[10px] px-2 py-1 rounded bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
