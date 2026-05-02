import { useMemo, useState } from "react";
import {
  buildRamp,
  formatRamp,
  invertRamp,
  parseColor,
  RAMP_STOPS,
  type OKLCH,
} from "../lib/oklch";
import { Field, HexInput, PageHeader } from "../components/ui";

export function DarkModeInverter() {
  const [hex, setHex] = useState("#2563eb");
  const anchor: OKLCH = parseColor(hex) ?? { l: 0.62, c: 0.2, h: 255 };

  const light = useMemo(() => buildRamp({ anchor, taperChroma: true }), [anchor]);
  const dark = useMemo(() => invertRamp(light), [light]);

  const lightRows = formatRamp(light);
  const darkRows = formatRamp(dark);

  return (
    <>
      <PageHeader
        eyebrow="Dark mode inverter"
        title="Flip the L axis. Done."
        description="Build a light ramp. The dark version is the same ramp, mirrored: 50 ↔ 950, 100 ↔ 900. No tweaking. The way the article describes it."
      />

      <div className="px-8 lg:px-12 pt-8 max-w-sm">
        <Field label="Anchor">
          <HexInput value={hex} onChange={setHex} />
        </Field>
      </div>

      <div className="px-8 lg:px-12 py-10 grid lg:grid-cols-2 gap-5">
        <Preview title="Light" rows={lightRows} bg="#fafafa" fg="#0a0a0a" />
        <Preview title="Dark" rows={darkRows} bg="#0a0a0a" fg="#fafafa" />
      </div>

      <div className="mx-8 lg:mx-12 mb-12 grid grid-cols-11 rounded-[var(--radius)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">
        {RAMP_STOPS.map((s, i) => (
          <div
            key={s}
            className="text-center mono text-[10px] py-2 border-r border-[var(--color-border)] last:border-r-0 text-[var(--color-fg-dim)]"
          >
            <span className="text-[var(--color-fg)]">{s}</span>{" "}
            <span className="opacity-60">↔</span>{" "}
            <span>{RAMP_STOPS[RAMP_STOPS.length - 1 - i]}</span>
          </div>
        ))}
      </div>
    </>
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
      className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden"
      style={{ background: bg, color: fg }}
    >
      <div className="px-6 py-4 border-b" style={{ borderColor: rows[2].css }}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          <span
            className="mono text-[10px] uppercase tracking-wider opacity-70"
          >
            {rows.length} steps
          </span>
        </div>
      </div>

      <div className="grid grid-cols-11">
        {rows.map((r) => (
          <div key={r.stop} className="h-10" style={{ background: r.css }} />
        ))}
      </div>

      <div className="p-6 space-y-4">
        <div
          className="rounded-[var(--radius-sm)] p-4 border"
          style={{ background: rows[1].css, borderColor: rows[2].css, color: rows[9].css }}
        >
          <div className="text-sm font-semibold mb-1">Card title</div>
          <div className="text-xs opacity-80 leading-relaxed">
            Body text rendered on a {rows[1].stop} surface using {rows[9].stop} ink. The two
            stops are {Math.abs(rows[1].oklch.l - rows[9].oklch.l).toFixed(2)} apart on L.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="flex-1 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium"
            style={{ background: rows[5].css, color: rows[0].css }}
          >
            Primary · 500 / 50
          </button>
          <button
            className="flex-1 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium border"
            style={{ borderColor: rows[3].css, color: rows[7].css, background: "transparent" }}
          >
            Secondary
          </button>
        </div>
      </div>
    </div>
  );
}
