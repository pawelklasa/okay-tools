import { useEffect, useMemo, useRef, useState } from "react";
import { EmailCapture } from "../../components/EmailCapture";

// ---------------------------------------------------------------------------
// form-hostility — Validation timing playground
// ---------------------------------------------------------------------------

type Strategy = "eager" | "lazy" | "blur" | "smart";
type FieldKey = "email" | "password" | "confirm" | "username" | "card";
type FieldValues = Record<FieldKey, string>;
type FieldFlags = Record<FieldKey, boolean>;
type FieldError = { field: FieldKey; message: string };

type Metrics = {
  keystrokes: number;
  blurs: number;
  submitAttempts: number;
  firstErrorMs: number | null;
  errorsShown: number;
  errorsVanishedWhileTyping: number;
  punishedForTyping: number;
  errorsAtSubmit: number;
};

const STRATEGIES: { id: Strategy; label: string; tagline: string }[] = [
  { id: "eager", label: "Eager", tagline: "Validate every keystroke" },
  { id: "lazy", label: "Lazy", tagline: "Validate only on submit" },
  { id: "blur", label: "On-blur", tagline: "Validate when you leave a field" },
  { id: "smart", label: "Smart", tagline: "Right rule, right moment, per field" },
];

const FIELD_LABELS: Record<FieldKey, string> = {
  email: "Email",
  password: "Password",
  confirm: "Confirm password",
  username: "Username",
  card: "Card number",
};

// --- Validators --------------------------------------------------------------

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const usernameRe = /^[a-z0-9_]{3,20}$/i;
const TAKEN_USERNAMES = new Set(["admin", "root", "paw", "test", "user"]);

function validateEmail(v: string): string | null {
  if (!v) return "Email is required";
  if (!emailRe.test(v)) return "That doesn't look like an email";
  return null;
}

function validatePassword(v: string): string | null {
  if (!v) return "Password is required";
  if (v.length < 8) return `${8 - v.length} more character${8 - v.length === 1 ? "" : "s"}`;
  if (!/[a-zA-Z]/.test(v)) return "Add a letter";
  if (!/[0-9]/.test(v)) return "Add a number";
  return null;
}

function passwordProgress(v: string) {
  const length = Math.min(1, v.length / 8);
  const hasLetter = /[a-zA-Z]/.test(v);
  const hasNumber = /[0-9]/.test(v);
  const score = (length + (hasLetter ? 1 : 0) + (hasNumber ? 1 : 0)) / 3;
  return { length, hasLetter, hasNumber, score };
}

function validateConfirm(v: string, pw: string): string | null {
  if (!v) return "Please confirm";
  if (v !== pw) return "Doesn't match";
  return null;
}

function validateUsername(v: string): string | null {
  if (!v) return "Username is required";
  if (!usernameRe.test(v)) return "Letters, numbers, underscore. 3–20 chars.";
  return null;
}

function luhn(n: string) {
  const digits = n.replace(/\D/g, "");
  if (digits.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function formatCard(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function validateCard(v: string): string | null {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "Card number is required";
  if (digits.length < 13) return "Too short for a card number";
  if (!luhn(v)) return "Doesn't pass Luhn check";
  return null;
}

// --- Page --------------------------------------------------------------------

export function FormPlayground() {
  const [strategy, setStrategy] = useState<Strategy>("eager");
  const [values, setValues] = useState<FieldValues>(emptyValues());
  const [touched, setTouched] = useState<FieldFlags>(emptyFlags());
  const [submitted, setSubmitted] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "ok" | "taken"
  >("idle");

  // Metrics for current strategy
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  // Persisted snapshots per strategy (for comparison chart)
  const [history, setHistory] = useState<Partial<Record<Strategy, Metrics>>>({});

  // Visual hostility cues
  const [shakingField, setShakingField] = useState<FieldKey | null>(null);
  const [flashMetric, setFlashMetric] = useState(false);
  const [judderField, setJudderField] = useState<FieldKey | null>(null);

  const startedAt = useRef<number>(Date.now());
  const lastErrorState = useRef<Set<FieldKey>>(new Set());
  const skipNextDiff = useRef(false);
  const prevSubmittedRef = useRef(false);
  const demoTimers = useRef<number[]>([]);
  const [demoRunning, setDemoRunning] = useState(false);

  // Live ref that always holds the latest committed metrics. Used for an
  // accurate, race-free snapshot at the exact moment of strategy switch.
  const liveMetricsRef = useRef<Metrics>(metrics);
  liveMetricsRef.current = metrics;

  // Switch strategy AND snapshot the outgoing strategy's metrics in one go.
  // Doing this in the click handler (rather than a useEffect) avoids the
  // closure-stale-metrics problem that was leaking previous strategies'
  // numbers into the new strategy's history slot.
  const switchStrategy = (next: Strategy) => {
    if (next === strategy) return;
    setHistory((h) => ({ ...h, [strategy]: liveMetricsRef.current }));
    setStrategy(next);
  };

  // On strategy change: reset interaction state only. History was already
  // snapshotted by switchStrategy above.
  useEffect(() => {
    setTouched(emptyFlags());
    setSubmitted(false);
    setMetrics(emptyMetrics());
    startedAt.current = Date.now();
    lastErrorState.current = new Set();
    // The next render still carries closure values from the previous strategy
    // (touched/submitted/values haven't applied yet). Skip one diff cycle so
    // those leftover errors don't get attributed to the new strategy.
    skipNextDiff.current = true;
    setUsernameStatus("idle");
    cancelDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy]);

  // Async username availability check. Runs for ALL strategies so the
  // comparison is fair (same input, same data). What differs is *when* each
  // strategy surfaces the result — see computeVisibleErrors.
  useEffect(() => {
    if (!values.username) {
      setUsernameStatus("idle");
      return;
    }
    if (validateUsername(values.username)) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    const t = window.setTimeout(() => {
      setUsernameStatus(
        TAKEN_USERNAMES.has(values.username.toLowerCase()) ? "taken" : "ok"
      );
    }, 350);
    return () => window.clearTimeout(t);
  }, [values.username]);

  const errors = useMemo(
    () => computeVisibleErrors({ strategy, values, touched, submitted, usernameStatus }),
    [strategy, values, touched, submitted, usernameStatus]
  );

  const errorMap = useMemo(() => {
    const m = new Map<FieldKey, FieldError>();
    for (const e of errors) m.set(e.field, e);
    return m;
  }, [errors]);

  // Track error transitions and trigger visceral cues
  useEffect(() => {
    const currentErrFields = new Set(errors.map((e) => e.field));

    if (skipNextDiff.current) {
      // Strategy just changed; absorb the in-between render without crediting
      // any of its errors to the new strategy.
      lastErrorState.current = currentErrFields;
      skipNextDiff.current = false;
      prevSubmittedRef.current = submitted;
      return;
    }

    // Detect the moment submitted flips on — record how many errors the user
    // sees at that instant. This is Lazy's signature pain.
    if (submitted && !prevSubmittedRef.current) {
      const revealed = currentErrFields.size;
      if (revealed > 0) {
        setMetrics((m) => ({ ...m, errorsAtSubmit: m.errorsAtSubmit + revealed }));
      }
    }
    prevSubmittedRef.current = submitted;

    const prev = lastErrorState.current;

    let newlyAppeared = 0;
    let vanishedWhileTyping = 0;
    let punished = 0;
    let punishedField: FieldKey | null = null;
    let vanishedField: FieldKey | null = null;

    for (const f of currentErrFields) {
      if (!prev.has(f)) {
        newlyAppeared++;
        // Punished = error appeared while user is mid-typing (has content, not blurred, not submitted)
        if (values[f] && !touched[f] && !submitted) {
          punished++;
          punishedField = f;
        }
      }
    }
    for (const f of prev) {
      if (!currentErrFields.has(f)) {
        if (!submitted) {
          vanishedWhileTyping++;
          vanishedField = f;
        }
      }
    }

    if (newlyAppeared || vanishedWhileTyping) {
      setMetrics((m) => ({
        ...m,
        errorsShown: m.errorsShown + newlyAppeared,
        errorsVanishedWhileTyping: m.errorsVanishedWhileTyping + vanishedWhileTyping,
        punishedForTyping: m.punishedForTyping + punished,
        firstErrorMs:
          m.firstErrorMs ?? (newlyAppeared > 0 ? Date.now() - startedAt.current : null),
      }));

      // Visceral cues
      if (punishedField) {
        const f = punishedField;
        setShakingField(f);
        window.setTimeout(() => setShakingField((s) => (s === f ? null : s)), 380);
        setFlashMetric(true);
        window.setTimeout(() => setFlashMetric(false), 800);
      }
      if (vanishedField) {
        const f = vanishedField;
        setJudderField(f);
        window.setTimeout(() => setJudderField((j) => (j === f ? null : j)), 340);
      }
    }

    lastErrorState.current = currentErrFields;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors]);

  const onChange = (field: FieldKey) => (raw: string) => {
    const next = field === "card" ? formatCard(raw) : raw;
    setValues((v) => ({ ...v, [field]: next }));
    setMetrics((m) => ({ ...m, keystrokes: m.keystrokes + 1 }));
  };

  const onBlur = (field: FieldKey) => () => {
    setTouched((t) => ({ ...t, [field]: true }));
    setMetrics((m) => ({ ...m, blurs: m.blurs + 1 }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTouched({
      email: true,
      password: true,
      confirm: true,
      username: true,
      card: true,
    });
    setMetrics((m) => ({ ...m, submitAttempts: m.submitAttempts + 1 }));
  };

  const cancelDemo = () => {
    demoTimers.current.forEach(window.clearTimeout);
    demoTimers.current = [];
    setDemoRunning(false);
  };

  const resetForm = () => {
    cancelDemo();
    setValues(emptyValues());
    setTouched(emptyFlags());
    setSubmitted(false);
    setMetrics(emptyMetrics());
    startedAt.current = Date.now();
    lastErrorState.current = new Set();
    prevSubmittedRef.current = false;
    setUsernameStatus("idle");
  };

  const runDemo = (mode: "clean" | "messy" = "clean") => {
    cancelDemo();
    resetForm();
    setDemoRunning(true);

    // Realistic typing with typo + correct cycles
    const script = buildDemoScript(mode);
    let elapsed = 0;
    script.forEach((step) => {
      elapsed += step.delay;
      const id = window.setTimeout(() => step.run(), elapsed);
      demoTimers.current.push(id);
    });
    // Mark demo as finished after the last step
    const endId = window.setTimeout(() => setDemoRunning(false), elapsed + 200);
    demoTimers.current.push(endId);
  };

  // Demo step actions, captured in a closure that mutates state setters above
  function buildDemoScript(
    mode: "clean" | "messy" = "clean"
  ): { delay: number; run: () => void }[] {
    const out: { delay: number; run: () => void }[] = [];

    const typeInto = (field: FieldKey, text: string, perChar = 70) => {
      for (let i = 0; i < text.length; i++) {
        const ch = text.slice(0, i + 1);
        out.push({
          delay: i === 0 ? 220 : perChar,
          run: () => {
            setValues((v) => ({ ...v, [field]: field === "card" ? formatCard(ch) : ch }));
            setMetrics((m) => ({ ...m, keystrokes: m.keystrokes + 1 }));
          },
        });
      }
    };
    const backspaceTo = (field: FieldKey, target: string, perChar = 60) => {
      // current value will be replaced step-by-step toward target by trimming
      out.push({
        delay: 280,
        run: () => {
          // figure out current and back off
        },
      });
      // Actually simpler: progressively set to target by character
      for (let i = target.length; i >= 0; i--) {
        if (i === target.length) continue;
        const ch = target.slice(0, i);
        out.push({
          delay: perChar,
          run: () => {
            setValues((v) => ({ ...v, [field]: field === "card" ? formatCard(ch) : ch }));
            setMetrics((m) => ({ ...m, keystrokes: m.keystrokes + 1 }));
          },
        });
      }
    };
    const blur = (field: FieldKey) =>
      out.push({
        delay: 260,
        run: () => {
          setTouched((t) => ({ ...t, [field]: true }));
          setMetrics((m) => ({ ...m, blurs: m.blurs + 1 }));
        },
      });
    const submit = () =>
      out.push({
        delay: 600,
        run: () => {
          setSubmitted(true);
          setTouched({
            email: true,
            password: true,
            confirm: true,
            username: true,
            card: true,
          });
          setMetrics((m) => ({ ...m, submitAttempts: m.submitAttempts + 1 }));
        },
      });

    // Email — with a typical typo + correct
    typeInto("email", "paw");
    typeInto("email", "paw@gmial"); // user notices typo while typing
    backspaceTo("email", "paw@g"); // backspace
    if (mode === "messy") {
      // Leave email subtly broken: missing TLD
      typeInto("email", "paw@gmail");
      blur("email");
    } else {
      typeInto("email", "paw@gmail.com");
      blur("email");
    }

    // Password — start short, build up
    typeInto("password", "letme");
    if (mode === "messy") {
      // User gives up early; password too short, no number
      blur("password");
    } else {
      typeInto("password", "letmein");
      typeInto("password", "letmein1");
      blur("password");
    }

    // Confirm — mistype first
    typeInto("confirm", "letme");
    if (mode === "messy") {
      // User assumes match; doesn't realize password rule violated
      blur("confirm");
    } else {
      typeInto("confirm", "letmeIN1"); // mismatch case
      backspaceTo("confirm", "let");
      typeInto("confirm", "letmein1");
      blur("confirm");
    }

    // Username
    if (mode === "messy") {
      // User picks a taken name and moves on
      typeInto("username", "paw");
      blur("username");
    } else {
      // Clean: type a valid available name in one go. No detours that would
      // leave a touched field in an invalid state and create a phantom
      // "errors shown" event for blur/smart strategies.
      typeInto("username", "paw_2026");
      blur("username");
    }

    // Card — type and validate
    if (mode === "messy") {
      // Off-by-one digit; fails Luhn
      typeInto("card", "4242424242424241", 50);
      blur("card");
    } else {
      typeInto("card", "4242424242424242", 50);
      blur("card");
    }

    submit();
    return out;
  }

  // Cleanup timers on unmount
  useEffect(() => () => cancelDemo(), []);

  const punished = metrics.punishedForTyping > 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <section className="px-8 lg:px-12 pt-10 pb-6 max-w-5xl">
        <p className="mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-4">
          form-hostility · validation timing playground
        </p>
        <h1 className="text-[36px] md:text-[48px] font-semibold tracking-[-0.025em] leading-[1.05] text-[var(--color-fg)]">
          Same form. Four strategies.{" "}
          <span className="text-[var(--color-fg-dim)]">One isn't hostile.</span>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-fg-muted)] max-w-2xl">
          Pick a strategy, then type — or run the demos. Try{" "}
          <span className="text-[var(--color-fg)]">Clean run</span> to see careful typing,
          then <span className="text-[var(--color-fg)]">With mistakes</span> to see what each
          strategy does when the user gets it wrong. The cracks show on the messy run.
        </p>
      </section>

      {/* Strategy picker */}
      <section className="px-8 lg:px-12 pb-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)]">
            Strategy
          </p>
          <div className="flex items-center gap-2">
            {demoRunning ? (
              <button
                onClick={cancelDemo}
                className="mono text-[11px] px-3 py-1.5 rounded-full border border-[var(--color-border-strong)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition"
              >
                Stop demo
              </button>
            ) : (
              <>
                <button
                  onClick={() => runDemo("clean")}
                  title="User types carefully and fixes their typos"
                  className="mono text-[11px] px-3 py-1.5 rounded-full bg-[#FFDD00] text-black font-semibold hover:scale-[1.02] active:scale-[0.99] transition"
                >
                  ▶ Clean run
                </button>
                <button
                  onClick={() => runDemo("messy")}
                  title="User makes realistic mistakes and submits anyway"
                  className="mono text-[11px] px-3 py-1.5 rounded-full border border-[#FFDD00] text-[#FFDD00] hover:bg-[#FFDD00]/10 transition"
                >
                  ▶ With mistakes
                </button>
              </>
            )}
            <button
              onClick={resetForm}
              className="mono text-[11px] px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition"
            >
              Reset
            </button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {STRATEGIES.map((s) => (
            <button
              key={s.id}
              onClick={() => switchStrategy(s.id)}
              className={`text-left rounded-[var(--radius)] p-4 border transition ${
                strategy === s.id
                  ? "bg-[var(--color-fg)] text-[var(--color-bg)] border-[var(--color-fg)]"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
              }`}
            >
              <p className="text-[15px] font-semibold tracking-tight">{s.label}</p>
              <p
                className={`mono text-[10.5px] mt-1 ${
                  strategy === s.id ? "opacity-70" : "text-[var(--color-fg-dim)]"
                }`}
              >
                {s.tagline}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Form + Reveal */}
      <section className="px-8 lg:px-12 pb-12 grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <FormCard
          values={values}
          errors={errorMap}
          strategy={strategy}
          usernameStatus={usernameStatus}
          submitted={submitted}
          onChange={onChange}
          onBlur={onBlur}
          onSubmit={onSubmit}
          shakingField={shakingField}
          judderField={judderField}
          demoRunning={demoRunning}
        />
        <RevealPanel
          metrics={metrics}
          history={history}
          currentStrategy={strategy}
          errorCount={errors.length}
          punished={punished}
          flashMetric={flashMetric}
        />
      </section>

      {/* Email capture — right after the reveal, where attention peaks */}
      <section className="px-8 lg:px-12 pb-14">
        <div
          className="rounded-[var(--radius-lg)] border border-[#FFDD00]/40 p-6 lg:p-8 grid md:grid-cols-[1fr_auto] gap-6 items-center"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.22 0.10 95 / 0.18), oklch(0.18 0.05 95 / 0.10))",
          }}
        >
          <div className="max-w-xl">
            <p className="mono text-[10px] uppercase tracking-[0.18em] text-[#FFDD00] mb-2">
              Liked this?
            </p>
            <h2 className="text-[22px] md:text-[26px] font-semibold tracking-[-0.015em] leading-[1.15] text-[var(--color-fg)] mb-2">
              I'll email you when the next one ships.
            </h2>
            <p className="text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
              Two emails a year. Maybe three.
            </p>
          </div>
          <div className="md:min-w-[340px]">
            <EmailCapture source="forms-playground" prompt="" hideHeading />
          </div>
        </div>
      </section>

      {/* Timing matrix */}
      <section className="px-8 lg:px-12 pb-14">
        <h2 className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)] mb-3">
          When each field should validate
        </h2>
        <p className="text-[14px] text-[var(--color-fg-muted)] mb-5 max-w-2xl">
          Different fields reward different timing. Smart strategy uses the column highlighted for
          each row.
        </p>
        <TimingMatrix />
      </section>

      {/* Hostility audit */}
      <section className="px-8 lg:px-12 pb-16 max-w-3xl">
        <h2 className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)] mb-3">
          Hostility audit
        </h2>
        <p className="text-[14px] text-[var(--color-fg-muted)] mb-5">
          Run your real form against these. One yes is bad. Two is hostile.
        </p>
        <ChecklistAudit />
      </section>

      <footer className="mt-auto px-8 lg:px-12 py-8 text-xs text-[var(--color-fg-dim)] border-t border-[var(--color-border)] flex flex-wrap gap-x-6 gap-y-2 items-center justify-between">
        <p>
          Part of{" "}
          <a href="#/" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
            okay.tools
          </a>
          .
        </p>
        <p className="mono">v0.1 · MIT</p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

function FormCard(props: {
  values: FieldValues;
  errors: Map<FieldKey, FieldError>;
  strategy: Strategy;
  usernameStatus: "idle" | "checking" | "ok" | "taken";
  submitted: boolean;
  onChange: (f: FieldKey) => (v: string) => void;
  onBlur: (f: FieldKey) => () => void;
  onSubmit: (e: React.FormEvent) => void;
  shakingField: FieldKey | null;
  judderField: FieldKey | null;
  demoRunning: boolean;
}) {
  const {
    values,
    errors,
    strategy,
    usernameStatus,
    submitted,
    onChange,
    onBlur,
    onSubmit,
    shakingField,
    judderField,
    demoRunning,
  } = props;

  const pwProg = passwordProgress(values.password);

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-6 lg:p-7 flex flex-col gap-5 relative"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-[18px] font-semibold tracking-tight">Create your account</h2>
        <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)]">
          {strategy}
        </span>
      </div>

      {demoRunning && (
        <div className="absolute top-3 right-3 mono text-[10px] uppercase tracking-[0.16em] text-[#FFDD00] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FFDD00] animate-pulse" />
          Demo running
        </div>
      )}

      <Field
        label={FIELD_LABELS.email}
        error={errors.get("email")?.message}
        hint={strategy === "smart" ? "Validates when you leave the field" : undefined}
        shake={shakingField === "email"}
        judder={judderField === "email"}
      >
        <input
          type="email"
          autoComplete="off"
          value={values.email}
          onChange={(e) => onChange("email")(e.target.value)}
          onBlur={onBlur("email")}
          className={inputClass(!!errors.get("email"))}
          placeholder="you@domain.com"
        />
      </Field>

      <Field
        label={FIELD_LABELS.password}
        error={errors.get("password")?.message}
        hint={
          strategy === "smart" ? "Live progress meter, no shaming until you submit" : undefined
        }
        shake={shakingField === "password"}
        judder={judderField === "password"}
      >
        <input
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => onChange("password")(e.target.value)}
          onBlur={onBlur("password")}
          className={inputClass(!!errors.get("password"))}
          placeholder="At least 8 characters, with a letter and a number"
        />
        {strategy === "smart" && values.password.length > 0 && !submitted && (
          <PasswordMeter progress={pwProg} />
        )}
      </Field>

      <Field
        label={FIELD_LABELS.confirm}
        error={errors.get("confirm")?.message}
        shake={shakingField === "confirm"}
        judder={judderField === "confirm"}
      >
        <input
          type="password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={(e) => onChange("confirm")(e.target.value)}
          onBlur={onBlur("confirm")}
          className={inputClass(!!errors.get("confirm"))}
          placeholder="Type it again"
        />
      </Field>

      <Field
        label={FIELD_LABELS.username}
        error={errors.get("username")?.message}
        hint={strategy === "smart" ? "Async availability check (try: admin, paw, root)" : undefined}
        shake={shakingField === "username"}
        judder={judderField === "username"}
      >
        <div className="relative">
          <input
            type="text"
            autoComplete="off"
            value={values.username}
            onChange={(e) => onChange("username")(e.target.value)}
            onBlur={onBlur("username")}
            className={inputClass(!!errors.get("username"))}
            placeholder="lowercase, numbers, underscores"
          />
          {strategy === "smart" && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 mono text-[10px] tabular-nums">
              {usernameStatus === "checking" && (
                <span className="text-[var(--color-fg-dim)]">checking…</span>
              )}
              {usernameStatus === "ok" && (
                <span className="text-[oklch(0.78_0.16_155)]">available ✓</span>
              )}
              {usernameStatus === "taken" && (
                <span className="text-[oklch(0.78_0.16_75)]">taken</span>
              )}
            </span>
          )}
        </div>
      </Field>

      <Field
        label={FIELD_LABELS.card}
        error={errors.get("card")?.message}
        hint={strategy === "smart" ? "Formats while you type, validates Luhn on blur" : undefined}
        shake={shakingField === "card"}
        judder={judderField === "card"}
      >
        <input
          type="text"
          inputMode="numeric"
          autoComplete="cc-number"
          value={values.card}
          onChange={(e) => onChange("card")(e.target.value)}
          onBlur={onBlur("card")}
          className={inputClass(!!errors.get("card")) + " mono tracking-wider"}
          placeholder="4242 4242 4242 4242"
          maxLength={23}
        />
      </Field>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          className="px-5 py-2.5 rounded-full bg-[#FFDD00] text-black text-[13px] font-semibold hover:scale-[1.02] active:scale-[0.99] transition"
        >
          Create account
        </button>
        {submitted && errors.size === 0 && (
          <span className="mono text-[11px] text-[oklch(0.78_0.16_155)]">All clear ✓</span>
        )}
        {submitted && errors.size > 0 && (
          <span className="mono text-[11px] text-[oklch(0.78_0.16_75)]">
            {errors.size} thing{errors.size === 1 ? "" : "s"} to fix
          </span>
        )}
      </div>
    </form>
  );
}

function Field(props: {
  label: string;
  error?: string;
  hint?: string;
  shake?: boolean;
  judder?: boolean;
  children: React.ReactNode;
}) {
  const { label, error, hint, shake, judder, children } = props;
  return (
    <label className={`flex flex-col gap-1.5 ${shake ? "shake" : ""}`}>
      <span className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-[var(--color-fg)]">{label}</span>
        {hint && !error && (
          <span className="mono text-[10px] text-[var(--color-fg-dim)]">{hint}</span>
        )}
      </span>
      {children}
      <span
        aria-live="polite"
        key={error ? `e:${error}` : `none:${judder ? "j" : "x"}`}
        className={`mono text-[11px] min-h-[14px] ${
          error ? "text-[oklch(0.82_0.16_75)]" : "text-transparent"
        } ${judder ? "judder" : ""}`}
      >
        {error || "•"}
      </span>
    </label>
  );
}

function inputClass(hasError: boolean) {
  return [
    "w-full px-3.5 py-2.5 rounded-[var(--radius-sm)] text-[14px] bg-[var(--color-bg)] outline-none transition",
    "border",
    hasError
      ? "border-[oklch(0.65_0.18_75)] focus:border-[oklch(0.78_0.16_75)] shadow-[0_0_0_3px_oklch(0.65_0.18_75/0.18)]"
      : "border-[var(--color-border)] focus:border-[var(--color-border-strong)]",
    "text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)]",
  ].join(" ");
}

function PasswordMeter({
  progress,
}: {
  progress: { length: number; hasLetter: boolean; hasNumber: boolean; score: number };
}) {
  const tone =
    progress.score < 0.34
      ? "oklch(0.65 0.18 75)"
      : progress.score < 0.7
      ? "oklch(0.78 0.16 75)"
      : "oklch(0.78 0.16 155)";
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${Math.round(progress.score * 100)}%`, background: tone }}
        />
      </div>
      <div className="flex gap-3 mono text-[10px] text-[var(--color-fg-dim)]">
        <span className={progress.length === 1 ? "text-[oklch(0.78_0.16_155)]" : ""}>
          {progress.length === 1 ? "✓" : "·"} 8+ chars
        </span>
        <span className={progress.hasLetter ? "text-[oklch(0.78_0.16_155)]" : ""}>
          {progress.hasLetter ? "✓" : "·"} letter
        </span>
        <span className={progress.hasNumber ? "text-[oklch(0.78_0.16_155)]" : ""}>
          {progress.hasNumber ? "✓" : "·"} number
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reveal panel
// ---------------------------------------------------------------------------

function RevealPanel({
  metrics,
  history,
  currentStrategy,
  errorCount,
  punished,
  flashMetric,
}: {
  metrics: Metrics;
  history: Partial<Record<Strategy, Metrics>>;
  currentStrategy: Strategy;
  errorCount: number;
  punished: boolean;
  flashMetric: boolean;
}) {
  // Combine current with history for the comparison
  const merged: Partial<Record<Strategy, Metrics>> = { ...history, [currentStrategy]: metrics };
  const recorded = STRATEGIES.filter((s) => merged[s.id]);
  const showCompare = recorded.length >= 2;

  const wallAtSubmit = metrics.errorsAtSubmit > 0;

  // For comparison, headline metric across strategies
  const compareMax = Math.max(
    1,
    ...recorded.map((s) =>
      Math.max(
        merged[s.id]!.punishedForTyping,
        merged[s.id]!.errorsAtSubmit,
        merged[s.id]!.errorsShown
      )
    )
  );

  return (
    <aside
      className={`rounded-[var(--radius-lg)] border p-5 flex flex-col gap-4 lg:sticky lg:top-5 transition-colors duration-300 ${
        punished
          ? "bg-[oklch(0.22_0.07_75/0.55)] border-[oklch(0.65_0.18_75)]"
          : "bg-[var(--color-surface)] border-[var(--color-border)]"
      } ${flashMetric ? "verdict-pulse" : ""}`}
    >
      <div className="flex items-center justify-between">
        <p className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)]">
          The Reveal
        </p>
        {punished && (
          <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-[#FFDD00]">
            ● hostile
          </span>
        )}
      </div>
      <p className="text-[13px] text-[var(--color-fg-muted)] -mt-1">
        What this strategy is doing to the user, in numbers.
      </p>

      {/* Verdict blocks — two pains, side by side */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className={`rounded-[var(--radius)] border p-4 transition ${
            punished
              ? "border-[oklch(0.65_0.18_75)] bg-[oklch(0.30_0.10_75/0.30)]"
              : "border-[var(--color-border)] bg-[var(--color-bg)]"
          } ${flashMetric ? "flash-warn" : ""}`}
        >
          <p className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)] leading-tight">
            Punished<br />mid-typing
          </p>
          <p
            className={`mt-1 text-[32px] font-semibold tabular-nums tracking-tight ${
              punished ? "text-[#FFDD00]" : "text-[var(--color-fg)]"
            }`}
          >
            {metrics.punishedForTyping}
          </p>
          <p className="text-[11px] text-[var(--color-fg-muted)] mt-1 leading-snug">
            {punished ? "Scolded before they finished." : "No mid-typing scolding."}
          </p>
        </div>

        <div
          className={`rounded-[var(--radius)] border p-4 transition ${
            wallAtSubmit
              ? "border-[oklch(0.65_0.18_75)] bg-[oklch(0.30_0.10_75/0.30)]"
              : "border-[var(--color-border)] bg-[var(--color-bg)]"
          }`}
        >
          <p className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)] leading-tight">
            Wall at<br />submit
          </p>
          <p
            className={`mt-1 text-[32px] font-semibold tabular-nums tracking-tight ${
              wallAtSubmit ? "text-[#FFDD00]" : "text-[var(--color-fg)]"
            }`}
          >
            {metrics.errorsAtSubmit}
          </p>
          <p className="text-[11px] text-[var(--color-fg-muted)] mt-1 leading-snug">
            {wallAtSubmit ? "Errors revealed all at once." : "Nothing dumped at submit."}
          </p>
        </div>
      </div>

      <Stat label="Time to first error">
        {metrics.firstErrorMs == null ? "—" : `${(metrics.firstErrorMs / 1000).toFixed(2)}s`}
      </Stat>
      <Stat label="Errors shown">{metrics.errorsShown}</Stat>
      <Stat label="Errors vanished while typing">{metrics.errorsVanishedWhileTyping}</Stat>
      <Stat label="Currently visible">{errorCount}</Stat>
      <Stat label="Keystrokes">{metrics.keystrokes}</Stat>
      <Stat label="Submit attempts">{metrics.submitAttempts}</Stat>

      {/* Comparison chart */}
      {showCompare && (
        <div className="border-t border-[var(--color-border)] pt-3 mt-1">
          <p className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)] mb-2">
            Compare this session
          </p>
          <div className="flex flex-col gap-2.5">
            {STRATEGIES.map((s) => {
              const m = merged[s.id];
              if (!m) {
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 mono text-[10.5px] text-[var(--color-fg-dim)]"
                  >
                    <span className="w-14 shrink-0">{s.label}</span>
                    <span className="opacity-50">— not tried yet</span>
                  </div>
                );
              }
              const punishedW = (m.punishedForTyping / compareMax) * 100;
              const wallW = (m.errorsAtSubmit / compareMax) * 100;
              const isCurrent = s.id === currentStrategy;
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <span
                    className={`mono text-[10.5px] w-14 shrink-0 ${
                      isCurrent ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)]"
                    }`}
                  >
                    {s.label}
                  </span>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <div
                      className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden"
                      title="Punished mid-typing"
                    >
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.max(punishedW, m.punishedForTyping > 0 ? 4 : 0)}%`,
                          background: m.punishedForTyping > 0 ? "#FFDD00" : "transparent",
                        }}
                      />
                    </div>
                    <div
                      className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden"
                      title="Errors revealed at submit"
                    >
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.max(wallW, m.errorsAtSubmit > 0 ? 4 : 0)}%`,
                          background:
                            m.errorsAtSubmit > 0 ? "oklch(0.65 0.18 35)" : "transparent",
                        }}
                      />
                    </div>
                  </div>
                  <span className="mono text-[10px] tabular-nums text-[var(--color-fg-muted)] w-16 text-right">
                    {m.punishedForTyping} / {m.errorsAtSubmit}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mono text-[9.5px] text-[var(--color-fg-dim)] mt-2 leading-relaxed">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#FFDD00] align-middle mr-1.5" />
            punished mid-typing
            <span className="inline-block w-2 h-2 rounded-sm bg-[oklch(0.65_0.18_35)] align-middle ml-3 mr-1.5" />
            wall at submit
          </p>
          <p className="text-[11px] text-[var(--color-fg-muted)] mt-2 leading-snug">
            Two failure modes, same input across all four. Eager punishes during.
            Lazy ambushes at the end. On-blur lands errors as you tab through. Smart
            picks the right moment per field — and its inline status pill is a UI
            affordance the others simply don't have.
          </p>
        </div>
      )}

      <p className="text-[12px] text-[var(--color-fg-muted)] border-t border-[var(--color-border)] pt-3 mt-1">
        <span className="mono uppercase tracking-[0.12em] text-[var(--color-fg-dim)] text-[10px] block mb-1">
          Strategy notes
        </span>
        {STRATEGY_NOTES[currentStrategy]}
      </p>
    </aside>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-2 last:border-0">
      <span className="text-[12px] text-[var(--color-fg-muted)]">{label}</span>
      <span className="mono text-[13px] tabular-nums text-[var(--color-fg)]">{children}</span>
    </div>
  );
}

const STRATEGY_NOTES: Record<Strategy, string> = {
  eager:
    "Fires on every keystroke. Errors appear before the user can finish typing a single field.",
  lazy:
    "Holds errors until submit. Calm during typing, but the user discovers all problems at once at the worst possible moment.",
  blur:
    "Validates when the user leaves a field. Good baseline. Doesn't punish typing, doesn't surprise on submit.",
  smart:
    "Different rule per field type. Email on blur, password shows positive progress, confirm waits for both fields, username debounced async, card formats live and Luhn-checks on blur.",
};

// ---------------------------------------------------------------------------
// Timing matrix
// ---------------------------------------------------------------------------

function TimingMatrix() {
  const cols = ["Keystroke", "Debounced", "On-blur", "On-submit"] as const;
  const rows: {
    field: FieldKey;
    pick: typeof cols[number];
    why: Record<typeof cols[number], string>;
  }[] = [
    {
      field: "email",
      pick: "On-blur",
      why: {
        Keystroke: "Email is incomplete by definition mid-typing — every keystroke is 'invalid'.",
        Debounced: "Better than keystroke, still flags 'paw@gma' as wrong while user types '@gmail'.",
        "On-blur":
          "Wait until the user has clearly finished. The field's intent only resolves at the boundary.",
        "On-submit": "Forces the user to find errors after the form-wide failure. Surprising.",
      },
    },
    {
      field: "password",
      pick: "Keystroke",
      why: {
        Keystroke:
          "Show positive progress (✓ length, ✓ letter, ✓ number). Don't show errors — show how close they are.",
        Debounced: "Progress feels laggy. Users want to see the requirement light up.",
        "On-blur": "Tells them what's wrong after they've already moved on.",
        "On-submit": "Most punishing for the field with the most rules.",
      },
    },
    {
      field: "confirm",
      pick: "Debounced",
      why: {
        Keystroke: "Mismatches every single keystroke until the last one. Pure hostility.",
        Debounced:
          "Wait until both fields have content and one was blurred, then compare. Only flag the real problem.",
        "On-blur":
          "Acceptable, but mismatch is comparable info that's instant to compute when ready.",
        "On-submit": "Same surprise problem as on-submit anywhere.",
      },
    },
    {
      field: "username",
      pick: "Debounced",
      why: {
        Keystroke: "An async availability check on every keystroke is a server crime.",
        Debounced:
          "300ms after typing stops, hit the API once. Show 'checking…', then ✓ or 'taken'.",
        "On-blur": "User has to leave the field to find out. Adds a step.",
        "On-submit": "User just spent 30s composing a name they can't have.",
      },
    },
    {
      field: "card",
      pick: "On-blur",
      why: {
        Keystroke:
          "Format spaces every 4 digits as the user types — that's helpful. But Luhn check on every keystroke flags 'invalid' until complete.",
        Debounced: "Card numbers don't pause; they get pasted or typed in one burst.",
        "On-blur":
          "Format on keystroke (helpful), Luhn-check on blur (right moment). Hybrid wins.",
        "On-submit": "User finds out their card number is wrong at checkout. Worst place.",
      },
    },
  ];

  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="bg-[var(--color-surface)]">
            <th className="text-left px-4 py-3 mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-dim)] font-medium">
              Field
            </th>
            {cols.map((c) => (
              <th
                key={c}
                className="text-left px-4 py-3 mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-dim)] font-medium"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field} className="border-t border-[var(--color-border)]">
              <td className="px-4 py-3 font-medium text-[var(--color-fg)]">
                {FIELD_LABELS[r.field]}
              </td>
              {cols.map((c) => {
                const picked = r.pick === c;
                return (
                  <td
                    key={c}
                    className={`px-4 py-3 align-top ${
                      picked
                        ? "bg-[oklch(0.30_0.04_90/0.25)] text-[var(--color-fg)]"
                        : "text-[var(--color-fg-muted)]"
                    }`}
                    title={r.why[c]}
                  >
                    {picked ? (
                      <span className="flex items-start gap-1.5">
                        <span className="mono text-[#FFDD00] mt-0.5 shrink-0">★</span>
                        <span className="text-[12px] leading-snug">{r.why[c]}</span>
                      </span>
                    ) : (
                      <span className="text-[12px] leading-snug">{r.why[c]}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hostility audit
// ---------------------------------------------------------------------------

function ChecklistAudit() {
  const items = [
    {
      q: "Does any field show an error before the user has finished typing it?",
      bad: "Eager keystroke validation. The user is being interrupted to be told they're not done yet.",
    },
    {
      q: "Does the same error appear, vanish, and reappear as the user types?",
      bad: "The flicker is more disorienting than the error. Pick a moment to commit and stick to it.",
    },
    {
      q: "Are all errors revealed only at submit?",
      bad: "The user has to fix N things at once and re-find them. Batch surprise = batch frustration.",
    },
    {
      q: "Does the password field show only what's wrong, never what's right?",
      bad: "Passwords are the one place to flip the polarity: show positive progress, not punishment.",
    },
    {
      q: "Does any field flag a value as invalid that the user can't fix without help?",
      bad: "'Card invalid' with no hint, 'username taken' after submit, 'email exists' with no recovery link. Hostile by omission.",
    },
  ];

  return (
    <ol className="flex flex-col gap-3">
      {items.map((it, i) => (
        <li
          key={i}
          className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-4"
        >
          <p className="text-[14px] font-medium text-[var(--color-fg)] flex items-start gap-2">
            <span className="mono text-[var(--color-fg-dim)] tabular-nums">{i + 1}.</span>
            {it.q}
          </p>
          <p className="text-[13px] text-[var(--color-fg-muted)] mt-1.5 pl-6">
            <span className="mono text-[10px] uppercase tracking-[0.12em] text-[oklch(0.78_0.16_75)] mr-2">
              If yes
            </span>
            {it.bad}
          </p>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyValues(): FieldValues {
  return { email: "", password: "", confirm: "", username: "", card: "" };
}
function emptyFlags(): FieldFlags {
  return { email: false, password: false, confirm: false, username: false, card: false };
}
function emptyMetrics(): Metrics {
  return {
    keystrokes: 0,
    blurs: 0,
    submitAttempts: 0,
    firstErrorMs: null,
    errorsShown: 0,
    errorsVanishedWhileTyping: 0,
    punishedForTyping: 0,
    errorsAtSubmit: 0,
  };
}

function computeVisibleErrors(args: {
  strategy: Strategy;
  values: FieldValues;
  touched: FieldFlags;
  submitted: boolean;
  usernameStatus: "idle" | "checking" | "ok" | "taken";
}): FieldError[] {
  const { strategy, values, touched, submitted, usernameStatus } = args;
  const out: FieldError[] = [];
  const push = (field: FieldKey, message: string | null) => {
    if (message) out.push({ field, message });
  };

  // EMAIL
  if (shouldShow({ strategy, value: values.email, touched: touched.email, submitted })) {
    push("email", validateEmail(values.email));
  }

  // PASSWORD
  if (strategy === "smart") {
    if (submitted) push("password", validatePassword(values.password));
  } else if (
    shouldShow({
      strategy,
      value: values.password,
      touched: touched.password,
      submitted,
    })
  ) {
    push("password", validatePassword(values.password));
  }

  // CONFIRM
  if (strategy === "smart") {
    // Only validate confirm once the user has finished typing it (blur) or
    // submitted. Mid-typing comparison would punish every keystroke until
    // the user happens to match the password.
    if (submitted || touched.confirm) {
      push("confirm", validateConfirm(values.confirm, values.password));
    }
  } else if (
    shouldShow({
      strategy,
      value: values.confirm,
      touched: touched.confirm,
      submitted,
    })
  ) {
    push("confirm", validateConfirm(values.confirm, values.password));
  }

  // USERNAME
  // Each strategy gets the same async availability data; they differ in when
  // they surface the "Username taken" result.
  const formatErr = validateUsername(values.username);
  const showFormat = (() => {
    if (strategy === "smart") return submitted || touched.username;
    return shouldShow({
      strategy,
      value: values.username,
      touched: touched.username,
      submitted,
    });
  })();
  const showTaken = (() => {
    // "Taken" is meaningful only once the format is valid.
    if (formatErr || usernameStatus !== "taken") return false;
    switch (strategy) {
      case "eager":
        // Surfaces as soon as the async check returns, mid-typing.
        return values.username.length > 0;
      case "lazy":
        // Hidden until submit — the wall.
        return submitted;
      case "blur":
        // After the user leaves the field.
        return touched.username || submitted;
      case "smart":
        return touched.username || submitted;
    }
  })();
  if (showFormat && formatErr) push("username", formatErr);
  else if (showTaken) push("username", "Username taken");

  // CARD
  if (strategy === "smart") {
    if (submitted || touched.card) push("card", validateCard(values.card));
  } else if (
    shouldShow({ strategy, value: values.card, touched: touched.card, submitted })
  ) {
    push("card", validateCard(values.card));
  }

  return out;
}

function shouldShow(args: {
  strategy: Strategy;
  value: string;
  touched: boolean;
  submitted: boolean;
}) {
  const { strategy, value, touched, submitted } = args;
  if (submitted) return true;
  switch (strategy) {
    case "eager":
      return value.length > 0;
    case "lazy":
      return false;
    case "blur":
      return touched;
    case "smart":
      return touched;
  }
}
