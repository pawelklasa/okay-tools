import { Outlet } from "react-router-dom";

export function BrandLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <main className="flex-1 min-w-0 animate-in">
        <Outlet />
      </main>
    </div>
  );
}
