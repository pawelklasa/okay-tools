import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AI_FILENAMES,
  AI_LABELS,
  STACK_LABELS,
  emitContract,
  emitCss,
  emitDtcg,
  emitShadcn,
  emitTailwind,
  generateSystem,
  summarise,
  type AiTool,
  type GeneratedSystem,
  type Stack,
} from "../lib/tokenGenerate";
import { auditTokens, detectFormat, parseTokens, type Audit } from "../lib/tokenAudit";

const SAMPLE_ANCHOR = "oklch(0.55 0.21 285)";

type TabId = "json" | "css" | "tailwind" | "shadcn" | "contract";

export function HonestTokens() {
  const [anchor, setAnchor] = useState("");
  const [secondary, setSecondary] = useState("");
  const [stack, setStack] = useState<Stack>("tailwind");
  const [ai, setAi] = useState<AiTool>("claude");
  const [submitted, setSubmitted] = useState(false);
  const [tab, setTab] = useState<TabId>("tailwind");
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => {
    if (!submitted || !anchor.trim()) return null;
    const sys = generateSystem(anchor, secondary || undefined);
    return sys;
  }, [submitted, anchor, secondary]);

  const sys: GeneratedSystem | null =
    result && !("error" in result) ? result : null;
  const error = result && "error" in result ? result.error : null;

  // When the stack changes, follow it into the matching tab (only if user
  // hasn't manually switched away mid-session).
  useEffect(() => {
    if (!submitted) return;
    const map: Record<Stack, TabId> = {
      tailwind: "tailwind",
      shadcn: "shadcn",
      css: "css",
      vue: "css",
      dtcg: "json",
    };
    setTab(map[stack]);
  }, [stack, submitted]);

  const outputs = useMemo(() => {
    if (!sys) return null;
    return {
      json: emitDtcg(sys),
      css: emitCss(sys),
      tailwind: emitTailwind(sys),
      shadcn: emitShadcn(sys),
      contract: emitContract(sys, ai),
    };
  }, [sys, ai]);

  const audit: Audit | null = useMemo(() => {
    if (!outputs) return null;
    try {
      const fmt = detectFormat(outputs.css);
      const tokens = parseTokens(outputs.css, fmt);
      return auditTokens(tokens, fmt, outputs.css);
    } catch {
      return null;
    }
  }, [outputs]);

  function handleGenerate() {
    if (!anchor.trim()) return;
    setSubmitted(true);
    // Scroll output into view on mobile.
    setTimeout(() => {
      if (window.innerWidth < 1024 && outputRef.current) {
        outputRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  }

  function copyTab() {
    if (!outputs) return;
    const text = outputs[tab];
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function downloadAll() {
    if (!outputs || !sys) return;
    const aiName = AI_FILENAMES[ai];
    const parts: string[] = [
      "# okay.tools — honest-tokens system",
      `# Anchor: ${sys.anchor.input}`,
      sys.secondary ? `# Secondary: ${sys.secondary.input}` : "",
      "",
      "## tokens.json (DTCG)",
      "",
      outputs.json,
      "",
      "## tokens.css",
      "",
      outputs.css,
      "",
      "## tailwind.css (@theme)",
      "",
      outputs.tailwind,
      "",
      "## shadcn.css",
      "",
      outputs.shadcn,
    ];
    if (aiName && outputs.contract) {
      parts.push("", `## ${aiName}`, "", outputs.contract);
    }
    const blob = new Blob([parts.filter((p) => p !== "").join("\n")], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "honest-tokens.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <header className="px-6 lg:px-12 pt-7 flex items-center justify-between gap-2.5">
        <Link
          to="/"
          className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition inline-flex items-center gap-1.5"
        >
          <span aria-hidden>←</span> okay.tools
        </Link>
        <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)]">
          honest-tokens
        </span>
      </header>

      <section className="px-6 lg:px-12 pt-12 lg:pt-16 pb-8 max-w-4xl">
        <h1 className="text-[36px] md:text-[52px] lg:text-[60px] font-semibold tracking-[-0.03em] leading-[1.04] text-[var(--color-fg)]">
          Generate honest tokens.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-fg-muted)] max-w-2xl">
          Paste a brand colour. Get a complete three-layer system — ready for your codebase, and
          ready for your AI.
        </p>
      </section>

      <section className="px-6 lg:px-12 pb-10 grid lg:grid-cols-2 gap-5 items-start">
        {/* Input column */}
        <div className="flex flex-col gap-5">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-[var(--color-border)]">
              <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
                Brand input
              </p>
            </div>

            <div className="px-5 py-5 flex flex-col gap-5">
              <ColorField
                label="Brand anchor colour"
                value={anchor}
                onChange={setAnchor}
                placeholder="#3b82f6, oklch(0.55 0.21 285), or hsl(217 91% 60%)"
                action={
                  <button
                    onClick={() => setAnchor(SAMPLE_ANCHOR)}
                    className="mono text-[10px] uppercase tracking-[0.16em] text-[#FFDD00] hover:underline underline-offset-2"
                  >
                    Use example
                  </button>
                }
              />
              <ColorField
                label="Secondary colour (optional)"
                value={secondary}
                onChange={setSecondary}
                placeholder="Leave blank for mono-brand systems"
                helper="For two-colour brands. Leave blank for mono-brand systems."
              />

              <SelectField
                label="Stack"
                value={stack}
                onChange={(v) => setStack(v as Stack)}
                options={Object.entries(STACK_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              />

              <SelectField
                label="AI tool contract"
                value={ai}
                onChange={(v) => setAi(v as AiTool)}
                options={Object.entries(AI_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              />

              <button
                onClick={handleGenerate}
                disabled={!anchor.trim()}
                className="mt-2 self-start mono text-[11px] uppercase tracking-[0.18em] font-semibold bg-[#FFDD00] text-[#0a0a0a] px-5 py-3 rounded-sm hover:brightness-110 active:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generate system →
              </button>

              {error && (
                <p className="mono text-[11px] text-[#FFDD00]">⚠ {error}</p>
              )}
            </div>
          </div>

          <WhatYoullGet />
        </div>

        {/* Output column */}
        <div ref={outputRef} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <p className="mono text-[10px] uppercase tracking-[0.18em] text-[#FFDD00]">
              The system
            </p>
            {sys && <PrimarySwatch sys={sys} />}
          </div>

          {!sys && (
            <div className="p-8 grid place-items-center text-center min-h-[420px]">
              <p className="text-[14px] text-[var(--color-fg-muted)] max-w-sm">
                Paste a brand colour and hit{" "}
                <span className="mono text-[#FFDD00]">Generate system</span> to build a complete
                three-layer system in OKLCH.
              </p>
            </div>
          )}

          {sys && outputs && (
            <>
              <AuditSummary audit={audit} sys={sys} />

              <TabStrip
                tab={tab}
                onChange={setTab}
                hasContract={ai !== "none"}
              />

              <div className="relative">
                <button
                  onClick={copyTab}
                  className="absolute top-3 right-4 mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition z-10"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <pre className="mono text-[11px] leading-relaxed text-[var(--color-fg)] bg-[var(--color-bg)] px-5 py-5 pr-20 whitespace-pre-wrap break-all max-h-[640px] overflow-auto">
                  {tab === "contract" && ai === "none"
                    ? "// Contract skipped — pick an AI tool to generate one."
                    : outputs[tab]}
                </pre>
              </div>

              <div className="px-5 py-3 border-t border-[var(--color-border)] flex items-center justify-between">
                <button
                  onClick={downloadAll}
                  className="mono text-[10px] uppercase tracking-[0.16em] text-[#FFDD00] hover:underline underline-offset-2"
                >
                  Download all →
                </button>
                <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)]">
                  honest-tokens.txt
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Cross-links */}
      <section className="px-6 lg:px-12 pb-12">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden">
          <CrossLink
            to="/tokens"
            title="Audit your existing tokens →"
            description="Already have tokens? See which ones are pretending to be semantic."
          />
          <CrossLink
            to="/color/hsl-lies"
            title="Migrate from HSL →"
            description="Convert an HSL palette to OKLCH so the maths stops lying about lightness."
          />
        </div>
      </section>

      <footer className="px-6 lg:px-12 pb-10" />
    </div>
  );
}

// ----------------------------------------------------------------------------

function ColorField({
  label,
  value,
  onChange,
  placeholder,
  helper,
  action,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helper?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
          {label}
        </label>
        {action}
      </div>
      <div className="flex items-stretch gap-3">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          className="mono text-[12px] flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-3 py-2.5 rounded-sm outline-none focus:border-[var(--color-border-strong)] placeholder:text-[var(--color-fg-dim)]"
        />
        <Swatch value={value} />
      </div>
      {helper && (
        <p className="text-[12px] text-[var(--color-fg-dim)]">{helper}</p>
      )}
    </div>
  );
}

function Swatch({ value }: { value: string }) {
  const css = value.trim() || "transparent";
  return (
    <span
      aria-hidden
      className="w-10 h-10 rounded-sm border border-[var(--color-border)] flex-shrink-0"
      style={{ background: css }}
    />
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mono text-[12px] bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-3 py-2.5 rounded-sm outline-none focus:border-[var(--color-border-strong)] appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function WhatYoullGet() {
  const rows: { label: string; desc: string }[] = [
    {
      label: "Three-layer token system",
      desc: "primitives, semantics, components.",
    },
    {
      label: "Multiple format outputs",
      desc: "copy what your stack uses.",
    },
    {
      label: "Brand contract",
      desc: "a file your AI coding tools can read.",
    },
    {
      label: "Audit summary",
      desc: "proof the system has zero costumes.",
    },
  ];
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
          What you'll get
        </p>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {rows.map(({ label, desc }) => (
          <li
            key={label}
            className="px-5 py-3 flex items-baseline gap-2 flex-wrap"
          >
            <span className="text-[14px] font-semibold tracking-tight text-[var(--color-fg)]">
              {label}
            </span>
            <span className="text-[14px] text-[var(--color-fg-muted)]">
              — {desc}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrimarySwatch({ sys }: { sys: GeneratedSystem }) {
  const anchor = sys.primitives[0]?.steps.find((s) => s.stop === 500);
  if (!anchor) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)]">
        --color-{sys.primitives[0].name}-500
      </span>
      <span
        aria-hidden
        className="w-4 h-4 rounded-sm border border-[var(--color-border)]"
        style={{ background: anchor.css }}
      />
    </div>
  );
}

function AuditSummary({
  audit,
  sys,
}: {
  audit: Audit | null;
  sys: GeneratedSystem;
}) {
  const s = summarise(sys);
  const costumes = audit?.costumeCount ?? 0;
  const polysemic = audit?.polysemicCount ?? 0;
  const namingOk = !audit?.naming;
  return (
    <div className="px-5 py-5 border-b border-[var(--color-border)]">
      <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-3">
        Audit summary
      </p>
      <ul className="flex flex-col gap-1.5">
        <CheckRow ok={costumes === 0}>
          {costumes} costume token{costumes === 1 ? "" : "s"}
        </CheckRow>
        <CheckRow ok={polysemic === 0}>
          {polysemic} polysemic token{polysemic === 1 ? "" : "s"}
        </CheckRow>
        <CheckRow ok>
          3 layers complete ({s.primitiveCount} primitives, {s.semanticCount}{" "}
          semantics, {s.componentCount} components)
        </CheckRow>
        <CheckRow ok={namingOk}>
          {namingOk
            ? "Consistent kebab-case naming"
            : "Naming drift detected"}
        </CheckRow>
      </ul>
    </div>
  );
}

function CheckRow({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-baseline gap-2 mono text-[12px]">
      <span
        className={
          ok
            ? "text-[oklch(0.78_0.16_155)]"
            : "text-[#FFDD00]"
        }
        aria-hidden
      >
        {ok ? "✓" : "⚠"}
      </span>
      <span className="text-[var(--color-fg-muted)]">{children}</span>
    </li>
  );
}

function TabStrip({
  tab,
  onChange,
  hasContract,
}: {
  tab: TabId;
  onChange: (t: TabId) => void;
  hasContract: boolean;
}) {
  const tabs: { id: TabId; label: string; dot?: boolean }[] = [
    { id: "json", label: "tokens.json" },
    { id: "css", label: "css" },
    { id: "tailwind", label: "tailwind" },
    { id: "shadcn", label: "shadcn" },
    { id: "contract", label: "contract", dot: hasContract },
  ];
  return (
    <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`mono text-[10px] uppercase tracking-[0.16em] px-4 py-3 border-r border-[var(--color-border)] last:border-r-0 transition flex items-center gap-1.5 whitespace-nowrap ${
              active
                ? "text-[var(--color-fg)] bg-[var(--color-bg)]"
                : "text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
            }`}
          >
            {t.label}
            {t.dot && (
              <span
                aria-hidden
                className="inline-block w-1.5 h-1.5 rounded-full bg-[#FFDD00]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function CrossLink({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group block px-5 py-4 md:px-8 md:py-4 hover:bg-[var(--color-surface)] transition-colors"
    >
      <div className="flex flex-row items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold tracking-tight text-[var(--color-fg)] mb-1">
            {title}
          </p>
          <p className="text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
            {description}
          </p>
        </div>
        <span className="text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)] transition text-lg self-center">
          →
        </span>
      </div>
    </Link>
  );
}
