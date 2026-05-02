import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

const tools = [
  { to: "/ramp", label: "Ramp", hint: "Generate" },
  { to: "/gradient", label: "Gradient", hint: "Compare" },
  { to: "/hsl-lies", label: "HSL Lies", hint: "Demo" },
  { to: "/contrast", label: "Contrast", hint: "WCAG / APCA" },
  { to: "/dark-mode", label: "Dark Mode", hint: "Invert" },
];

export function Layout() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="min-h-full grid grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="hidden md:flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)] sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-[var(--color-border)]">
          <Link to="/" className="flex items-center gap-2.5">
            <span
              className="w-7 h-7 rounded-md"
              style={{
                background:
                  "conic-gradient(from 0deg, oklch(0.7 0.18 30), oklch(0.7 0.18 90), oklch(0.7 0.18 150), oklch(0.7 0.18 210), oklch(0.7 0.18 270), oklch(0.7 0.18 330), oklch(0.7 0.18 30))",
              }}
            />
            <span className="font-semibold tracking-tight text-[15px]">
              okay<span className="text-[var(--color-fg-dim)]">.tools</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-0.5">
          <p className="px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-dim)]">
            Tools
          </p>
          {tools.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `group flex items-center justify-between px-3 py-2 rounded-md text-sm transition ${
                  isActive
                    ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                    : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
                }`
              }
            >
              <span>{t.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg-muted)]">
                {t.hint}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--color-border)] flex flex-col gap-3">
          <a
            href="https://medium.com/design-bootcamp/color-is-finally-ok-82f368f3408c"
            target="_blank"
            rel="noreferrer"
            className="block p-3 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition"
          >
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)] mb-1">
              The article
            </p>
            <p className="text-sm font-medium leading-snug">Color is finally OK →</p>
          </a>
          <a
            href="https://www.buymeacoffee.com/pawelklasa"
            target="_blank"
            rel="noreferrer"
            className="text-center px-3 py-2 rounded-md bg-[var(--color-fg)] text-[var(--color-bg)] text-sm font-medium hover:opacity-90 transition"
          >
            Buy me a coffee
          </a>
          <a
            href="https://github.com/pawelklasa/okay-tools"
            target="_blank"
            rel="noreferrer"
            className="text-center text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-fg-muted)]"
          >
            GitHub ↗
          </a>
        </div>
      </aside>

      <header className="md:hidden border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-bg)] z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">
            okay<span className="text-[var(--color-fg-dim)]">.tools</span>
          </Link>
          <a
            href="https://www.buymeacoffee.com/pawelklasa"
            target="_blank"
            rel="noreferrer"
            className="text-xs px-3 py-1.5 rounded-md bg-[var(--color-fg)] text-[var(--color-bg)] font-medium"
          >
            ☕
          </a>
        </div>
        <nav className="flex gap-1 px-2 pb-2 overflow-x-auto">
          {tools.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-1.5 rounded-md text-sm ${
                  isActive
                    ? "bg-[var(--color-surface-2)]"
                    : "text-[var(--color-fg-muted)]"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className={isHome ? "" : "animate-in"}>
        <Outlet />
      </main>
    </div>
  );
}
