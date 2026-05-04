import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
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

export default function App() {
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
    </HashRouter>
  );
}
