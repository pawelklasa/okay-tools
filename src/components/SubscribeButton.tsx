import { useEffect, useRef, useState } from "react";
import { EmailCapture } from "./EmailCapture";

export function SubscribeButton() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Close on escape; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the dialog.
    requestAnimationFrame(() => {
      const input = dialogRef.current?.querySelector<HTMLInputElement>(
        'input[type="email"]'
      );
      input?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white text-black text-[13px] font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.35)] hover:scale-[1.02] active:scale-[0.99] transition"
        aria-label="Get notified when new tools ship"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
        >
          <path d="M4 6h16v12H4z" />
          <path d="M4 6l8 7 8-7" />
        </svg>
        <span className="hidden sm:inline">Notify me about new tools</span>
        <span className="sm:hidden">Notify me</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscribe-title"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
          />

          {/* Panel */}
          <div
            ref={dialogRef}
            className="relative w-full max-w-lg rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 inline-flex items-center justify-center rounded-full text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg)] transition"
            >
              <span aria-hidden className="text-[18px] leading-none">×</span>
            </button>

            <p className="mono text-[11px] uppercase tracking-[0.2em] text-[#FFDD00] mb-3">
              Get the next one
            </p>
            <h2
              id="subscribe-title"
              className="text-[22px] sm:text-[26px] font-bold leading-tight text-[var(--color-fg)] mb-2"
            >
              I'll email you when the next tool ships.
            </h2>
            <p className="text-[13px] text-[var(--color-fg-dim)] mb-5 leading-relaxed">
              One email per tool. Roughly every couple of months. No newsletter,
              no marketing.
            </p>

            <EmailCapture source="subscribe-modal" prompt="" hideHeading />
          </div>
        </div>
      )}
    </>
  );
}
