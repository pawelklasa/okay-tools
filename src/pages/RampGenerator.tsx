import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  buildRamp,
  formatRamp,
  oklchCss,
  oklchToHex,
  parseColor,
  type OKLCH,
} from "../lib/oklch";
import { EXPORT_FORMATS } from "../lib/exporters";
import { decodeRamp, encodeRamp } from "../lib/share";

export function RampGenerator() {
  const [params, setParams] = useSearchParams();

  const initial = useMemo(() => {
    const s = params.get("s");
    if (s) {
      const decoded = decodeRamp(s);
      if (decoded) return decoded;
    }
    return {
      anchor: { l: 0.62, c: 0.2, h: 255 } as OKLCH,
      name: "brand",
      curve: "linear" as const,
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [anchor, setAnchor] = useState<OKLCH>(initial.anchor);
  const [name, setName] = useState(initial.name);
  const [curve, setCurve] = useState<"linear" | "ease">(initial.curve);
  const [hexInput, setHexInput] = useState(oklchToHex(initial.anchor));
  const [exportId, setExportId] = useState<(typeof EXPORT_FORMATS)[number]["id"]>("tailwind");
  const [copied, setCopied] = useState(false);

  // Keep URL in sync
  useEffect(() => {
    const s = encodeRamp({ anchor, name, curve });
    setParams({ s }, { replace: true });
  }, [anchor, name, curve, setParams]);

  // Sync hex input -> anchor when user types a valid hex
  useEffect(() => {
    setHexInput(oklchToHex(anchor));
  }, [anchor]);

  const ramp = useMemo(
    () => buildRamp({ anchor, curve, taperChroma: true }),
    [anchor, curve],
  );
  const rows = formatRamp(ramp);

  const exportFn = EXPORT_FORMATS.find((f) => f.id === exportId)!.fn;
  const exported = exportFn(name || "brand", ramp);

  const copy = async () => {
    await navigator.clipboard.writeText(exported);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-ink-950 tracking-tight">Ramp Generator</h1>
        <p className="text-ink-700 mt-2 max-w-2xl">
          One anchor in. Eleven steps out, evenly spaced on the L axis. Hue and chroma stay
          honest. Edit the URL or share it — your palette is in the hash.
        </p>
      </header>

      <section className="grid lg:grid-cols-[320px_1fr] gap-8">
        {/* Controls */}
        <div className="space-y-5">
          <Field label="Scale name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
              className="w-full px-3 py-2 rounded-md border border-ink-300 bg-white font-mono text-sm"
            />
          </Field>

          <Field label="Anchor (hex)">
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={hexInput}
                onChange={(e) => {
                  const parsed = parseColor(e.target.value);
                  if (parsed) setAnchor(parsed);
                }}
                className="h-10 w-12 rounded border border-ink-300 cursor-pointer"
              />
              <input
                value={hexInput}
                onChange={(e) => {
                  setHexInput(e.target.value);
                  const parsed = parseColor(e.target.value);
                  if (parsed) setAnchor(parsed);
                }}
                className="flex-1 px-3 py-2 rounded-md border border-ink-300 bg-white font-mono text-sm"
              />
            </div>
          </Field>

          <Slider
            label="Lightness (L)"
            value={anchor.l}
            min={0}
            max={1}
            step={0.001}
            onChange={(v) => setAnchor({ ...anchor, l: v })}
            display={anchor.l.toFixed(3)}
          />
          <Slider
            label="Chroma (C)"
            value={anchor.c}
            min={0}
            max={0.4}
            step={0.001}
            onChange={(v) => setAnchor({ ...anchor, c: v })}
            display={anchor.c.toFixed(3)}
          />
          <Slider
            label="Hue (H)"
            value={anchor.h}
            min={0}
            max={360}
            step={0.1}
            onChange={(v) => setAnchor({ ...anchor, h: v })}
            display={anchor.h.toFixed(1) + "°"}
          />

          <Field label="L curve">
            <div className="flex gap-2">
              {(["linear", "ease"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurve(c)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm border ${
                    curve === c
                      ? "bg-ink-900 text-ink-50 border-ink-900"
                      : "bg-white border-ink-300 text-ink-700 hover:border-ink-500"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
            }}
            className="w-full px-3 py-2 rounded-md bg-ink-100 hover:bg-ink-200 text-ink-800 text-sm border border-ink-200"
          >
            Copy share URL
          </button>
        </div>

        {/* Ramp preview */}
        <div>
          <div className="rounded-xl overflow-hidden border border-ink-200 bg-white">
            <div className="grid grid-cols-11">
              {rows.map((r) => (
                <div
                  key={r.stop}
                  className="aspect-square flex items-end p-2"
                  style={{ background: r.css }}
                  title={`${name}-${r.stop}`}
                >
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: r.oklch.l > 0.6 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)" }}
                  >
                    {r.stop}
                  </span>
                </div>
              ))}
            </div>

            <table className="w-full text-xs font-mono">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th className="text-left px-3 py-2">Stop</th>
                  <th className="text-left px-3 py-2">OKLCH</th>
                  <th className="text-left px-3 py-2">Hex</th>
                  <th className="text-left px-3 py-2">Gamut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.stop} className="border-t border-ink-100">
                    <td className="px-3 py-1.5">{r.stop}</td>
                    <td className="px-3 py-1.5">{r.css}</td>
                    <td className="px-3 py-1.5">{r.hex}</td>
                    <td className="px-3 py-1.5">
                      {r.inSrgb ? (
                        <span className="text-ink-500">sRGB</span>
                      ) : r.inP3 ? (
                        <span className="text-amber-600">P3 only</span>
                      ) : (
                        <span className="text-red-600">Out of P3</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Export */}
          <div className="mt-6 rounded-xl border border-ink-200 bg-white">
            <div className="flex flex-wrap gap-1 border-b border-ink-200 p-2">
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setExportId(f.id)}
                  className={`px-3 py-1.5 text-sm rounded-md ${
                    exportId === f.id
                      ? "bg-ink-900 text-ink-50"
                      : "text-ink-700 hover:bg-ink-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <button
                onClick={copy}
                className="ml-auto px-3 py-1.5 text-sm rounded-md bg-brand-500 hover:bg-brand-600 text-white"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-xs font-mono text-ink-800 whitespace-pre">
              {exported}
            </pre>
          </div>

          {/* OKLCH equation summary */}
          <p className="mt-4 text-sm text-ink-600 font-mono">
            anchor = {oklchCss(anchor)}
          </p>
        </div>
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

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <Field label={`${label} — ${display}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-brand-500"
      />
    </Field>
  );
}
