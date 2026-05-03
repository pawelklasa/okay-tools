import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { RampGenerator } from "./pages/RampGenerator";
import { GradientLab } from "./pages/GradientLab";
import { HslLies } from "./pages/HslLies";
import { HslToOklch } from "./pages/HslToOklch";
import { PaletteGenerator } from "./pages/PaletteGenerator";
import { ContrastFinder } from "./pages/ContrastFinder";
import { DarkModeInverter } from "./pages/DarkModeInverter";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="ramp" element={<RampGenerator />} />
          <Route path="gradient" element={<GradientLab />} />
          <Route path="hsl-lies" element={<HslLies />} />
          <Route path="hsl-to-oklch" element={<HslToOklch />} />
          <Route path="palette" element={<PaletteGenerator />} />
          <Route path="contrast" element={<ContrastFinder />} />
          <Route path="dark-mode" element={<DarkModeInverter />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
