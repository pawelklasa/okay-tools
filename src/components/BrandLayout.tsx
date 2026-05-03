import { Outlet } from "react-router-dom";

// Note: no floating tip button on the brand landing. The page hasn't earned
// the ask yet — Tip lives in the footer next to GitHub. Tools pages
// (Color/Forms layouts) keep their own tip jar because by then the user
// has actually used something.
export function BrandLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <main className="flex-1 min-w-0 animate-in">
        <Outlet />
      </main>
    </div>
  );
}
