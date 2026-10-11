import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { BrandLayout } from "./components/BrandLayout";
import { ColorLayout } from "./components/ColorLayout";
import { FormsLayout } from "./components/FormsLayout";
import { BrandHome } from "./pages/BrandHome";
import { Home } from "./pages/Home";
import { RampGenerator } from "./pages/RampGenerator";
import { GradientLab } from "./pages/GradientLab";
import { HslLies } from "./pages/HslLies";
import { HslToOklch } from "./pages/HslToOklch";
import { PaletteGenerator } from "./pages/PaletteGenerator";
import { ContrastFinder } from "./pages/ContrastFinder";
import { DarkModeInverter } from "./pages/DarkModeInverter";
import { FormPlayground } from "./pages/forms/Playground";
import { Privacy } from "./pages/Privacy";
import { TokenCostumes } from "./pages/TokenCostumes";
import { HonestTokens } from "./pages/HonestTokens";
import { DefaultAudit } from "./pages/DefaultAudit";
import { Preflight } from "./pages/Preflight";
import { Skills } from "./pages/Skills";
import { SkillDetail } from "./pages/SkillDetail";
import { Drift } from "./pages/Drift";
import { CoffeeButton } from "./components/CoffeeButton";
import { SubscribeButton } from "./components/SubscribeButton";
import { Signal } from "./pages/Signal";
import { signalPath } from "./lib/signal";

export default function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, "");
  const pathname = window.location.pathname.slice(basename.length);
  if (pathname === signalPath || pathname.startsWith(`${signalPath}/`)) {
    return (
      <BrowserRouter basename={basename || "/"}>
        <Routes>
          <Route path={signalPath} element={<Signal />} />
          <Route path={`${signalPath}/archive`} element={<Signal />} />
          <Route path={`${signalPath}/:date`} element={<Signal />} />
        </Routes>
        <div className="fixed top-4 right-4 md:top-5 md:right-6 z-40 flex items-center gap-2">
          <SubscribeButton />
          <CoffeeButton />
        </div>
      </BrowserRouter>
    );
  }
  return (
    <HashRouter>
      <Routes>
        {/* Brand-level landing */}
        <Route element={<BrandLayout />}>
          <Route index element={<BrandHome />} />
        </Route>

        {/* App: Color is finally OK */}
        <Route path="color" element={<ColorLayout />}>
          <Route index element={<Home />} />
          <Route path="ramp" element={<RampGenerator />} />
          <Route path="gradient" element={<GradientLab />} />
          <Route path="hsl-lies" element={<HslLies />} />
          <Route path="hsl-to-oklch" element={<HslToOklch />} />
          <Route path="palette" element={<PaletteGenerator />} />
          <Route path="contrast" element={<ContrastFinder />} />
          <Route path="dark-mode" element={<DarkModeInverter />} />
        </Route>

        {/* App: form-hostility */}
        <Route path="forms" element={<FormsLayout />}>
          <Route index element={<FormPlayground />} />
        </Route>

        {/* App: token-costumes */}
        <Route path="tokens" element={<TokenCostumes />} />

        {/* App: honest-tokens generator */}
        <Route path="generate" element={<HonestTokens />} />

        {/* App: default-audit */}
        <Route path="defaults" element={<DefaultAudit />} />

        {/* App: preflight checklists */}
        <Route path="preflight" element={<Preflight />} />

        {/* App: drift score */}
        <Route path="drift" element={<Drift />} />

        {/* Skills hub */}
        <Route path="skills" element={<Skills />} />
        <Route path="skills/:slug" element={<SkillDetail />} />

        {/* Privacy */}
        <Route path="privacy" element={<Privacy />} />

        {/* Legacy redirects — preserve existing URLs */}
        <Route path="ramp" element={<Navigate to="/color/ramp" replace />} />
        <Route path="gradient" element={<Navigate to="/color/gradient" replace />} />
        <Route path="hsl-lies" element={<Navigate to="/color/hsl-lies" replace />} />
        <Route path="hsl-to-oklch" element={<Navigate to="/color/hsl-to-oklch" replace />} />
        <Route path="palette" element={<Navigate to="/color/palette" replace />} />
        <Route path="contrast" element={<Navigate to="/color/contrast" replace />} />
        <Route path="dark-mode" element={<Navigate to="/color/dark-mode" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToolActions />
    </HashRouter>
  );
}

function ToolActions() {
  const { pathname } = useLocation();
  if (pathname === "/") return null;
  return <div className="fixed top-4 right-4 md:top-5 md:right-6 z-40 flex items-center gap-2">
    <SubscribeButton />
    <CoffeeButton />
  </div>;
}
