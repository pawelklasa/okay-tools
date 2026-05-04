import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  auditTokens,
  detectFormat,
  generateDraftSystem,
  parseTokens,
  SAMPLE_JSON,
  type Audit,
  type Format,
} from "../lib/tokenAudit";

export function TokenCostumes() {
  const [text, setText] = useState("");
  const [showDraft, setShowDraft] = useState(false);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => audit(text), [text]);

  const draft = useMemo(
    () => (result.audit ? generateDraftSystem(result.audit) : ""),
    [result.audit]
  );

  function copyDraft() {
    if (!draft) return;
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
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
          token-costumes
        </span>
      </header>

      <section className="px-6 lg:px-12 pt-12 lg:pt-16 pb-8 max-w-4xl">
        <p className="mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-5">
          token-costumes
        </p>
        <h1 className="text-[36px] md:text-[52px] lg:text-[60px] font-semibold tracking-[-0.03em] leading-[1.04] text-[var(--color-fg)]">
          Your tokens are wearing costumes.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-fg-muted)] max-w-2xl">
          Paste a tokens.json or CSS variables block. See what's pretending to be semantic.
        </p>
      </section>

      <section className="px-6 lg:px-12 pb-10 grid lg:grid-cols-2 gap-5 items-start">
        {/* Input */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
            <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
              Paste tokens
            </p>
            <div className="flex items-center gap-3">
              <FormatBadge format={result.format} />
              <button
                onClick={() => setText(SAMPLE_JSON)}
                className="mono text-[10px] uppercase tracking-[0.16em] text-[#FFDD00] hover:underline underline-offset-2"
              >
                Load example
              </button>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Paste tokens.json with $value/$type, a CSS :root { --color-... } block, or a Tailwind colors object.`}
            spellCheck={false}
            className="mono text-[12px] leading-relaxed bg-[var(--color-bg)] text-[var(--color-fg)] p-5 outline-none resize-none min-h-[420px] flex-1 placeholder:text-[var(--color-fg-dim)]"
          />
          {result.error && (
            <div className="px-5 py-3 border-t border-[var(--color-border)] mono text-[11px] text-[#FFDD00]">
              ⚠ {result.error}
            </div>
          )}
        </div>

        {/* Reveal */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <p className="mono text-[10px] uppercase tracking-[0.18em] text-[#FFDD00]">
              The reveal
            </p>
            {result.audit && <Verdict verdict={result.audit.verdict} />}
          </div>

          {!result.audit && (
            <div className="p-8 flex-1 grid place-items-center text-center">
              <p className="text-[14px] text-[var(--color-fg-muted)] max-w-sm">
                Paste tokens, or hit{" "}
                <span className="mono text-[#FFDD00]">Load example</span> to see a deliberately
                broken file get audited.
              </p>
            </div>
          )}

          {result.audit && (
            <RevealBody
              audit={result.audit}
              draft={draft}
              showDraft={showDraft}
              onToggleDraft={() => setShowDraft((s) => !s)}
              onCopy={copyDraft}
              copied={copied}
            />
          )}
        </div>
      </section>

      {/* Cross-links */}
      <section className="px-6 lg:px-12 pb-12">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden">
          <CrossLink
            to="/color/palette"
            title="Generate primitives in OKLCH"
            description="Build a perceptually-even hue ramp to use as your primitive layer."
          />
          <CrossLink
            to="/forms"
            title="Audit form validation"
            description="See how validation timing punishes users mid-typing — and what to do instead."
          />
        </div>
      </section>

      <footer className="px-6 lg:px-12 pb-10 mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)]">
        okay.tools · token-costumes
      </footer>
    </div>
  );
}

// ----------------------------------------------------------------------------

type Result =
  | { format: Format; audit: null; error: string | null }
  | { format: Format; audit: Audit; error: null };

function audit(text: string): Result {
  if (!text.trim()) return { format: "unknown", audit: null, error: null };
  const format = detectFormat(text);
  if (format === "unknown") {
    return {
      format,
      audit: null,
      error: "Couldn't recognise this as JSON tokens, CSS variables, or a Tailwind colors object.",
    };
  }
  try {
    const tokens = parseTokens(text, format);
    if (tokens.length === 0) {
      return { format, audit: null, error: "No tokens found in the input." };
    }
    const a = auditTokens(tokens, format, text);
    return { format, audit: a, error: null };
  } catch (e) {
    return {
      format,
      audit: null,
      error: e instanceof Error ? `Parse failed: ${e.message}` : "Parse failed.",
    };
  }
}

function FormatBadge({ format }: { format: Format }) {
  if (format === "unknown") return null;
  const label = format === "json" ? "JSON" : format === "css" ? "CSS" : "Tailwind";
  return (
    <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)]">
      detected: <span className="text-[var(--color-fg-muted)]">{label}</span>
    </span>
  );
}

function Verdict({ verdict }: { verdict: Audit["verdict"] }) {
  const tone =
    verdict === "HEALTHY"
      ? "text-[oklch(0.78_0.16_155)]"
      : verdict === "DRIFT-PRONE"
        ? "text-[var(--color-fg-muted)]"
        : "text-[#FFDD00]";
  return (
    <span className={`mono text-[10px] uppercase tracking-[0.18em] font-semibold ${tone}`}>
      {verdict}
    </span>
  );
}

// ----------------------------------------------------------------------------

function RevealBody({
  audit,
  draft,
  showDraft,
  onToggleDraft,
  onCopy,
  copied,
}: {
  audit: Audit;
  draft: string;
  showDraft: boolean;
  onToggleDraft: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex flex-col">
      {/* Two metric tiles */}
      <div className="grid grid-cols-2 border-b border-[var(--color-border)]">
        <Metric label="Costume tokens" value={audit.costumeCount} />
        <Metric label="Polysemic tokens" value={audit.polysemicCount} bordered />
      </div>

      {/* Layer audit */}
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-3">
          Layers
        </p>
        <LayerRow
          ok={audit.layers.primitive > 0}
          name="Primitive"
          detail={`${audit.layers.primitive} token${audit.layers.primitive === 1 ? "" : "s"}`}
        />
        <LayerRow
          ok={audit.layers.semantic > 0 && !audit.layers.fakeSemantic}
          name="Semantic"
          detail={
            audit.layers.fakeSemantic
              ? "fake — semantic names defined as primitives"
              : audit.layers.semantic > 0
                ? `${audit.layers.semantic} alias${audit.layers.semantic === 1 ? "" : "es"}`
                : "missing"
          }
          comment={
            audit.layers.semantic === 0
              ? "// AI tools will hallucinate this for you"
              : undefined
          }
        />
        <LayerRow
          ok={audit.layers.component > 0}
          name="Component"
          detail={
            audit.layers.component > 0
              ? `${audit.layers.component} token${audit.layers.component === 1 ? "" : "s"}`
              : "missing"
          }
          comment={
            audit.layers.component === 0
              ? "// add as components grow — don't pre-build"
              : undefined
          }
        />
      </div>

      {/* Findings */}
      <div className="px-5 py-5 border-b border-[var(--color-border)] flex flex-col gap-5">
        {audit.costumes.length > 0 && (
          <FindingGroup
            label="Primitive in costume"
            items={audit.costumes.map((c) => ({
              code: `${c.token.cssName}: ${c.token.value}`,
              comment: `// ${c.reason}`,
            }))}
          />
        )}

        {audit.polysemic.length > 0 && (
          <FindingGroup
            label="Polysemic"
            items={audit.polysemic.map((p) => ({
              code: p.token.cssName,
              comment: `// ${p.reason}`,
            }))}
          />
        )}

        {audit.naming && (
          <FindingGroup
            label="Naming drift"
            items={[
              {
                code: audit.naming.tokens
                  .slice(0, 3)
                  .map((t) => t.cssName)
                  .join(", "),
                comment: `// mixed conventions in the same file: ${audit.naming.conventions.join(
                  ", "
                )}`,
              },
            ]}
          />
        )}

        {audit.orphans.length > 0 && (
          <FindingGroup
            label="Orphan"
            tone="muted"
            items={audit.orphans.map((o) => ({
              code: o.token.cssName,
              comment: "// declared but never referenced",
            }))}
          />
        )}

        {audit.findings.length === 0 && (
          <p className="text-[14px] text-[var(--color-fg-muted)]">
            No drift detected. The tokens are doing what their names say.
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="px-5 py-5 flex flex-col gap-3">
        <button
          onClick={onCopy}
          disabled={!draft}
          className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#FFDD00] text-[#1a1a1a] mono text-[12px] uppercase tracking-[0.14em] font-semibold hover:brightness-110 transition disabled:opacity-40"
        >
          {copied ? "Copied" : "Copy fixed system"} <span aria-hidden>→</span>
        </button>
        <button
          onClick={onToggleDraft}
          className="self-start mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition"
        >
          {showDraft ? "Hide preview" : "Preview what gets copied"}
        </button>
        {showDraft && (
          <pre className="mono text-[11px] leading-relaxed bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md p-4 overflow-x-auto whitespace-pre-wrap break-all text-[var(--color-fg)]">
{draft}
          </pre>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  bordered,
}: {
  label: string;
  value: number;
  bordered?: boolean;
}) {
  const warn = value > 0;
  return (
    <div className={`px-5 py-5 ${bordered ? "border-l border-[var(--color-border)]" : ""}`}>
      <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-1.5">
        {label}
      </p>
      <p
        className={`text-[36px] font-semibold tracking-tight leading-none ${
          warn ? "text-[#FFDD00]" : "text-[var(--color-fg)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function LayerRow({
  ok,
  name,
  detail,
  comment,
}: {
  ok: boolean;
  name: string;
  detail: string;
  comment?: string;
}) {
  return (
    <div className="py-1.5 first:pt-0 last:pb-0">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className={`mono text-[12px] ${
            ok ? "text-[oklch(0.78_0.16_155)]" : "text-[#FFDD00]"
          }`}
          aria-hidden
        >
          {ok ? "✓" : "✗"}
        </span>
        <span className="mono text-[12px] text-[var(--color-fg)]">{name} layer:</span>
        <span className="mono text-[12px] text-[var(--color-fg-muted)]">{detail}</span>
      </div>
      {comment && (
        <p className="mono text-[11px] text-[var(--color-fg-dim)] pl-5 mt-0.5">{comment}</p>
      )}
    </div>
  );
}

function FindingGroup({
  label,
  items,
  tone = "warn",
}: {
  label: string;
  items: { code: string; comment: string }[];
  tone?: "warn" | "muted";
}) {
  const labelTone = tone === "warn" ? "text-[#FFDD00]" : "text-[var(--color-fg-dim)]";
  return (
    <div className="flex flex-col gap-3">
      <p className={`mono text-[10px] uppercase tracking-[0.18em] ${labelTone}`}>{label}</p>
      <div className="flex flex-col gap-3">
        {items.map((it, i) => (
          <div key={i} className="flex flex-col gap-1">
            <code className="mono text-[12px] leading-snug text-[var(--color-fg)] bg-[var(--color-surface-2)] px-2.5 py-1.5 rounded-sm break-all self-start max-w-full">
              {it.code}
            </code>
            <p className="mono text-[11px] leading-snug text-[var(--color-fg-dim)]">
              {it.comment}
            </p>
          </div>
        ))}
      </div>
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
          <p className="text-[13px] leading-relaxed text-[var(--color-fg-muted)]">{description}</p>
        </div>
        <span className="text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)] transition text-lg self-center">
          →
        </span>
      </div>
    </Link>
  );
}
