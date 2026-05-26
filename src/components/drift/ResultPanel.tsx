import { useRef, useState } from "react";
import { Card, Pill, Button } from "../ui";
import {
  CATEGORIES,
  type CategoryReport,
  type DriftReport,
  type NormalizedValue,
} from "../../lib/drift";

/**
 * Shared result UI — used identically by paste, URL, and repo modes.
 * Renders:
 *   - Headline ("This page uses N distinct greys, M font sizes, ...")
 *   - Per-category breakdown table (count · baseline · delta)
 *   - Colour swatch view (the "you can't tell these 14 greys apart" moment)
 *   - Worst-offender file list (repo mode only)
 *   - Method panel: tolerance + every normalisation rule
 *   - Shareable card (PNG export) + copy-summary
 */
export function ResultPanel({ report }: { report: DriftReport }) {
  return (
    <div className="space-y-5">
      <Headline report={report} />
      <BreakdownTable report={report} />
      <SwatchView report={report} />
      {report.offenders && report.offenders.length > 0 && <Offenders offenders={report.offenders} />}
      <MethodPanel report={report} />
      <ShareCard report={report} />
    </div>
  );
}

function Headline({ report }: { report: DriftReport }) {
  const target =
    report.mode === "url" ? "page" : report.mode === "repo" ? "project" : "stylesheet";

  // Lead with what's wrong. Sort categories that are over budget by delta,
  // take the top three. If nothing is over budget but there are near-
  // duplicate clusters, lead with those (the score otherwise hides duplicate
  // greys that survive strict ΔE dedup). If neither, declare clean.
  const overCats = report.categories
    .filter((c) => c.delta > 0)
    .sort((a, b) => b.delta - a.delta);
  const ndupCats = report.categories
    .filter((c) => c.nearDuplicateClusters > 0)
    .sort((a, b) => b.nearDuplicateClusters - a.nearDuplicateClusters);

  let body: React.ReactNode;
  let tone: "warn" | "ok" = "ok";
  let verdict = "within baseline";

  if (overCats.length > 0) {
    tone = "warn";
    verdict = `${report.overBudget} over baseline`;
    const lead = overCats.slice(0, 3);
    body = (
      <>
        This {target} uses{" "}
        {lead.map((c, i) => (
          <span key={c.category} className="whitespace-nowrap">
            <strong>{c.distinctCount}</strong>{" "}
            {CATEGORIES[c.category].toLowerCase()}{" "}
            <span className="mono text-[13px] md:text-[14px] text-[var(--color-err)] bg-[color-mix(in_oklab,var(--color-err)_14%,transparent)] rounded-md px-1.5 py-0.5 align-middle">
              +{c.delta}
            </span>
            {i < lead.length - 2 ? ", " : i === lead.length - 2 ? ", and " : ""}
          </span>
        ))}
        {" "}— above the published baseline range.
      </>
    );
  } else if (ndupCats.length > 0) {
    tone = "warn";
    verdict = `${report.nearDuplicateClusters} near-duplicate cluster${report.nearDuplicateClusters === 1 ? "" : "s"}`;
    const lead = ndupCats[0];
    body = (
      <>
        Every category is within baseline, but{" "}
        <strong>{lead.nearDuplicateClusters}</strong> near-duplicate{" "}
        {lead.nearDuplicateClusters === 1 ? "pair" : "pairs"} of{" "}
        {CATEGORIES[lead.category].toLowerCase()} survived the strict ΔE dedup
        — colours close enough that a designer would call them “the same.”
        See the swatch view below.
      </>
    );
  } else {
    const totalColours =
      (report.categories.find((c) => c.category === "textColor")?.distinctCount ?? 0) +
      (report.categories.find((c) => c.category === "bgColor")?.distinctCount ?? 0) +
      (report.categories.find((c) => c.category === "borderColor")?.distinctCount ?? 0);
    body = (
      <>
        This {target} stays within every published baseline.{" "}
        <strong>{totalColours}</strong> distinct colours,{" "}
        <strong>{report.totalDistinct}</strong> distinct values across 12 categories.
      </>
    );
  }

  return (
    <Card className="!p-6">
      <p className="mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-2">
        Drift Score
      </p>
      <p className="text-[20px] md:text-[24px] leading-snug text-[var(--color-fg)]">
        {body}
      </p>
      <div className="mt-3 flex items-center gap-3 text-[12px] text-[var(--color-fg-muted)] flex-wrap">
        <Pill tone={tone}>{verdict}</Pill>
        <span className="mono">
          {report.totalDistinct} distinct · {report.totalObservations.toLocaleString()} samples
        </span>
        <span className="mono text-[var(--color-fg-dim)]">
          ΔE OKLab ≤ {report.config.colorToleranceDeltaE}
        </span>
      </div>
    </Card>
  );
}

function BreakdownTable({ report }: { report: DriftReport }) {
  return (
    <Card padded={false}>
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
          Per-category breakdown
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[var(--color-fg-dim)] mono text-[10px] uppercase tracking-[0.14em]">
              <th className="text-left px-5 py-2 font-normal">Category</th>
              <th className="text-right px-3 py-2 font-normal">Count</th>
              <th className="text-right px-3 py-2 font-normal">Baseline</th>
              <th className="text-right px-3 py-2 font-normal">Delta</th>
              <th className="text-left px-5 py-2 font-normal">Source</th>
            </tr>
          </thead>
          <tbody>
            {report.categories.map((c) => (
              <tr key={c.category} className="border-t border-[var(--color-border)]">
                <td className="px-5 py-2 text-[var(--color-fg)]">{CATEGORIES[c.category]}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {c.distinctCount}
                  {c.nearDuplicateClusters > 0 ? (
                    <span className="ml-1 text-[10px] text-[var(--color-warn,#c08a3a)] mono font-normal">
                      +{c.nearDuplicateClusters} near-dup
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right mono text-[var(--color-fg-muted)]">
                  {c.baseline.min}–{c.baseline.max}
                </td>
                <td className="px-3 py-2 text-right">
                  {c.status === "over" ? (
                    <span className="text-[var(--color-err)] mono">+{c.delta}</span>
                  ) : c.status === "unused" ? (
                    <span className="text-[var(--color-fg-dim)] mono">n/a</span>
                  ) : (
                    <span className="text-[var(--color-ok)] mono">ok</span>
                  )}
                </td>
                <td className="px-5 py-2 text-[12px] text-[var(--color-fg-dim)]">{c.baseline.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SwatchView({ report }: { report: DriftReport }) {
  const colourCats = report.categories.filter(
    (c) => c.category === "textColor" || c.category === "bgColor" || c.category === "borderColor"
  );
  const totalColours = colourCats.reduce((n, c) => n + c.distinctCount, 0);
  if (totalColours === 0) return null;
  return (
    <Card padded={false}>
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
          Colour swatches
        </p>
      </div>
      <div className="p-5 space-y-4">
        {colourCats.map((c) => (
          <SwatchRow key={c.category} cat={c} />
        ))}
      </div>
    </Card>
  );
}

function SwatchRow({ cat }: { cat: CategoryReport }) {
  if (cat.distinctCount === 0) return null;
  return (
    <div>
      <p className="mono text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)] mb-2">
        {CATEGORIES[cat.category]} · {cat.distinctCount} distinct
      </p>
      <div className="flex flex-wrap gap-1.5">
        {cat.values.map((v) => (
          <Swatch key={v.key} v={v} />
        ))}
      </div>
    </div>
  );
}

function Swatch({ v }: { v: NormalizedValue }) {
  const colourValue = v.display.split("@")[0]; // strip alpha annotation
  return (
    <div
      title={`${v.display} · ${v.occurrences} uses`}
      className="group flex items-center gap-2 pr-2 pl-1 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)]"
    >
      <span
        className="w-6 h-6 rounded-sm border border-[var(--color-border)]"
        style={{ background: colourValue }}
      />
      <span className="mono text-[11px] text-[var(--color-fg-muted)]">{v.display}</span>
      <span className="mono text-[10px] text-[var(--color-fg-dim)]">×{v.occurrences}</span>
    </div>
  );
}

function Offenders({ offenders }: { offenders: NonNullable<DriftReport["offenders"]> }) {
  return (
    <Card padded={false}>
      <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
          Worst offender files
        </p>
        <span className="mono text-[10px] text-[var(--color-fg-dim)]">most hardcoded values</span>
      </div>
      <table className="w-full text-[13px]">
        <tbody>
          {offenders.slice(0, 20).map((o) => (
            <tr key={o.file} className="border-t border-[var(--color-border)]">
              <td className="px-5 py-2 mono text-[12px] text-[var(--color-fg-muted)]">{o.file}</td>
              <td className="px-3 py-2 text-right mono text-[12px] text-[var(--color-fg)] w-20">
                {o.hardcodedCount}
              </td>
              <td className="px-5 py-2 text-right mono text-[11px] text-[var(--color-fg-dim)] w-24">
                {o.distinctValues} distinct
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function MethodPanel({ report }: { report: DriftReport }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
          Method · how this number was produced
        </span>
        <span className="text-[var(--color-fg-dim)]">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-3 text-[13px] text-[var(--color-fg-muted)] leading-relaxed">
          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-3 text-[12.5px]">
            <p className="mono text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)] mb-1.5">
              Colour tolerance
            </p>
            <p>
              Two colours are bucketed as one when their Euclidean distance in
              <strong> OKLab </strong>
              (Björn Ottosson,{" "}
              <a
                href="https://bottosson.github.io/posts/oklab/"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted underline-offset-2"
              >
                “A perceptual color space for image processing”, 2020
              </a>
              ) is ≤{" "}
              <span className="mono text-[var(--color-fg)]">
                {report.config.colorToleranceDeltaE.toFixed(3)}
              </span>
              . The default <span className="mono">0.020</span> is the
              just-noticeable-difference on a calibrated monitor at normal viewing
              distance, roughly equivalent to CIEDE2000 ΔE ≈ 1.0. Note this is
              <strong> not </strong>
              CIEDE2000 ΔE — the scales differ by a factor of ~50.
            </p>
          </div>
          <p>
            Spacing bucket:{" "}
            <span className="mono text-[var(--color-fg)]">{report.config.spacingBucketPx}px</span>.
            Min spacing counted:{" "}
            <span className="mono text-[var(--color-fg)]">{report.config.spacingMinPx}px</span>.
          </p>
          <ol className="list-decimal pl-5 space-y-1.5">
            {report.rulesApplied.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
          {report.thirdPartyExclusions.length > 0 && (
            <div className="pt-2 border-t border-[var(--color-border)]">
              <p className="mono text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)] mb-1">
                Third-party iframes excluded
              </p>
              <ul className="mono text-[12px]">
                {report.thirdPartyExclusions.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {report.warnings.length > 0 && (
            <div className="pt-2 border-t border-[var(--color-border)]">
              <p className="mono text-[10px] uppercase tracking-wider text-[var(--color-warn)] mb-1">
                Warnings
              </p>
              <ul className="text-[12px]">
                {report.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ShareCard({ report }: { report: DriftReport }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const summary = buildSummary(report);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const exportPng = async () => {
    const node = ref.current;
    if (!node) return;
    // Render the card to a canvas via foreignObject SVG — no third-party deps.
    const rect = node.getBoundingClientRect();
    const w = Math.ceil(rect.width);
    const h = Math.ceil(rect.height);
    const clone = node.cloneNode(true) as HTMLElement;
    const inlineStyles = getComputedStyle(document.documentElement);
    // Stamp the most important variables so the SVG renders the same colours.
    const vars = [
      "--color-bg", "--color-surface", "--color-surface-2",
      "--color-border", "--color-border-strong",
      "--color-fg", "--color-fg-muted", "--color-fg-dim",
      "--color-accent-300", "--color-accent-400", "--color-accent-500", "--color-accent-600",
      "--color-ok", "--color-warn", "--color-err",
      "--radius", "--radius-sm", "--radius-lg",
    ];
    let varCss = "";
    for (const v of vars) varCss += `${v}: ${inlineStyles.getPropertyValue(v)};`;
    clone.style.cssText += `;${varCss};background:${inlineStyles.getPropertyValue("--color-surface")};color:${inlineStyles.getPropertyValue("--color-fg")};`;
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Inter,system-ui,sans-serif">
          ${clone.outerHTML}
        </div>
      </foreignObject>
    </svg>`;
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * 2; canvas.height = h * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (!b) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = "drift-score.png";
        a.click();
      });
    };
    img.src = url;
  };

  return (
    <Card padded={false}>
      <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
          Share
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={copy}>{copied ? "Copied" : "Copy summary"}</Button>
          <Button onClick={exportPng} variant="primary">Export PNG</Button>
        </div>
      </div>
      <div
        ref={ref}
        className="p-6 bg-[var(--color-surface)]"
        style={{ width: "100%", maxWidth: 720 }}
      >
        <p className="mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
          okay.tools · Drift Score
        </p>
        <p className="mt-1 text-[14px] mono text-[var(--color-fg-muted)] truncate">
          {report.target}
        </p>
        <p className="mt-5 text-[28px] md:text-[34px] leading-tight font-semibold tracking-tight">
          {report.overBudget > 0
            ? `${report.overBudget} over baseline`
            : "Within baseline"}
        </p>
        <p className="mt-2 text-[15px] text-[var(--color-fg-muted)]">
          {report.totalDistinct} distinct values · ΔE OKLab ≤ {report.config.colorToleranceDeltaE}
        </p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { k: "textColor", label: "Greys/text" },
            { k: "fontSize", label: "Font sizes" },
            { k: "spacing", label: "Spacing" },
            { k: "boxShadow", label: "Shadows" },
          ].map(({ k, label }) => {
            const c = report.categories.find((x) => x.category === k);
            if (!c) return null;
            return (
              <div key={k} className="rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] p-3 border border-[var(--color-border)]">
                <p className="mono text-[9px] uppercase tracking-wider text-[var(--color-fg-dim)]">
                  {label}
                </p>
                <p className="text-[24px] font-semibold mt-0.5">{c.distinctCount}</p>
                <p className="mono text-[10px] text-[var(--color-fg-dim)]">
                  baseline {c.baseline.min}–{c.baseline.max}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function buildSummary(report: DriftReport): string {
  const lines: string[] = [];
  lines.push(`Drift Score — ${report.target}`);
  lines.push("");
  for (const c of report.categories) {
    lines.push(
      `${CATEGORIES[c.category].padEnd(22)}${String(c.distinctCount).padStart(3)}   baseline ${c.baseline.min}–${c.baseline.max}${c.status === "over" ? `   +${c.delta}` : ""}`
    );
  }
  lines.push("");
  lines.push(`Total distinct: ${report.totalDistinct} · Over baseline: ${report.overBudget}`);
  lines.push(`Tolerance: ΔE OKLab ≤ ${report.config.colorToleranceDeltaE} (Björn Ottosson 2020; ≈ JND on calibrated displays)`);
  lines.push(`Method: https://okay.tools/#/drift`);
  return lines.join("\n");
}
