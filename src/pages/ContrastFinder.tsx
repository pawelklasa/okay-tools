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
import { Field, HexInput, PageHeader, Pill, Slider } from "../components/ui";

export function ContrastFinder() {
  const [hex, setHex] = useState("#2563eb");
  const [minWcag, setMinWcag] = useState(4.5);
  const [minApca, setMinApca] = useState(60);

  const anchor: OKLCH = parseColor(hex) ?? { l: 0.62, c: 0.2, h: 255 };
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
        out.push({ fg, bg, wcag: w, apca: a, dL: Math.abs(fg.oklch.l - bg.oklch.l) });
      }
    }
    return out
      .filter((p) => p.wcag >= minWcag && Math.abs(p.apca) >= minApca)
      .sort((a, b) => b.dL - a.dL);
  }, [rows, minWcag, minApca]);

  const totalPairs = RAMP_STOPS.length * (RAMP_STOPS.length - 1);

  return (
    <>
      <PageHeader
        eyebrow="Contrast pair finder"
        title="ΔL is the shortcut."
        description="Build a ramp from any anchor. See every pair that passes WCAG and APCA, ranked by how far apart they sit on the L axis."
      />

      <div className="px-8 lg:px-12 pt-8 grid sm:grid-cols-3 gap-5 max-w-3xl">
        <Field label="Anchor">
          <HexInput value={hex} onChange={setHex} />
        </Field>
        <Slider
          label="WCAG ≥"
          value={minWcag}
          min={3}
          max={7}
          step={0.1}
          onChange={setMinWcag}
          display={minWcag.toFixed(1)}
        />
        <Slider
          label="APCA |Lc| ≥"
          value={minApca}
          min={30}
          max={90}
          step={5}
          onChange={setMinApca}
          display={String(minApca)}
        />
      </div>

      <div className="px-8 lg:px-12 mt-3 mb-2 mono text-[11px] text-[var(--color-fg-dim)] flex flex-wrap gap-x-6">
        <span>WCAG: 3.0 large · 4.5 AA · 7.0 AAA</span>
        <span>APCA: 45 large · 60 body · 75 small</span>
      </div>

      {/* Ramp preview */}
      <div className="grid grid-cols-11 mx-8 lg:mx-12 mt-6 rounded-[var(--radius)] overflow-hidden border border-[var(--color-border)]">
        {rows.map((r) => (
          <div
            key={r.stop}
            className="h-20 flex items-end p-2"
            style={{ background: r.css }}
          >
            <span
              className="mono text-[10px]"
              style={{ color: r.oklch.l > 0.6 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)" }}
            >
              {r.stop}
            </span>
          </div>
        ))}
      </div>

      <div className="px-8 lg:px-12 py-8 flex items-baseline justify-between flex-wrap gap-3">
        <p className="text-sm text-[var(--color-fg-muted)]">
          <span className="mono text-[var(--color-fg)]">{pairs.length}</span> qualifying pairs of{" "}
          <span className="mono">{totalPairs}</span> possible
        </p>
        <div className="flex items-center gap-2 text-xs text-[var(--color-fg-dim)]">
          <Pill tone="ok">passes both</Pill>
          <span>· sorted by ΔL</span>
        </div>
      </div>

      <div className="px-8 lg:px-12 pb-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pairs.slice(0, 60).map((p, i) => (
          <div
            key={i}
            className="rounded-[var(--radius)] overflow-hidden border border-[var(--color-border)]"
            style={{ background: p.bg.css }}
          >
            <div className="px-5 py-5" style={{ color: p.fg.css }}>
              <div className="text-2xl font-semibold tracking-tight">Aa</div>
              <div className="text-sm opacity-90 mt-0.5">
                {p.fg.stop} on {p.bg.stop}
              </div>
              <div className="mono text-[10px] opacity-70 mt-3 flex flex-wrap gap-x-3">
                <span>WCAG {p.wcag.toFixed(2)}</span>
                <span>APCA {p.apca.toFixed(0)}</span>
                <span>ΔL {p.dL.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
