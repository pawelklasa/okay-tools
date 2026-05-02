import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { RampGenerator } from "./pages/RampGenerator";
import { GradientLab } from "./pages/GradientLab";
import { HslLies } from "./pages/HslLies";
import { ContrastFinder } from "./pages/ContrastFinder";
import { DarkModeInverter } from "./pages/DarkModeInverter";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="ramp" element={<RampGenerator />} />
          <Route path="gradient" element={<GradientLab />} />
          <Route path="hsl-lies" element={<HslLies />} />
          <Route path="contrast" element={<ContrastFinder />} />
          <Route path="dark-mode" element={<DarkModeInverter />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
