import { Link } from "react-router-dom";

const tools = [
  {
    to: "/ramp",
    title: "Ramp Generator",
    blurb:
      "Pick one anchor colour. Get an 11-step ramp (50–950) with even perceived steps. Export to Tailwind, shadcn, JSON, SCSS or plain CSS.",
  },
  {
    to: "/gradient",
    title: "Gradient Lab",
    blurb:
      "See the dead-grey middle for yourself. Compare gradients in OKLCH, Oklab, HSL, sRGB and Lab side by side.",
  },
  {
    to: "/hsl-lies",
    title: "HSL Lies, OKLCH Doesn’t",
    blurb:
      "Twin sliders. Drag lightness on both. Watch HSL drift the hue while OKLCH holds.",
  },
  {
    to: "/contrast",
    title: "Contrast Pair Finder",
    blurb:
      "Paste a palette. Get every pair that hits WCAG AA / AAA and APCA, ranked by ΔL.",
  },
  {
    to: "/dark-mode",
    title: "Dark Mode Inverter",
    blurb:
      "Take a light ramp, flip the L axis, and watch dark mode behave. The way the article describes it.",
  },
];

export function Home() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <section className="mb-16">
        <p className="text-brand-600 font-medium mb-3">Free tools, built in OKLCH</p>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-ink-950 max-w-3xl leading-[1.05]">
          Colour is finally OK. <span className="text-ink-500">Here are the tools.</span>
        </h1>
        <p className="mt-6 text-lg text-ink-700 max-w-2xl">
          A small suite of utilities for designers and developers who have read{" "}
          <a
            href="https://medium.com/design-bootcamp/color-is-finally-ok-82f368f3408c"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-ink-300 hover:decoration-ink-900"
          >
            the article
          </a>{" "}
          and want to actually try it. Everything runs in your browser, exports clean
          tokens, and is free forever.
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        {tools.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group block p-6 rounded-xl bg-white border border-ink-200 hover:border-ink-400 hover:shadow-sm transition"
          >
            <h2 className="text-xl font-semibold text-ink-900 group-hover:text-brand-600">
              {t.title}
            </h2>
            <p className="mt-2 text-ink-700 text-sm leading-relaxed">{t.blurb}</p>
            <span className="mt-4 inline-block text-sm text-brand-600">Open →</span>
          </Link>
        ))}
      </section>

      <section className="mt-20 p-8 rounded-xl bg-ink-100 border border-ink-200">
        <h3 className="text-lg font-semibold text-ink-900">More on the way</h3>
        <ul className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-ink-700">
          <li>· HSL → OKLCH migrator (paste your tokens)</li>
          <li>· Multi-scale palette builder</li>
          <li>· Colourblind simulator</li>
          <li>· Data-viz scale builder</li>
          <li>· Gamut visualiser (3D)</li>
          <li>· Albers interactive demo</li>
        </ul>
      </section>
    </div>
  );
}
