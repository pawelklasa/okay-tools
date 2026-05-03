import { Link } from "react-router-dom";

export function Privacy() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 lg:px-16 pt-7 flex items-center gap-2.5">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span
            className="w-7 h-7 rounded-md"
            style={{
              background:
                "conic-gradient(from 0deg, oklch(0.72 0.18 30), oklch(0.72 0.18 110), oklch(0.72 0.18 200), oklch(0.72 0.18 290), oklch(0.72 0.18 30))",
            }}
          />
          <span className="font-semibold tracking-tight text-[15px]">
            okay<span className="text-[var(--color-fg-dim)]">.tools</span>
          </span>
        </Link>
      </header>

      <main className="px-8 lg:px-16 pt-20 pb-20 max-w-2xl">
        <p className="mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-6">
          Privacy
        </p>
        <h1 className="text-[36px] md:text-[44px] font-semibold tracking-[-0.025em] leading-[1.05] text-[var(--color-fg)] mb-6">
          The short version.
        </h1>
        <p className="text-[16px] leading-relaxed text-[var(--color-fg-muted)]">
          okay.tools is a small studio of tools by Pawel Klasa. If you give me your email, I'll
          use it only to notify you when new tools ship. I won't share it. I won't sell it.
          Unsubscribe links are in every email.
        </p>

        <p className="mt-10 text-[13px] text-[var(--color-fg-dim)]">
          <Link
            to="/"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline"
          >
            ← Back to okay.tools
          </Link>
        </p>
      </main>
    </div>
  );
}
