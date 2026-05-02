import { useState } from "react";
import { converter, parse, formatHex } from "culori";
import { oklchCss } from "../lib/oklch";

const toHsl = converter("hsl");
const toOklch = converter("oklch");

export function HslLies() {
  const [hue, setHue] = useState(255); // blue
  const [lightness, setLightness] = useState(50);

  // HSL: keep H + S, vary L
  const hslColor = `hsl(${hue} 80% ${lightness}%)`;
  const hslHex = formatHex(parse(hslColor)!) ?? "#000";
  const hslAsOklch = toOklch(parse(hslColor)!)!;

  // OKLCH: match anchor at L=0.62 with same hue, chroma 0.18, vary L proportionally
  const okL = 0.13 + (lightness / 100) * (0.985 - 0.13);
  const oklchColor = oklchCss({ l: okL, c: 0.18, h: hue });
  const oklchHex = formatHex(parse(oklchColor)!) ?? "#000";
  const oklchAsHsl = toHsl(parse(oklchColor)!)!;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold text-ink-950 tracking-tight">HSL Lies, OKLCH Doesn’t</h1>
        <p className="text-ink-700 mt-2 max-w-2xl">
          Drag lightness on both. Same hue, same starting point. Watch what HSL does to the
          colour at the extremes — and what OKLCH refuses to do.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <Field label={`Hue — ${hue.toFixed(0)}°`}>
          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            onChange={(e) => setHue(parseInt(e.target.value))}
            className="w-full accent-brand-500"
          />
        </Field>
        <Field label={`Lightness — ${lightness}%`}>
          <input
            type="range"
            min={0}
            max={100}
            value={lightness}
            onChange={(e) => setLightness(parseInt(e.target.value))}
            className="w-full accent-brand-500"
          />
        </Field>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card
          title="HSL"
          subtitle="The lightness slider is mathematical, not perceptual."
          swatch={hslColor}
          rows={[
            ["css", hslColor],
            ["hex", hslHex],
            ["actual L (OKLCH)", (hslAsOklch.l ?? 0).toFixed(3)],
            ["actual hue (OKLCH)", `${(hslAsOklch.h ?? 0).toFixed(1)}°`],
          ]}
          tone="warn"
        />
        <Card
          title="OKLCH"
          subtitle="Lightness means lightness. Hue stays where you put it."
          swatch={oklchColor}
          rows={[
            ["css", oklchColor],
            ["hex", oklchHex],
            ["actual L (OKLCH)", okL.toFixed(3)],
            ["mapped HSL hue", `${(oklchAsHsl.h ?? 0).toFixed(1)}°`],
          ]}
          tone="ok"
        />
      </div>

      <section className="mt-12 p-6 rounded-xl bg-ink-100 border border-ink-200">
        <p className="text-sm text-ink-700 leading-relaxed">
          <strong className="text-ink-900">Try this:</strong> set hue to 255 (blue) and slide
          lightness from 0 to 100. In HSL, the perceived brightness of pure blue at L=50% is
          almost black. In OKLCH, L=0.5 actually looks like a midtone. Now try yellow (60°).
          HSL at 50% glows; OKLCH at 0.5 sits politely in the middle.
        </p>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wider text-ink-600 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function Card({
  title,
  subtitle,
  swatch,
  rows,
  tone,
}: {
  title: string;
  subtitle: string;
  swatch: string;
  rows: [string, string][];
  tone: "warn" | "ok";
}) {
  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden ${
        tone === "warn" ? "border-amber-200" : "border-emerald-200"
      }`}
    >
      <div className="p-4 border-b border-ink-100">
        <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
        <p className="text-sm text-ink-600">{subtitle}</p>
      </div>
      <div className="h-40" style={{ background: swatch }} />
      <table className="w-full text-xs font-mono">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t border-ink-100">
              <td className="px-4 py-1.5 text-ink-500 w-1/3">{k}</td>
              <td className="px-4 py-1.5 text-ink-800">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
