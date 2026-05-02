# okay.tools

A small, free suite of OKLCH-native colour utilities for designers and developers — the companion tools for the Medium article ["Color is finally OK"](https://medium.com/design-bootcamp/color-is-finally-ok-82f368f3408c).

**Live:** https://pawelklasa.github.io/okay-tools/

## Phase 1 tools

- **Ramp Generator** — single anchor → 11-step Tailwind-style ramp (50–950) with even L spacing and chroma taper. Exports to Tailwind v4, shadcn, plain CSS, SCSS, DTCG JSON, hex.
- **Gradient Lab** — see the dead-grey middle. Compare gradients in OKLCH, Oklab, CIELAB, HSL and sRGB side by side.
- **HSL Lies, OKLCH Doesn't** — twin sliders demonstrating hue drift and lightness lies in HSL.
- **Contrast Pair Finder** — every WCAG + APCA passing pair from a generated ramp, sorted by ΔL.
- **Dark Mode Inverter** — flip the L axis, watch dark mode behave.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 (`@theme` block, dogfooded in OKLCH)
- [culori](https://culorijs.org/) for the colour math
- React Router with `HashRouter` (shareable URLs encode palettes in `?s=`)
- Hosted on GitHub Pages via GitHub Actions

## Develop

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

## Deploy

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages. Base path is set in `vite.config.ts` (`base: '/okay-tools/'`).

## Roadmap

- HSL → OKLCH migrator (paste tokens)
- Multi-scale palette builder
- Colourblind simulator
- Data-viz scale builder (sequential, diverging, categorical)
- Gamut visualiser (3D OKLCH solid)
- Albers interactive demo
- Figma plugin / Variables JSON export

## Credits

- OKLCH/Oklab by [Björn Ottosson](https://bottosson.github.io/posts/oklab/)
- Math via [culori](https://culorijs.org/) by Dan Burzo
- APCA by Andrew Somers ([SAPC-APCA](https://github.com/Myndex/SAPC-APCA), MIT)
- Article and tools by [Pawel Klasa](https://pavka.design/)

## License

MIT.
