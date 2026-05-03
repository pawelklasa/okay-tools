import { Link, NavLink, Outlet } from "react-router-dom";

const tools = [
  { to: "/forms", label: "Playground", end: true },
];

const soon = ["Layout hostility", "Copy hostility"];

export function FormsLayout() {
  return (
    <div className="min-h-full grid grid-cols-1 md:grid-cols-[220px_1fr]">
      <aside className="hidden md:flex flex-col bg-[var(--color-bg)] sticky top-0 h-screen border-r border-[var(--color-border)] overflow-y-auto">
        <div className="px-6 pt-7 pb-3">
          <Link
            to="/"
            className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition inline-flex items-center gap-1.5"
          >
            <span aria-hidden>←</span> okay.tools
          </Link>
        </div>
        <div className="px-6 pb-7">
          <Link to="/forms" className="flex items-center gap-2.5">
            <span
              className="w-6 h-6 rounded-md grid place-items-center"
              style={{
                background: "oklch(0.22 0.04 75)",
                border: "1px solid oklch(0.65 0.18 75)",
              }}
            >
              <span className="mono text-[10px] font-bold text-[oklch(0.85_0.16_75)]">!</span>
            </span>
            <span className="font-semibold tracking-tight text-[14px] leading-tight">
              form<span className="text-[var(--color-fg-dim)]">-hostility</span>
            </span>
          </Link>
        </div>

        <nav className="px-3 flex flex-col gap-0.5">
          {tools.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-[14px] transition ${
                  isActive
                    ? "text-[var(--color-fg)] bg-[var(--color-surface)]"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-6 pt-6 pb-2 flex flex-col gap-1.5 text-[13px]">
          <a
            href="https://github.com/pawelklasa/okay-tools"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            GitHub ↗
          </a>
        </div>

        <div className="px-3 pt-6">
          <p className="px-3 mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-dim)] mb-1.5">
            Soon
          </p>
          <ul className="flex flex-col">
            {soon.map((s) => (
              <li
                key={s}
                className="px-3 py-1.5 text-[13px] text-[var(--color-fg-dim)] cursor-default"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto p-6 text-xs text-[var(--color-fg-dim)]">
          <p className="mono">v0.1 · MIT</p>
        </div>
      </aside>

      <header className="md:hidden border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-bg)] z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link
            to="/"
            className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-dim)]"
          >
            ← okay.tools
          </Link>
          <Link to="/forms" className="font-semibold tracking-tight text-[13px]">
            form<span className="text-[var(--color-fg-dim)]">-hostility</span>
          </Link>
        </div>
      </header>

      <main className="min-w-0 animate-in">
        <Outlet />
      </main>

      <a
        href="https://buy.stripe.com/5kQ6oJ6Qebt63GN9G71wY00"
        target="_blank"
        rel="noreferrer"
        className="fixed top-4 right-4 md:top-5 md:right-6 z-40 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#FFDD00] text-black text-[13px] font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.35)] hover:scale-[1.02] active:scale-[0.99] transition"
        aria-label="Buy me a coffee"
      >
        <span aria-hidden>☕</span>
        <span className="hidden sm:inline">Buy me a coffee</span>
      </a>
    </div>
  );
}
