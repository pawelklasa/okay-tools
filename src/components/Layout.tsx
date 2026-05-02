import { Link, NavLink, Outlet } from "react-router-dom";

const tools = [
  { to: "/ramp", label: "Ramp" },
  { to: "/gradient", label: "Gradient" },
  { to: "/hsl-lies", label: "HSL Lies" },
  { to: "/contrast", label: "Contrast" },
  { to: "/dark-mode", label: "Dark Mode" },
];

export function Layout() {
  return (
    <div className="min-h-full grid grid-cols-1 md:grid-cols-[220px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col bg-[var(--color-bg)] sticky top-0 h-screen border-r border-[var(--color-border)]">
        <div className="px-6 pt-7 pb-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span
              className="w-6 h-6 rounded-md"
              style={{
                background:
                  "conic-gradient(from 0deg, oklch(0.72 0.18 30), oklch(0.72 0.18 110), oklch(0.72 0.18 200), oklch(0.72 0.18 290), oklch(0.72 0.18 30))",
              }}
            />
            <span className="font-semibold tracking-tight text-[15px]">
              okay<span className="text-[var(--color-fg-dim)]">.tools</span>
            </span>
          </Link>
        </div>

        <nav className="px-3 flex flex-col gap-0.5">
          {tools.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
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

        <div className="mt-auto p-6 text-xs text-[var(--color-fg-dim)] space-y-1">
          <a
            href="https://medium.com/design-bootcamp/color-is-finally-ok-82f368f3408c"
            target="_blank"
            rel="noreferrer"
            className="block hover:text-[var(--color-fg-muted)]"
          >
            Read the article ↗
          </a>
          <a
            href="https://github.com/pawelklasa/okay-tools"
            target="_blank"
            rel="noreferrer"
            className="block hover:text-[var(--color-fg-muted)]"
          >
            GitHub ↗
          </a>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-bg)] z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">
            okay<span className="text-[var(--color-fg-dim)]">.tools</span>
          </Link>
        </div>
        <nav className="flex gap-1 px-2 pb-2 overflow-x-auto">
          {tools.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-1.5 rounded-md text-sm ${
                  isActive
                    ? "bg-[var(--color-surface)] text-[var(--color-fg)]"
                    : "text-[var(--color-fg-muted)]"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Main */}
      <main className="min-w-0 animate-in">
        <Outlet />
      </main>

      {/* Floating tip jar — top right, fixed */}
      <a
        href="https://buy.stripe.com/fZueVdgDiaqo9xyaIZ3gk00"
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
