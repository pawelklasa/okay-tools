import { useMemo, useState } from "react";
import {
  buildRamp,
  formatRamp,
  invertRamp,
  parseColor,
  RAMP_STOPS,
  type OKLCH,
} from "../lib/oklch";

export function DarkModeInverter() {
  const [hex, setHex] = useState("#2563eb");
  const anchor: OKLCH = parseColor(hex) ?? { l: 0.62, c: 0.2, h: 255 };

  const light = useMemo(() => buildRamp({ anchor, taperChroma: true }), [anchor]);
  const dark = useMemo(() => invertRamp(light), [light]);

  const lightRows = formatRamp(light);
  const darkRows = formatRamp(dark);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-ink-950 tracking-tight">Dark Mode Inverter</h1>
        <p className="text-ink-700 mt-2 max-w-2xl">
          Build a light ramp. Flip the L axis. Watch dark mode behave — no extra tweaking.
          50 ↔ 950, 100 ↔ 900, and so on.
        </p>
      </header>

      <div className="max-w-sm mb-8">
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-wider text-ink-600 mb-1.5">
            Anchor
          </span>
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
        </label>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Preview title="Light" rows={lightRows} bg="#ffffff" fg="#0a0a0a" />
        <Preview title="Dark" rows={darkRows} bg="#0a0a0a" fg="#fafafa" />
      </div>

      <div className="mt-6 grid grid-cols-11 rounded-lg overflow-hidden border border-ink-200">
        {RAMP_STOPS.map((s, i) => (
          <div key={s} className="text-center text-[10px] font-mono py-1 border-r border-ink-100 last:border-r-0">
            {s} ↔ {RAMP_STOPS[RAMP_STOPS.length - 1 - i]}
          </div>
        ))}
      </div>
    </div>
  );
}

function Preview({
  title,
  rows,
  bg,
  fg,
}: {
  title: string;
  rows: ReturnType<typeof formatRamp>;
  bg: string;
  fg: string;
}) {
  return (
    <div
      className="rounded-xl border border-ink-200 overflow-hidden"
      style={{ background: bg, color: fg }}
    >
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs opacity-70">{rows.length} steps</span>
      </div>

      <div className="grid grid-cols-11">
        {rows.map((r) => (
          <div key={r.stop} className="aspect-square" style={{ background: r.css }} />
        ))}
      </div>

      <div className="p-5 space-y-3">
        <div className="rounded-lg p-4" style={{ background: rows[1].css, color: rows[9].css }}>
          <div className="text-sm font-semibold">Card title</div>
          <div className="text-xs opacity-90">
            Body text rendered on a {rows[1].stop} surface using {rows[9].stop} ink.
          </div>
        </div>
        <button
          className="w-full px-4 py-2 rounded-md text-sm font-medium"
          style={{ background: rows[5].css, color: rows[0].css }}
        >
          Primary button (500 / 50)
        </button>
        <button
          className="w-full px-4 py-2 rounded-md text-sm font-medium border"
          style={{ borderColor: rows[3].css, color: rows[7].css }}
        >
          Secondary button (700 on transparent, 300 border)
        </button>
      </div>
    </div>
  );
}
