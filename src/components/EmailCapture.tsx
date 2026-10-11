import { useState, useId } from "react";
import { Link } from "react-router-dom";

// Server-side endpoint (Netlify function) that talks to Buttondown via API.
// Local dev: vite serves the SPA; this endpoint only exists on the deployed
// site (or under `netlify dev`). We surface a clear error if it's missing.
const ENDPOINT = "/api/subscribe";

type State = "idle" | "submitting" | "success" | "error";

export function EmailCapture({
  prompt,
  source,
  className = "",
  hideHeading = false,
}: {
  prompt: string;
  source: string;
  className?: string;
  /** When used inside a band that already provides its own heading + copy. */
  hideHeading?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const inputId = useId();

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);

    if (honeypot) {
      // Pretend success; never hit the wire.
      setState("success");
      return;
    }

    if (!valid) {
      setErrMsg("That doesn't look like an email.");
      setState("error");
      return;
    }

    setState("submitting");

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source, website: honeypot }),
      });

      if (res.ok) {
        setState("success");
        return;
      }

      let detail: { error?: string } | null = null;
      try {
        detail = await res.json();
      } catch {
        // non-JSON response
      }

      const code = detail?.error || "unknown";
      const msg =
        code === "invalid_email"
          ? "That doesn't look like an email."
          : code === "rate_limited"
            ? "Too many attempts. Try again in a few minutes."
            : code === "server_misconfigured"
              ? "Server is missing its subscribe key. Try again later."
              : "Couldn't subscribe. Try again in a moment.";
      setErrMsg(msg);
      setState("error");
    } catch {
      setErrMsg("Network error. Check your connection and try again.");
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className={`rounded-[var(--radius)] border border-[oklch(0.55_0.14_155)] bg-[oklch(0.22_0.06_155/0.35)] p-5 ${className}`}>
        <p className="mono text-[10px] uppercase tracking-[0.14em] text-[oklch(0.78_0.16_155)] mb-1">
          Subscribed
        </p>
        <p className="text-[14px] text-[var(--color-fg)]">Got it. You'll hear from me.</p>
      </div>
    );
  }

  // When used inside a band that owns its own heading, render a compact
  // form (no surrounding card chrome, no prompt paragraph).
  if (hideHeading) {
    return (
      <form onSubmit={onSubmit} noValidate className={`relative ${className}`}>
        <label
          htmlFor={inputId}
          className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)] block mb-1.5"
        >
          Email
        </label>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id={inputId}
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state === "error") {
                setState("idle");
                setErrMsg(null);
              }
            }}
            placeholder="you@somewhere.com"
            className={`flex-1 px-3.5 py-2.5 rounded-[var(--radius-sm)] text-[14px] bg-[var(--color-bg)] outline-none transition border ${
              state === "error"
                ? "border-[oklch(0.65_0.18_75)] focus:border-[oklch(0.78_0.16_75)] shadow-[0_0_0_3px_oklch(0.65_0.18_75/0.18)]"
                : "border-[var(--color-border)] focus:border-[var(--color-border-strong)]"
            } text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)]`}
          />

          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] w-px h-px opacity-0"
          />

          <button
            type="submit"
            disabled={state === "submitting"}
            className="mono text-[12px] px-4 py-2.5 rounded-[var(--radius-sm)] bg-[#FFDD00] text-black font-semibold hover:scale-[1.01] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {state === "submitting" ? "Sending…" : "I'm in"}
          </button>
        </div>

        <p className="mono text-[11px] min-h-[14px] mt-2 text-[oklch(0.82_0.16_75)]">
          {state === "error" && errMsg}
        </p>

        <p className="text-[11px] text-[var(--color-fg-dim)] leading-snug">
          Used only for tool announcements. Unsubscribe anytime.{" "}
          <Link
            to="/privacy"
            className="underline decoration-[var(--color-border-strong)] underline-offset-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:decoration-[var(--color-fg)] transition-colors"
          >
            Privacy
          </Link>
          .
        </p>
      </form>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={`rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 ${className}`}
    >
      <p className="text-[14px] leading-relaxed text-[var(--color-fg)] mb-3">{prompt}</p>

      <label
        htmlFor={inputId}
        className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)] block mb-1.5"
      >
        Email
      </label>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id={inputId}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") {
              setState("idle");
              setErrMsg(null);
            }
          }}
          placeholder="you@somewhere.com"
          className={`flex-1 px-3.5 py-2.5 rounded-[var(--radius-sm)] text-[14px] bg-[var(--color-bg)] outline-none transition border ${
            state === "error"
              ? "border-[oklch(0.65_0.18_75)] focus:border-[oklch(0.78_0.16_75)] shadow-[0_0_0_3px_oklch(0.65_0.18_75/0.18)]"
              : "border-[var(--color-border)] focus:border-[var(--color-border-strong)]"
          } text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)]`}
        />

        {/* Honeypot — hidden from humans, attractive to bots. */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] w-px h-px opacity-0"
        />

        <button
          type="submit"
          disabled={state === "submitting"}
          className="mono text-[12px] px-4 py-2.5 rounded-[var(--radius-sm)] bg-[#FFDD00] text-black font-semibold hover:scale-[1.01] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {state === "submitting" ? "Sending…" : "I'm in"}
        </button>
      </div>

      <p className="mono text-[11px] min-h-[14px] mt-2 text-[oklch(0.82_0.16_75)]">
        {state === "error" && errMsg}
      </p>

      <p className="text-[11px] text-[var(--color-fg-dim)] leading-snug">
        Email used only for tool announcements. Unsubscribe anytime.{" "}
        <Link
          to="/privacy"
          className="underline decoration-[var(--color-border-strong)] underline-offset-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:decoration-[var(--color-fg)] transition-colors"
        >
          Privacy
        </Link>
        .
      </p>
    </form>
  );
}
