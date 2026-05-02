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
import { Button, Field, HexInput, PageHeader, Pill, Slider } from "../components/ui";

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
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    const s = encodeRamp({ anchor, name, curve });
    setParams({ s }, { replace: true });
  }, [anchor, name, curve, setParams]);

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

  const handleHex = (v: string) => {
    setHexInput(v);
    const parsed = parseColor(v);
    if (parsed) setAnchor(parsed);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(exported);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const copyShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1500);
  };

  return (
    <>
      <PageHeader
        eyebrow="Ramp generator"
        title="One anchor. Eleven steps."
        description="Even on the L axis. Hue and chroma stay honest. Edit a slider — your URL updates so you can share the result."
        actions={
          <Button onClick={copyShare}>
            {shareCopied ? "Copied ✓" : "Copy share URL"}
          </Button>
        }
      />

      {/* Big swatch strip — the hero */}
      <div className="grid grid-cols-11 mx-8 lg:mx-12 mt-8 rounded-[var(--radius)] overflow-hidden border border-[var(--color-border)]">
        {rows.map((r) => (
          <div
            key={r.stop}
            className="h-40 sm:h-52 flex flex-col justify-between p-3"
            style={{ background: r.css }}
          >
            <span
              className="mono text-xs font-medium"
              style={{ color: r.oklch.l > 0.6 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)" }}
            >
              {name || "brand"}-{r.stop}
            </span>
            <span
              className="mono text-[10px] opacity-80"
              style={{ color: r.oklch.l > 0.6 ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.7)" }}
            >
              {r.hex}
            </span>
          </div>
        ))}
      </div>

      <div className="px-8 lg:px-12 py-10 grid lg:grid-cols-[300px_1fr] gap-10">
        {/* Controls */}
        <aside className="space-y-6">
          <Field label="Scale name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
            />
          </Field>

          <Field label="Anchor">
            <HexInput value={hexInput} onChange={handleHex} />
          </Field>

          <Slider
            label="Lightness · L"
            value={anchor.l}
            min={0}
            max={1}
            step={0.001}
            onChange={(v) => setAnchor({ ...anchor, l: v })}
            display={anchor.l.toFixed(3)}
          />
          <Slider
            label="Chroma · C"
            value={anchor.c}
            min={0}
            max={0.4}
            step={0.001}
            onChange={(v) => setAnchor({ ...anchor, c: v })}
            display={anchor.c.toFixed(3)}
          />
          <Slider
            label="Hue · H"
            value={anchor.h}
            min={0}
            max={360}
            step={0.1}
            onChange={(v) => setAnchor({ ...anchor, h: v })}
            display={`${anchor.h.toFixed(1)}°`}
          />

          <Field label="L curve">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)]">
              {(["linear", "ease"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurve(c)}
                  className={`px-3 py-1.5 rounded text-sm capitalize transition ${
                    curve === c
                      ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                      : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <div className="pt-3 border-t border-[var(--color-border)] mono text-[11px] text-[var(--color-fg-dim)] leading-relaxed">
            anchor = {oklchCss(anchor)}
          </div>
        </aside>

        {/* Right: table + export */}
        <div className="space-y-6 min-w-0">
          {/* Stop table */}
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden">
            <table className="w-full mono text-xs">
              <thead className="bg-[var(--color-surface)] text-[var(--color-fg-dim)]">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium uppercase tracking-wider text-[10px]">
                    Stop
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium uppercase tracking-wider text-[10px]">
                    OKLCH
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium uppercase tracking-wider text-[10px]">
                    Hex
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium uppercase tracking-wider text-[10px]">
                    Gamut
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.stop}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface)]"
                  >
                    <td className="px-4 py-2 flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-sm border border-[var(--color-border)]"
                        style={{ background: r.css }}
                      />
                      <span className="text-[var(--color-fg)]">{r.stop}</span>
                    </td>
                    <td className="px-4 py-2 text-[var(--color-fg-muted)]">{r.css}</td>
                    <td className="px-4 py-2 text-[var(--color-fg-muted)]">{r.hex}</td>
                    <td className="px-4 py-2">
                      {r.inSrgb ? (
                        <Pill>sRGB</Pill>
                      ) : r.inP3 ? (
                        <Pill tone="warn">P3 only</Pill>
                      ) : (
                        <Pill tone="err">Outside P3</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Export */}
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden">
            <div className="flex items-center gap-1 p-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setExportId(f.id)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded text-xs transition ${
                    exportId === f.id
                      ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                      : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <Button onClick={copy} variant="primary" className="ml-auto">
                {copied ? "Copied ✓" : "Copy"}
              </Button>
            </div>
            <pre className="mono text-xs text-[var(--color-fg-muted)] leading-relaxed p-5 overflow-x-auto whitespace-pre">
              {exported}
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}
