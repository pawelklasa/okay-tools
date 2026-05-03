import { useState, useId } from "react";
import { Link } from "react-router-dom";

// Buttondown account username (https://buttondown.com/<username>).
const BUTTONDOWN_USERNAME = "pav";
const ENDPOINT = `https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN_USERNAME}`;

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

    // Honeypot — silently swallow bot submissions.
    if (honeypot) {
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
      const body = new URLSearchParams();
      body.set("email", email);
      body.set("metadata__source", source);
      body.set("tag", source);
      body.set("embed", "1");

      // no-cors: Buttondown's embed endpoint doesn't expose CORS headers, so
      // we can't read the response. The submission still reaches them. We
      // assume success on no network error; duplicate emails are handled
      // gracefully on Buttondown's end (they just re-send confirmation).
      await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      setState("success");
    } catch {
      setErrMsg("Try again?");
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
            {state === "submitting" ? "Sending…" : "Tell me"}
          </button>
        </div>

        <p className="mono text-[11px] min-h-[14px] mt-2 text-[oklch(0.82_0.16_75)]">
          {state === "error" && errMsg}
        </p>

        <p className="text-[11px] text-[var(--color-fg-dim)] leading-snug">
          Used only for tool announcements. Unsubscribe anytime.{" "}
          <Link to="/privacy" className="underline hover:text-[var(--color-fg-muted)]">
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
          {state === "submitting" ? "Sending…" : "Tell me"}
        </button>
      </div>

      <p className="mono text-[11px] min-h-[14px] mt-2 text-[oklch(0.82_0.16_75)]">
        {state === "error" && errMsg}
      </p>

      <p className="text-[11px] text-[var(--color-fg-dim)] leading-snug">
        Email used only for tool announcements. Unsubscribe anytime.{" "}
        <Link to="/privacy" className="underline hover:text-[var(--color-fg-muted)]">
          Privacy
        </Link>
        .
      </p>
    </form>
  );
}
