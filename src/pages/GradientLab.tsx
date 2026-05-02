import { useMemo, useState } from "react";
import { interpolateCss, parseColor } from "../lib/oklch";
import { Field, HexInput, PageHeader, Pill, Slider } from "../components/ui";

const SPACES = [
  { id: "oklch", label: "OKLCH", note: "perceptually uniform — what your eye expects", tone: "ok" as const },
  { id: "oklab", label: "Oklab", note: "Cartesian sibling of OKLCH", tone: "ok" as const },
  { id: "lab", label: "CIELAB", note: "the 1976 reference — has the famous blue turn", tone: "default" as const },
  { id: "hsl", label: "HSL", note: "broken at the midpoints", tone: "warn" as const },
  { id: "srgb", label: "sRGB", note: "the dead-grey middle, raw", tone: "err" as const },
] as const;

export function GradientLab() {
  const [from, setFrom] = useState("#facc15");
  const [to, setTo] = useState("#2563eb");
  const [steps, setSteps] = useState(13);

  const fromOk = parseColor(from);
  const toOk = parseColor(to);

  const gradients = useMemo(
    () =>
      SPACES.map((s) => ({
        ...s,
        stops: interpolateCss(from, to, steps, s.id),
      })),
    [from, to, steps],
  );

  const valid = fromOk && toOk;

  return (
    <>
      <PageHeader
        eyebrow="Gradient lab"
        title="The dead-grey middle, exposed."
        description="The same two colours interpolated in five colour spaces. Watch sRGB and HSL collapse in the middle. Watch OKLCH stay alive."
      />

      <div className="px-8 lg:px-12 pt-8 grid sm:grid-cols-[1fr_1fr_240px] gap-5 max-w-3xl">
        <Field label="From">
          <HexInput value={from} onChange={setFrom} />
        </Field>
        <Field label="To">
          <HexInput value={to} onChange={setTo} />
        </Field>
        <Slider
          label="Steps"
          value={steps}
          min={5}
          max={31}
          step={2}
          onChange={(v) => setSteps(Math.round(v))}
          display={String(steps)}
        />
      </div>

      <div className="px-8 lg:px-12 py-10 space-y-4">
        {!valid && (
          <p className="text-[var(--color-err)] text-sm">Invalid colour — check the hex inputs.</p>
        )}

        {valid &&
          gradients.map((g) => (
            <div
              key={g.id}
              className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]"
            >
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold tracking-tight">{g.label}</h3>
                  <Pill tone={g.tone}>{g.id}</Pill>
                </div>
                <span className="text-xs text-[var(--color-fg-dim)]">{g.note}</span>
              </div>

              {/* Banded — clear midpoint reveal */}
              <div
                className="grid"
                style={{ gridTemplateColumns: `repeat(${steps}, 1fr)` }}
              >
                {g.stops.map((c, i) => (
                  <div key={i} className="h-14" style={{ background: c }} title={c} />
                ))}
              </div>

              {/* Smooth, CSS-native in the same space */}
              <div
                className="h-10"
                style={{
                  background: `linear-gradient(in ${
                    g.id === "srgb" ? "srgb" : g.id
                  } to right, ${from}, ${to})`,
                }}
              />
            </div>
          ))}
      </div>
    </>
  );
}
