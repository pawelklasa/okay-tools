import { useState, useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface ChecklistDef {
  id: string;
  name: string;
  description: string;
  items: string[];
}

const CHECKLISTS: ChecklistDef[] = [
  {
    id: "pre-deploy",
    name: "Pre-deploy",
    description: "Before you push to production.",
    items: [
      "Tests pass on the deploy branch.",
      "Migrations reviewed and reversible.",
      "Rollback procedure documented.",
      "On-call engineer notified.",
      "Runbook updated for new behaviour.",
      "Error budget within tolerance.",
      "No overlapping deploys in progress.",
      "Monitoring and alerts confirmed active.",
      "Second engineer has approved.",
    ],
  },
  {
    id: "pre-review",
    name: "Pre-review",
    description: "Before you review a pull request.",
    items: [
      "I have read the linked issue or ticket.",
      "I understand the scope of the change.",
      "I have pulled the branch locally if needed.",
      "Test coverage on changed code is sufficient.",
      "Migrations or schema changes are reviewed separately.",
      "I have considered the failure modes.",
      "I am reviewing with full attention, not in a hurry.",
      "I have time to do this properly right now.",
    ],
  },
  {
    id: "pre-incident-response",
    name: "Pre-incident response",
    description: "When something is breaking in production.",
    items: [
      "Page acknowledged within 5 minutes.",
      "Severity assessed (SEV1, SEV2, SEV3).",
      "Communication channel opened.",
      "Customer impact estimated.",
      "Rollback path identified.",
      "Incident commander assigned if SEV1 or SEV2.",
      "On-call escalation considered.",
      "Timeline of events being recorded.",
    ],
  },
  {
    id: "pre-launch",
    name: "Pre-launch",
    description: "Before a major feature ships to users.",
    items: [
      "User-facing communication drafted and approved.",
      "Support team briefed on the change.",
      "Documentation updated and live.",
      "Feature flag tested in production.",
      "Rollout plan defined (percentage, geography, cohort).",
      "Success metrics identified and tracked.",
      "Failure response defined.",
      "On-call coverage confirmed for launch window.",
      "Rollback decision criteria written down.",
    ],
  },
];

// ---------------------------------------------------------------------------
// localStorage
// ---------------------------------------------------------------------------

const LS_KEY = "okay-preflight-state";

type ItemState = "unchecked" | "checked" | "flagged";

interface ItemRunState {
  state: ItemState;
  note: string;
}

interface PersistedState {
  activeChecklist: string | null;
  runState: Record<number, ItemRunState>;
  startedAt: string | null;
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { activeChecklist: null, runState: {}, startedAt: null };
}

function saveState(s: PersistedState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

function playGoTone() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 440;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => ctx.close();
  } catch {
    // ignore — browser may block without user gesture
  }
}

// ---------------------------------------------------------------------------
// Derived status
// ---------------------------------------------------------------------------

type RunStatus = "GO" | "NO-GO" | "IN PROGRESS";

function getStatus(items: string[], runState: Record<number, ItemRunState>): RunStatus {
  const total = items.length;
  let checked = 0;
  for (let i = 0; i < total; i++) {
    const s = runState[i]?.state ?? "unchecked";
    if (s === "checked") checked++;
  }
  if (checked === total) return "GO";
  return "NO-GO";
}

function getStatusDuringRun(items: string[], runState: Record<number, ItemRunState>): RunStatus {
  const total = items.length;
  let checked = 0;
  let hasAnyInteraction = false;
  for (let i = 0; i < total; i++) {
    const s = runState[i]?.state ?? "unchecked";
    if (s !== "unchecked") hasAnyInteraction = true;
    if (s === "checked") checked++;
  }
  if (!hasAnyInteraction) return "IN PROGRESS";
  if (checked === total) return "GO";
  return "NO-GO";
}

// ---------------------------------------------------------------------------
// Copy summary
// ---------------------------------------------------------------------------

function buildMarkdown(
  checklist: ChecklistDef,
  runState: Record<number, ItemRunState>,
  startedAt: string | null,
): string {
  const status = getStatus(checklist.items, runState);
  const now = new Date().toISOString();
  const checked = checklist.items.filter((_, i) => runState[i]?.state === "checked");
  const flagged = checklist.items.filter((_, i) => runState[i]?.state === "flagged");
  const unchecked = checklist.items.filter((_, i) => {
    const s = runState[i]?.state ?? "unchecked";
    return s === "unchecked";
  });

  const lines: string[] = [
    `**${checklist.name} — ${status}**`,
    ``,
    `Completed: ${now}${startedAt ? `  \nStarted: ${startedAt}` : ""}`,
    ``,
    `**Checked (${checked.length}/${checklist.items.length})**`,
    ...checked.map((item) => `✓ ${item}`),
  ];

  if (unchecked.length > 0) {
    lines.push(``, `**Not completed (${unchecked.length})**`);
    lines.push(...unchecked.map((item) => `✗ ${item}`));
  }

  if (flagged.length > 0) {
    lines.push(``, `**Flagged (${flagged.length})**`);
    flagged.forEach((item, _) => {
      const idx = checklist.items.indexOf(item);
      const note = runState[idx]?.note ?? "";
      lines.push(`⚠ ${item}${note ? ` — ${note}` : ""}`);
    });
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function StatusBanner({ status }: { status: RunStatus }) {
  const cfg = {
    GO: {
      label: "GO",
      bg: "bg-[var(--color-ok)]/15",
      border: "border-[var(--color-ok)]/40",
      text: "text-[var(--color-ok)]",
      dot: "bg-[var(--color-ok)]",
    },
    "NO-GO": {
      label: "NO-GO",
      bg: "bg-[var(--color-err)]/15",
      border: "border-[var(--color-err)]/40",
      text: "text-[var(--color-err)]",
      dot: "bg-[var(--color-err)]",
    },
    "IN PROGRESS": {
      label: "IN PROGRESS",
      bg: "bg-[var(--color-warn)]/15",
      border: "border-[var(--color-warn)]/40",
      text: "text-[var(--color-warn)]",
      dot: "bg-[var(--color-warn)]",
    },
  }[status];

  return (
    <div
      className={`sticky top-0 z-10 flex items-center justify-center gap-2.5 py-2.5 border-b ${cfg.bg} ${cfg.border}`}
      style={{ backdropFilter: "blur(8px)" }}
    >
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      <span className={`mono text-[13px] font-semibold tracking-[0.12em] uppercase ${cfg.text}`}>
        {cfg.label}
      </span>
    </div>
  );
}

interface CheckItemProps {
  index: number;
  text: string;
  itemState: ItemRunState;
  onChange: (index: number, state: ItemState, note?: string) => void;
}

function CheckItem({ index, text, itemState, onChange }: CheckItemProps) {
  const state = itemState.state;
  const note = itemState.note;

  function cycle() {
    if (state === "unchecked") onChange(index, "checked");
    else if (state === "checked") onChange(index, "flagged");
    else onChange(index, "unchecked");
  }

  return (
    <div className="group">
      <div className="flex items-start gap-3 py-3 border-b border-[var(--color-border)]">
        {/* Checkbox area */}
        <button
          onClick={cycle}
          aria-label={
            state === "unchecked"
              ? "Mark as checked"
              : state === "checked"
                ? "Flag as cannot complete"
                : "Reset"
          }
          className="mt-0.5 flex-shrink-0 w-6 h-6 rounded flex items-center justify-center border transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-400)] cursor-pointer"
          style={{
            borderColor:
              state === "checked"
                ? "var(--color-ok)"
                : state === "flagged"
                  ? "var(--color-warn)"
                  : "var(--color-border-strong)",
            background:
              state === "checked"
                ? "oklch(0.78 0.16 155 / 0.15)"
                : state === "flagged"
                  ? "oklch(0.80 0.16 80 / 0.15)"
                  : "transparent",
          }}
        >
          {state === "checked" && (
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <path
                d="M1 5L4.5 8.5L11 1"
                stroke="var(--color-ok)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {state === "flagged" && (
            <span className="text-[11px] leading-none" style={{ color: "var(--color-warn)" }}>
              ⚑
            </span>
          )}
        </button>

        {/* Text */}
        <span
          className="text-[16px] leading-snug flex-1 select-none cursor-pointer"
          style={{
            color:
              state === "checked"
                ? "var(--color-fg-dim)"
                : state === "flagged"
                  ? "var(--color-warn)"
                  : "var(--color-fg)",
            textDecoration: state === "checked" ? "line-through" : "none",
          }}
          onClick={cycle}
        >
          {text}
        </span>
      </div>

      {/* Flagged note */}
      {state === "flagged" && (
        <div className="pb-2 pt-1 pl-9">
          <input
            type="text"
            value={note}
            onChange={(e) => onChange(index, "flagged", e.target.value)}
            placeholder="Why not? (optional)"
            className="w-full text-[13px] bg-transparent border-b border-[var(--color-warn)]/40 pb-1 placeholder:text-[var(--color-fg-dim)] text-[var(--color-warn)] focus:outline-none focus:border-[var(--color-warn)]"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Run View
// ---------------------------------------------------------------------------

interface ActiveRunProps {
  checklist: ChecklistDef;
  runState: Record<number, ItemRunState>;
  startedAt: string | null;
  onChange: (index: number, state: ItemState, note?: string) => void;
  onClear: () => void;
  onBack: () => void;
}

function ActiveRun({ checklist, runState, startedAt, onChange, onClear, onBack }: ActiveRunProps) {
  const [copied, setCopied] = useState(false);
  const status = getStatusDuringRun(checklist.items, runState);

  async function handleCopy() {
    const md = buildMarkdown(checklist, runState, startedAt);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = md;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleClear() {
    if (window.confirm("Clear this run and start over? This cannot be undone.")) {
      onClear();
    }
  }

  const checkedCount = checklist.items.filter((_, i) => runState[i]?.state === "checked").length;
  const total = checklist.items.length;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <StatusBanner status={status} />

      <div className="flex-1 w-full max-w-[600px] mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="pt-8 pb-6 border-b border-[var(--color-border)]">
          <button
            onClick={onBack}
            className="mono text-[11px] uppercase tracking-[0.15em] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition mb-5 flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0"
          >
            ← Back to checklists
          </button>
          <h1 className="text-[26px] font-semibold tracking-tight text-[var(--color-fg)] mb-1">
            {checklist.name}
          </h1>
          <p className="text-[14px] text-[var(--color-fg-muted)]">{checklist.description}</p>
          <p className="mono text-[12px] text-[var(--color-fg-dim)] mt-3">
            {checkedCount}/{total} items checked
            {startedAt && (
              <> · Started {new Date(startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
            )}
          </p>
        </div>

        {/* Items */}
        <div className="py-2">
          {checklist.items.map((item, i) => (
            <CheckItem
              key={i}
              index={i}
              text={item}
              itemState={runState[i] ?? { state: "unchecked", note: "" }}
              onChange={onChange}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="py-8 flex flex-wrap gap-3">
          <button
            onClick={handleCopy}
            className="px-4 py-2.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[13px] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition cursor-pointer bg-transparent"
          >
            {copied ? "Copied ✓" : "Copy summary"}
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[13px] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-err)] hover:border-[var(--color-err)]/50 transition cursor-pointer bg-transparent"
          >
            Clear run
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[13px] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition cursor-pointer bg-transparent"
          >
            Back to checklists
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Index View
// ---------------------------------------------------------------------------

interface IndexViewProps {
  onSelect: (id: string) => void;
}

function IndexView({ onSelect }: IndexViewProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Nav */}
      <header className="px-8 lg:px-16 pt-7 flex items-center gap-2.5">
        <span
          className="w-7 h-7 rounded-md"
          style={{
            background:
              "conic-gradient(from 0deg, oklch(0.72 0.18 30), oklch(0.72 0.18 110), oklch(0.72 0.18 200), oklch(0.72 0.18 290), oklch(0.72 0.18 30))",
          }}
        />
        <a
          href="/#"
          className="font-semibold tracking-tight text-[15px] hover:opacity-80 transition no-underline"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          okay<span className="text-[var(--color-fg-dim)]">.tools</span>
        </a>
      </header>

      {/* Intro */}
      <section className="px-8 lg:px-16 pt-12 pb-10 max-w-3xl">
        <p className="mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-6">
          Preflight
        </p>
        <h1 className="text-[36px] md:text-[48px] font-semibold tracking-[-0.03em] leading-[1.05] text-[var(--color-fg)] mb-4">
          Pre-flight checklists for software work.
        </h1>
        <p className="text-[16px] leading-relaxed text-[var(--color-fg-muted)] mb-3 max-w-xl">
          Aviation built a discipline around the items you cannot skip. Software has not. These are
          an attempt to start.
        </p>
        <p className="text-[15px] text-[var(--color-fg-dim)]">
          Pick a scenario. Walk through it. Cleared for takeoff, or not.
        </p>
      </section>

      {/* Cards */}
      <section className="px-8 lg:px-16 pb-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CHECKLISTS.map((cl) => (
          <button
            key={cl.id}
            onClick={() => onSelect(cl.id)}
            className="group text-left rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5 flex flex-col gap-3 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-[17px] font-semibold tracking-tight text-[var(--color-fg)] leading-snug">
                {cl.name}
              </h2>
              <span className="mono text-[11px] text-[var(--color-fg-dim)] bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">
                {cl.items.length}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--color-fg-muted)] flex-1">
              {cl.description}
            </p>
            <span className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-accent-400)] group-hover:text-[var(--color-accent-300)] transition">
              Start →
            </span>
          </button>
        ))}
      </section>

      {/* Footer */}
      <footer className="mt-auto px-8 lg:px-16 py-8 flex flex-wrap gap-x-6 gap-y-3 items-center justify-between text-xs text-[var(--color-fg-dim)] border-t border-[var(--color-border)]">
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
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function Preflight() {
  const [persisted, setPersisted] = useState<PersistedState>(() => loadState());
  const prevStatusRef = useRef<RunStatus | null>(null);

  const activeChecklist = persisted.activeChecklist
    ? CHECKLISTS.find((c) => c.id === persisted.activeChecklist) ?? null
    : null;

  // Persist on every change
  useEffect(() => {
    saveState(persisted);
  }, [persisted]);

  // Play tone when status transitions to GO
  const currentStatus = activeChecklist
    ? getStatusDuringRun(activeChecklist.items, persisted.runState)
    : null;

  useEffect(() => {
    if (
      currentStatus === "GO" &&
      prevStatusRef.current !== null &&
      prevStatusRef.current !== "GO"
    ) {
      playGoTone();
    }
    prevStatusRef.current = currentStatus;
  }, [currentStatus]);

  const handleSelect = useCallback((id: string) => {
    setPersisted((prev) => ({
      ...prev,
      activeChecklist: id,
      runState: prev.activeChecklist === id ? prev.runState : {},
      startedAt: prev.activeChecklist === id ? prev.startedAt : new Date().toISOString(),
    }));
  }, []);

  const handleChange = useCallback((index: number, state: ItemState, note?: string) => {
    setPersisted((prev) => ({
      ...prev,
      runState: {
        ...prev.runState,
        [index]: { state, note: note ?? prev.runState[index]?.note ?? "" },
      },
    }));
  }, []);

  const handleClear = useCallback(() => {
    setPersisted((prev) => ({
      ...prev,
      runState: {},
      startedAt: new Date().toISOString(),
    }));
  }, []);

  const handleBack = useCallback(() => {
    setPersisted((prev) => ({ ...prev, activeChecklist: null }));
  }, []);

  if (activeChecklist) {
    return (
      <ActiveRun
        checklist={activeChecklist}
        runState={persisted.runState}
        startedAt={persisted.startedAt}
        onChange={handleChange}
        onClear={handleClear}
        onBack={handleBack}
      />
    );
  }

  return <IndexView onSelect={handleSelect} />;
}
