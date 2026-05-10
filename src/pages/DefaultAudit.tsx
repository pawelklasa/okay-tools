import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  audit,
  MODE_LABELS,
  SAMPLES,
  SCORE_WEIGHTS,
  SOURCE_COLORS,
  type AuditResult,
  type Category,
  type DetectionGroup,
  type InputMode,
  type Source,
} from "../lib/defaultAudit";

const CATEGORY_ORDER: Category[] = [
  "components",
  "color tokens",
  "spacing",
  "border radius",
  "typography",
  "icons",
  "layout",
  "animation",
];

type FetchState =
  | { status: "idle" }
  | { status: "loading"; url: string }
  | { status: "ok"; url: string; bytes: number; stylesheets: number }
  | { status: "error"; url: string; message: string };

export function DefaultAudit() {
  const [mode, setMode] = useState<InputMode>("url");
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Debounce input by 300ms (only used for paste tabs).
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 300);
    return () => clearTimeout(t);
  }, [text]);

  // Auto-resize textarea
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(420, el.scrollHeight) + "px";
  }, [text, mode]);

  const isPasteMode = mode !== "url";
  const isEmpty = isPasteMode ? !text.trim() : !text.trim();

  // For paste modes: if empty, run example. For URL: only run when text is set
  // (which happens after RUN AUDIT succeeds).
  const effective = isPasteMode
    ? isEmpty
      ? SAMPLES[mode]
      : debounced
    : text;

  const result: AuditResult = useMemo(() => audit(effective), [effective]);

  function reset() {
    setText("");
    setUrlInput("");
    setFetchState({ status: "idle" });
  }

  async function runUrlAudit() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    let url = trimmed;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setFetchState({ status: "loading", url });
    setText("");
    try {
      const r = await fetch(`/api/fetch-url?url=${encodeURIComponent(url)}`);
      const data = await r.json();
      if (!r.ok || data.error) {
        setFetchState({
          status: "error",
          url,
          message: data.error || `request failed (${r.status})`,
        });
        return;
      }
      const blob = `${data.html ?? ""}\n\n${data.css ?? ""}`;
      setText(blob);
      setFetchState({
        status: "ok",
        url: data.url || url,
        bytes: blob.length,
        stylesheets: Array.isArray(data.stylesheets) ? data.stylesheets.length : 0,
      });
    } catch (err) {
      setFetchState({
        status: "error",
        url,
        message: err instanceof Error ? err.message : "network error",
      });
    }
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
          default-audit
        </span>
      </header>

      <section className="px-6 lg:px-12 pt-12 lg:pt-16 pb-8 max-w-4xl">
        <h1 className="text-[36px] md:text-[52px] lg:text-[60px] font-semibold tracking-[-0.03em] leading-[1.04] text-[var(--color-fg)]">
          Your stack is showing.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-fg-muted)] max-w-2xl">
          Paste a URL, CSS, JSX, or a string of class names. See which AI-era
          defaults are in your code. No judgement. Just observation.
        </p>
      </section>

      <section className="px-6 lg:px-12 pb-10 grid lg:grid-cols-[1fr_1.2fr] gap-5 items-start">
        {/* Left: input + side panels */}
        <div className="flex flex-col gap-5">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden flex flex-col">
            {/* Tabs */}
            <div className="px-2 pt-2 pb-0 border-b border-[var(--color-border)] flex items-center gap-1 overflow-x-auto">
              {(Object.keys(MODE_LABELS) as InputMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`mono text-[10px] uppercase tracking-[0.16em] px-3 py-2 rounded-t-md transition whitespace-nowrap ${
                    mode === m
                      ? "bg-[var(--color-bg)] text-[var(--color-fg)]"
                      : "text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>

            <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
                {mode === "url"
                  ? fetchState.status === "ok"
                    ? "Fetched"
                    : "Audit a live URL"
                  : isEmpty
                    ? "Example input"
                    : "Your input"}
              </p>
              <div className="flex items-center gap-3">
                {mode !== "url" && (
                  <button
                    onClick={() => setText(SAMPLES[mode])}
                    className="mono text-[10px] uppercase tracking-[0.16em] text-[#FFDD00] hover:underline underline-offset-2"
                  >
                    Load example
                  </button>
                )}
                <button
                  onClick={reset}
                  className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition"
                >
                  Clear
                </button>
              </div>
            </div>

            {mode === "url" ? (
              <UrlPanel
                value={urlInput}
                onChange={setUrlInput}
                onRun={runUrlAudit}
                state={fetchState}
              />
            ) : (
              <div className="relative flex-1 flex">
                <textarea
                  ref={taRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={placeholderFor(mode)}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  autoComplete="off"
                  data-gramm="false"
                  data-gramm_editor="false"
                  data-enable-grammarly="false"
                  data-lt-active="false"
                  className="mono text-[12px] leading-relaxed bg-[var(--color-bg)] text-[var(--color-fg)] p-5 outline-none resize-none w-full overflow-hidden placeholder:text-[var(--color-fg-dim)]"
                />
              </div>
            )}

            {result.isImage && (
              <div className="px-5 py-3 border-t border-[var(--color-border)] mono text-[11px] text-[#FFDD00]">
                ⚠ This tool only reads pasted text, not images.
              </div>
            )}
            {result.truncated && (
              <div className="px-5 py-3 border-t border-[var(--color-border)] mono text-[11px] text-[#FFDD00]">
                ⚠ Input over 2MB — truncated for analysis.
              </div>
            )}
          </div>

          <WhatThisDetects />
          <WhyItMatters />
        </div>

        {/* Right: results */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <p className="mono text-[10px] uppercase tracking-[0.18em] text-[#FFDD00]">
              {mode === "url" && fetchState.status !== "ok"
                ? "The reveal"
                : isPasteMode && isEmpty
                  ? "Example reveal"
                  : "The reveal"}
            </p>
            <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)]">
              {result.groups.length} categor
              {result.groups.length === 1 ? "y" : "ies"} fired
            </span>
          </div>

          <ScorePanel result={result} />

          {mode === "url" && fetchState.status === "loading" && (
            <div className="px-5 py-8 text-center">
              <p className="text-[14px] text-[var(--color-fg-muted)]">
                Fetching {fetchState.url}…
              </p>
            </div>
          )}

          {mode === "url" && fetchState.status === "idle" && !text && (
            <div className="px-5 py-8 text-center">
              <p className="text-[14px] text-[var(--color-fg-muted)]">
                Enter a URL and run the audit to see what defaults are in the live page.
              </p>
            </div>
          )}

          <div className="flex flex-col">
            {CATEGORY_ORDER.map((cat) => {
              const fs = result.byCategory[cat];
              if (!fs || fs.length === 0) return null;
              return <CategoryBlock key={cat} category={cat} groups={fs} />;
            })}
            {result.groups.length === 0 &&
              !(mode === "url" && fetchState.status !== "ok") && (
                <div className="px-5 py-8 text-center">
                  <p className="text-[14px] text-[var(--color-fg-muted)]">
                    No AI-era defaults detected in this input.
                  </p>
                </div>
              )}
          </div>
        </div>
      </section>

      {/* Article CTA */}
      <section className="px-6 lg:px-12 pb-12">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 md:px-8 md:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="mono text-[10px] uppercase tracking-[0.18em] text-[#FFDD00] mb-1.5">
              Read the article
            </p>
            <p className="text-[15px] leading-relaxed text-[var(--color-fg)]">
              <span className="font-semibold tracking-tight">
                The default design system of the AI era.
              </span>{" "}
              <span className="text-[var(--color-fg-muted)]">
                Why every AI-built UI looks the same.
              </span>
            </p>
          </div>
          <a
            href="#"
            className="inline-flex items-center gap-2 mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition"
          >
            Read it <span aria-hidden>→</span>
          </a>
        </div>
      </section>

      <footer className="mt-auto px-6 lg:px-12 py-8 flex flex-wrap gap-x-6 gap-y-3 items-center justify-between text-xs text-[var(--color-fg-dim)] border-t border-[var(--color-border)]">
        <p>
          Built by{" "}
          <a
            href="https://pavka.design/"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Pawel Klasa
          </a>
          .
        </p>
        <div className="flex gap-5">
          <a
            href="https://github.com/pawelklasa/okay-tools"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--color-fg)]"
          >
            GitHub
          </a>
          <a
            href="https://buy.stripe.com/5kQ6oJ6Qebt63GN9G71wY00"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--color-fg)]"
          >
            Tip
          </a>
        </div>
        <p className="mono">v0.1 · MIT</p>
      </footer>
    </div>
  );
}

// ----------------------------------------------------------------------------

function placeholderFor(mode: InputMode): string {
  switch (mode) {
    case "url":
      return "https://example.com";
    case "css":
      return "Paste a globals.css, tailwind.config.js, or tokens.css";
    case "jsx":
      return "Paste a component or a full page's HTML/JSX markup";
    case "classes":
      return "Paste a single line of Tailwind class names";
  }
}

function UrlPanel({
  value,
  onChange,
  onRun,
  state,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  state: FetchState;
}) {
  const loading = state.status === "loading";
  return (
    <div className="px-5 py-5 flex flex-col gap-3 bg-[var(--color-bg)]">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRun();
          }}
          placeholder="https://example.com"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          className="mono text-[13px] flex-1 min-w-0"
        />
        <button
          onClick={onRun}
          disabled={loading || !value.trim()}
          className="mono text-[11px] uppercase tracking-[0.16em] font-semibold px-4 py-2.5 rounded-md bg-[#FFDD00] text-[#1a1a1a] hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? "Running…" : "Run audit"}
        </button>
      </div>
      <p className="mono text-[11px] leading-relaxed text-[var(--color-fg-dim)]">
        Tries to fetch the page server-side, plus up to 5 linked stylesheets,
        and runs detection on the combined source.
      </p>

      {state.status === "ok" && (
        <p className="mono text-[11px] text-[oklch(0.78_0.16_155)]">
          ✓ {(state.bytes / 1024).toFixed(1)}KB fetched · {state.stylesheets} stylesheet
          {state.stylesheets === 1 ? "" : "s"}
        </p>
      )}
      {state.status === "error" && (
        <p className="mono text-[11px] text-[#FFDD00]">⚠ {state.message}</p>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {["linear.app", "vercel.com", "cal.com", "resend.com"].map((host) => (
          <button
            key={host}
            onClick={() => onChange(`https://${host}`)}
            className="mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition"
          >
            {host}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScorePanel({ result }: { result: AuditResult }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const score = result.score;
  const tone = "text-[#FFDD00]";
  const meterColor = "#FFDD00";

  return (
    <div className="px-5 py-7 border-b border-[var(--color-border)]">
      <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-3">
        Default density
      </p>
      <div className="flex items-baseline gap-3 mb-4">
        <span
          className={`text-[88px] md:text-[104px] font-semibold tracking-[-0.03em] leading-none ${tone}`}
        >
          {score}
        </span>
        <span className="mono text-[13px] text-[var(--color-fg-dim)]">/ 100</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: meterColor }}
        />
      </div>
      <p className="text-[14px] leading-relaxed text-[var(--color-fg-muted)] mb-3">
        {result.scoreLabel}
      </p>
      <button
        onClick={() => setShowBreakdown((s) => !s)}
        className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition inline-flex items-center gap-1"
      >
        {showBreakdown ? "Hide" : "How this is calculated"}{" "}
        <span aria-hidden>{showBreakdown ? "▴" : "▾"}</span>
      </button>
      {showBreakdown && (
        <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          {result.scoreBreakdown.length === 0 ? (
            <p className="mono text-[11px] text-[var(--color-fg-muted)]">
              No weighted detections fired.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 mb-2">
              {result.scoreBreakdown.map((b) => (
                <li
                  key={b.key}
                  className="flex items-baseline justify-between gap-3 mono text-[11px]"
                >
                  <span className="text-[var(--color-fg)] flex-1 truncate">
                    {b.name}{" "}
                    <span className="text-[var(--color-fg-dim)]">
                      ×{b.count}
                      {b.multiplier < 1 && ` · ${Math.round(b.multiplier * 100)}%`}
                    </span>
                  </span>
                  <span className="text-[#FFDD00] tabular-nums">+{b.applied}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-[var(--color-border)] pt-2 flex items-baseline justify-between mono text-[11px]">
            <span className="text-[var(--color-fg-dim)] uppercase tracking-[0.16em]">
              Total (capped at 100)
            </span>
            <span className="text-[var(--color-fg)] font-semibold">{score}</span>
          </div>
          <details className="mt-3">
            <summary className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)] cursor-pointer hover:text-[var(--color-fg)]">
              All weights
            </summary>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(SCORE_WEIGHTS).map(([k, w]) => (
                <li
                  key={k}
                  className="flex items-baseline justify-between mono text-[10.5px] text-[var(--color-fg-muted)]"
                >
                  <span>{k}</span>
                  <span>+{w}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}

function CategoryBlock({
  category,
  groups,
}: {
  category: Category;
  groups: DetectionGroup[];
}) {
  return (
    <div className="px-5 py-5 border-b border-[var(--color-border)] last:border-b-0 flex flex-col gap-4">
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-[#FFDD00]">
          {category}
        </p>
        <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)]">
          {groups.length} detection{groups.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="flex flex-col gap-5">
        {groups.map((g) => (
          <GroupRow key={g.key} group={g} />
        ))}
      </ul>
    </div>
  );
}

function GroupRow({ group }: { group: DetectionGroup }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const itemsLine = group.items.length > 0 ? group.items.join(", ") : null;

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[14px] font-semibold tracking-tight text-[var(--color-fg)]">
          {group.name}
        </span>
        {group.note && (
          <span className="mono text-[10.5px] text-[var(--color-fg-dim)]">
            {group.note}
          </span>
        )}
        <SourceTag source={group.source} />
        <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)]">
          {group.evidence.length} detected
        </span>
      </div>
      {itemsLine && (
        <p className="mono text-[12px] leading-relaxed text-[var(--color-fg)] break-words">
          {itemsLine}
        </p>
      )}
      <p className="mono text-[11px] leading-snug text-[var(--color-fg-dim)]">
        // reached for by: {group.reachedFor}
      </p>
      {group.evidence.length > 0 && (
        <>
          <button
            onClick={() => setShowEvidence((s) => !s)}
            className="self-start mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition inline-flex items-center gap-1"
          >
            {showEvidence ? "Hide evidence" : "Show evidence"}{" "}
            <span aria-hidden>{showEvidence ? "▴" : "▾"}</span>
          </button>
          {showEvidence && (
            <pre className="mono text-[11.5px] leading-relaxed text-[var(--color-fg)] bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 rounded-sm whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
              {group.evidence
                .map(
                  (e) =>
                    `L${String(e.line).padStart(4, " ")}  ${truncate(e.text, 240)}`
                )
                .join("\n")}
            </pre>
          )}
        </>
      )}
    </li>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}

function SourceTag({ source }: { source: Source }) {
  return (
    <span
      className="mono text-[9.5px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-sm"
      style={{
        color: SOURCE_COLORS[source],
        background: "color-mix(in oklab, currentColor 12%, transparent)",
      }}
    >
      {source}
    </span>
  );
}

// ----------------------------------------------------------------------------

function WhatThisDetects() {
  const rows: { label: string; example: string }[] = [
    { label: "Component patterns", example: "cn() from @/lib/utils, cva, Radix primitives" },
    { label: "Color tokens", example: "--background, --primary, --muted-foreground" },
    { label: "Spacing scale", example: "p-4, gap-6, px-8 — Tailwind's 4px base" },
    { label: "Border radius", example: "rounded-md, rounded-lg, --radius" },
    { label: "Typography", example: "Inter, Geist, tracking-tight, text-sm" },
    { label: "Icons", example: "lucide-react, @radix-ui/react-icons" },
    { label: "Layout patterns", example: "max-w-7xl mx-auto, sticky top-0 backdrop-blur" },
    { label: "Animation", example: "tailwindcss-animate, accordion-down" },
  ];
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
          What this detects
        </p>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {rows.map(({ label, example }) => (
          <li key={label} className="px-5 py-3">
            <p className="text-[14px] font-semibold tracking-tight text-[var(--color-fg)] mb-0.5">
              {label}
            </p>
            <p className="mono text-[11px] leading-snug text-[var(--color-fg-muted)]">
              {example}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WhyItMatters() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
          Why it matters
        </p>
      </div>
      <div className="px-5 py-4 space-y-4 text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
        <p>
          Defaults are not bad. Defaults that you did not choose are worth
          knowing about.
        </p>
        <p>
          AI tools reach for the same defaults because they were trained on
          the same code. The result is convergence.
        </p>
        <p>
          This tool tells you which defaults are in your code. What you do
          with that is your call.
        </p>
      </div>
    </div>
  );
}
