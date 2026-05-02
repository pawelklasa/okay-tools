import { Link, NavLink, Outlet } from "react-router-dom";

const tools = [
  { to: "/ramp", label: "Ramp" },
  { to: "/gradient", label: "Gradient Lab" },
  { to: "/hsl-lies", label: "HSL Lies" },
  { to: "/contrast", label: "Contrast" },
  { to: "/dark-mode", label: "Dark Mode" },
];

export function Layout() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-ink-200 bg-ink-50/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center gap-6">
          <Link to="/" className="font-semibold text-ink-900 tracking-tight">
            okay<span className="text-brand-600">.tools</span>
          </Link>
          <nav className="flex gap-1 flex-wrap">
            {tools.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm rounded-md transition ${
                    isActive
                      ? "bg-ink-900 text-ink-50"
                      : "text-ink-700 hover:bg-ink-100"
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <a
              href="https://medium.com/design-bootcamp/color-is-finally-ok-82f368f3408c"
              target="_blank"
              rel="noreferrer"
              className="text-ink-600 hover:text-ink-900"
            >
              Read the story →
            </a>
            <a
              href="https://www.buymeacoffee.com/pawelklasa"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-md bg-brand-500 text-white hover:bg-brand-600 text-sm font-medium"
            >
              ☕ Buy me a coffee
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink-200 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-ink-600 flex flex-wrap gap-4 justify-between">
          <p>
            Free tools for working in OKLCH. Built by{" "}
            <a
              href="https://pavka.design/"
              className="underline hover:text-ink-900"
              target="_blank"
              rel="noreferrer"
            >
              Pawel Klasa
            </a>
            .
          </p>
          <p>
            Math by{" "}
            <a
              href="https://culorijs.org/"
              className="underline hover:text-ink-900"
              target="_blank"
              rel="noreferrer"
            >
              culori
            </a>
            . OKLCH by Björn Ottosson.
          </p>
        </div>
      </footer>
    </div>
  );
}
