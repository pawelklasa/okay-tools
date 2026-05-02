import { useMemo, useState } from "react";
import {
  apcaLc,
  buildRamp,
  contrastRatio,
  formatRamp,
  parseColor,
  RAMP_STOPS,
  type OKLCH,
} from "../lib/oklch";

export function ContrastFinder() {
  const [hex, setHex] = useState("#2563eb");
  const [minWcag, setMinWcag] = useState(4.5);
  const [minApca, setMinApca] = useState(60);

  const anchor = parseColor(hex) ?? ({ l: 0.62, c: 0.2, h: 255 } as OKLCH);
  const ramp = useMemo(() => buildRamp({ anchor, taperChroma: true }), [anchor]);
  const rows = formatRamp(ramp);

  const pairs = useMemo(() => {
    const out: {
      fg: typeof rows[number];
      bg: typeof rows[number];
      wcag: number;
      apca: number;
      dL: number;
    }[] = [];
    for (const fg of rows) {
      for (const bg of rows) {
        if (fg.stop === bg.stop) continue;
        const w = contrastRatio(fg.hex, bg.hex);
        const a = apcaLc(fg.hex, bg.hex);
        out.push({
          fg,
          bg,
          wcag: w,
          apca: a,
          dL: Math.abs(fg.oklch.l - bg.oklch.l),
        });
      }
    }
    return out
      .filter((p) => p.wcag >= minWcag && Math.abs(p.apca) >= minApca)
      .sort((a, b) => b.dL - a.dL);
  }, [rows, minWcag, minApca]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-ink-950 tracking-tight">Contrast Pair Finder</h1>
        <p className="text-ink-700 mt-2 max-w-2xl">
          Build a ramp from any anchor. See every pair that passes WCAG and APCA, ranked by
          ΔL — the OKLCH-native shortcut for accessible contrast.
        </p>
      </header>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Field label="Anchor (hex)">
          <div className="flex gap-2">
            <input
              type="color"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              className="h-10 w-12 rounded border border-ink-300 cursor-pointer"
            />
            <input
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md border border-ink-300 bg-white font-mono text-sm"
            />
          </div>
        </Field>
        <Field label={`WCAG ≥ ${minWcag.toFixed(1)}`}>
          <input
            type="range"
            min={3}
            max={7}
            step={0.1}
            value={minWcag}
            onChange={(e) => setMinWcag(parseFloat(e.target.value))}
            className="w-full accent-brand-500"
          />
          <p className="text-xs text-ink-500 mt-1">3.0 large · 4.5 AA · 7.0 AAA</p>
        </Field>
        <Field label={`APCA |Lc| ≥ ${minApca}`}>
          <input
            type="range"
            min={30}
            max={90}
            step={5}
            value={minApca}
            onChange={(e) => setMinApca(parseFloat(e.target.value))}
            className="w-full accent-brand-500"
          />
          <p className="text-xs text-ink-500 mt-1">45 large · 60 body · 75 small</p>
        </Field>
      </div>

      {/* Strip preview */}
      <div className="grid grid-cols-11 mb-6 rounded-lg overflow-hidden border border-ink-200">
        {rows.map((r) => (
          <div key={r.stop} className="aspect-[3/2] flex items-end p-1.5" style={{ background: r.css }}>
            <span
              className="text-[10px] font-mono"
              style={{ color: r.oklch.l > 0.6 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)" }}
            >
              {r.stop}
            </span>
          </div>
        ))}
      </div>

      <p className="text-sm text-ink-600 mb-4">
        {pairs.length} qualifying pairs out of {RAMP_STOPS.length * (RAMP_STOPS.length - 1)} possible.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pairs.slice(0, 60).map((p, i) => (
          <div
            key={i}
            className="rounded-lg overflow-hidden border border-ink-200"
            style={{ background: p.bg.css }}
          >
            <div className="px-4 py-3" style={{ color: p.fg.css }}>
              <div className="text-lg font-semibold">{p.fg.stop} on {p.bg.stop}</div>
              <div className="text-xs opacity-80 font-mono mt-0.5">
                WCAG {p.wcag.toFixed(2)} · APCA {p.apca.toFixed(0)} · ΔL {p.dL.toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>
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
