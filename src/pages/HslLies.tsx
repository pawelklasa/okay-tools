import { useState } from "react";
import { converter, parse, formatHex } from "culori";
import { oklchCss } from "../lib/oklch";
import { PageHeader, Pill, Slider } from "../components/ui";

const toHsl = converter("hsl");
const toOklch = converter("oklch");

export function HslLies() {
  const [hue, setHue] = useState(255);
  const [lightness, setLightness] = useState(50);

  const hslColor = `hsl(${hue} 80% ${lightness}%)`;
  const hslHex = formatHex(parse(hslColor)!) ?? "#000";
  const hslAsOklch = toOklch(parse(hslColor)!)!;

  const okL = 0.13 + (lightness / 100) * (0.985 - 0.13);
  const oklchColor = oklchCss({ l: okL, c: 0.18, h: hue });
  const oklchHex = formatHex(parse(oklchColor)!) ?? "#000";
  const oklchAsHsl = toHsl(parse(oklchColor)!)!;

  return (
    <>
      <PageHeader
        eyebrow="HSL Lies, OKLCH Doesn't"
        title="Drag lightness. See the lie."
        description="Same hue input. Same lightness target. HSL drifts the colour and lies about brightness. OKLCH does what it says on the slider."
      />

      <div className="px-8 lg:px-12 pt-8 max-w-2xl grid sm:grid-cols-2 gap-6">
        <Slider
          label="Hue"
          value={hue}
          min={0}
          max={360}
          step={1}
          onChange={(v) => setHue(Math.round(v))}
          display={`${hue}°`}
        />
        <Slider
          label="Lightness"
          value={lightness}
          min={0}
          max={100}
          step={1}
          onChange={(v) => setLightness(Math.round(v))}
          display={`${lightness}%`}
        />
      </div>

      <div className="px-8 lg:px-12 py-10 grid md:grid-cols-2 gap-5">
        <Card
          title="HSL"
          subtitle="Lightness is a math midpoint, not a perception."
          tag="warn"
          swatch={hslColor}
          rows={[
            ["css", hslColor],
            ["hex", hslHex],
            ["actual L (OKLCH)", (hslAsOklch.l ?? 0).toFixed(3)],
            ["actual hue (OKLCH)", `${(hslAsOklch.h ?? 0).toFixed(1)}°`],
          ]}
        />
        <Card
          title="OKLCH"
          subtitle="L means lightness. H stays where you put it."
          tag="ok"
          swatch={oklchColor}
          rows={[
            ["css", oklchColor],
            ["hex", oklchHex],
            ["actual L (OKLCH)", okL.toFixed(3)],
            ["mapped HSL hue", `${(oklchAsHsl.h ?? 0).toFixed(1)}°`],
          ]}
        />
      </div>

      <div className="mx-8 lg:mx-12 mb-12 p-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed max-w-3xl">
          <span className="text-[var(--color-fg)] font-semibold">Try it:</span> set hue to{" "}
          <span className="mono">255</span> (blue). Slide lightness from 0 to 100. In HSL, blue
          at L = 50% is almost black. In OKLCH, L = 0.5 actually looks like a midtone. Now try{" "}
          <span className="mono">60</span> (yellow). HSL at 50% glows. OKLCH at 0.5 sits politely
          in the middle.
        </p>
      </div>
    </>
  );
}

function Card({
  title,
  subtitle,
  swatch,
  rows,
  tag,
}: {
  title: string;
  subtitle: string;
  swatch: string;
  rows: [string, string][];
  tag: "warn" | "ok";
}) {
  return (
    <div className="rounded-[var(--radius)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="px-5 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <Pill tone={tag}>{tag === "ok" ? "honest" : "lies"}</Pill>
        </div>
        <p className="text-sm text-[var(--color-fg-muted)]">{subtitle}</p>
      </div>
      <div className="h-48" style={{ background: swatch }} />
      <table className="w-full mono text-xs">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t border-[var(--color-border)]">
              <td className="px-5 py-2 text-[var(--color-fg-dim)] w-1/3 uppercase tracking-wider text-[10px]">
                {k}
              </td>
              <td className="px-5 py-2 text-[var(--color-fg)]">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
