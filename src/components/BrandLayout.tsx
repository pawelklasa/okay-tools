import { Outlet } from "react-router-dom";

export function BrandLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <main className="flex-1 min-w-0 animate-in">
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
