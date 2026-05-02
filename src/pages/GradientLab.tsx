import { useMemo, useState } from "react";
import { interpolateCss, parseColor } from "../lib/oklch";

const SPACES = [
  { id: "oklch", label: "OKLCH", note: "perceptually uniform — what your eye expects" },
  { id: "oklab", label: "Oklab", note: "Cartesian sibling of OKLCH" },
  { id: "lab", label: "CIELAB", note: "the 1976 reference — has the famous 'blue turn'" },
  { id: "hsl", label: "HSL", note: "broken at the midpoints" },
  { id: "srgb", label: "sRGB", note: "the dead-grey middle, raw" },
] as const;

export function GradientLab() {
  const [from, setFrom] = useState("#facc15"); // yellow
  const [to, setTo] = useState("#2563eb"); // blue
  const [steps, setSteps] = useState(13);

  const fromOk = parseColor(from);
  const toOk = parseColor(to);

  const gradients = useMemo(() => {
    return SPACES.map((s) => ({
      ...s,
      stops: interpolateCss(from, to, steps, s.id),
    }));
  }, [from, to, steps]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-ink-950 tracking-tight">Gradient Lab</h1>
        <p className="text-ink-700 mt-2 max-w-2xl">
          The classic test: yellow to blue. In sRGB and HSL the middle dies in a muddy grey.
          In OKLCH it stays alive. See for yourself.
        </p>
      </header>

      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-4 mb-8">
        <Field label="From">
          <div className="flex gap-2">
            <input
              type="color"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 w-12 rounded border border-ink-300 cursor-pointer"
            />
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md border border-ink-300 bg-white font-mono text-sm"
            />
          </div>
        </Field>
        <Field label="To">
          <div className="flex gap-2">
            <input
              type="color"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 w-12 rounded border border-ink-300 cursor-pointer"
            />
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md border border-ink-300 bg-white font-mono text-sm"
            />
          </div>
        </Field>
        <Field label={`Steps — ${steps}`}>
          <input
            type="range"
            min={5}
            max={31}
            step={2}
            value={steps}
            onChange={(e) => setSteps(parseInt(e.target.value))}
            className="w-40 accent-brand-500"
          />
        </Field>
      </div>

      {!fromOk || !toOk ? (
        <p className="text-red-600">Invalid colour — please check the hex inputs.</p>
      ) : (
        <div className="space-y-5">
          {gradients.map((g) => (
            <div key={g.id} className="rounded-xl overflow-hidden border border-ink-200 bg-white">
              <div className="flex items-baseline justify-between px-4 py-3 border-b border-ink-100">
                <h3 className="font-semibold text-ink-900">{g.label}</h3>
                <span className="text-xs text-ink-600">{g.note}</span>
              </div>

              {/* Banded version (clearly shows midpoint) */}
              <div className="grid" style={{ gridTemplateColumns: `repeat(${steps}, 1fr)` }}>
                {g.stops.map((c, i) => (
                  <div
                    key={i}
                    className="h-12"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>

              {/* Smooth CSS-native gradient in the same space */}
              <div
                className="h-8"
                style={{
                  background: `linear-gradient(in ${g.id === "srgb" ? "srgb" : g.id} to right, ${from}, ${to})`,
                }}
              />
            </div>
          ))}
        </div>
      )}
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
