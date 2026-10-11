import { CoffeeButton } from "./CoffeeButton";
import { signalHref } from "../lib/signal";

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

export function BrandHeader({ dashboard = false }: { dashboard?: boolean }) {
  return (
    <header className={dashboard ? "dashboard-header" : "px-8 lg:px-16 pt-7 flex items-center gap-2.5"}>
      <a href={`${import.meta.env.BASE_URL}#/`} className="flex items-center gap-2.5" aria-label="okay.tools home">
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
      </a>
      {dashboard && <>
        <nav aria-label="Main navigation">
          <button type="button" onClick={() => scrollToSection("check")}>Check</button>
          <a href={signalHref()}>Signal</a>
          <button type="button" onClick={() => scrollToSection("tools")}>Tools</button>
          <button type="button" onClick={() => scrollToSection("writing")}>Writing</button>
        </nav>
        <div className="dashboard-coffee"><CoffeeButton /></div>
      </>}
    </header>
  );
}

export function BrandFooter({ dashboard = false }: { dashboard?: boolean }) {
  return (
    <footer className={`${dashboard ? "dashboard-footer " : ""}mt-auto px-8 lg:px-16 py-8 flex flex-wrap gap-x-6 gap-y-3 items-center justify-between text-xs text-[var(--color-fg-dim)] border-t border-[var(--color-border)]`}>
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
      <p className="mono">{dashboard ? "v0.3" : "v0.2"} · MIT</p>
    </footer>
  );
}