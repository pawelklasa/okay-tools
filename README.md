# okay.tools

[![Live](https://img.shields.io/badge/live-pawelklasa.github.io%2Fokay--tools-00b6fe?style=flat-square)](https://pawelklasa.github.io/okay-tools/)
[![License: MIT](https://img.shields.io/badge/license-MIT-7a7a7a?style=flat-square)](LICENSE)
[![Article](https://img.shields.io/badge/read-the%20article-f5f5f5?style=flat-square)](https://medium.com/design-bootcamp/color-is-finally-ok-82f368f3408c)

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
- React Router with `HashRouter` for existing tools; clean history routes for the daily digest
- Netlify at okay.tools, with a GitHub Pages deployment workflow also retained

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

Netlify uses `netlify.toml` to build and publish `dist`, serving clean page URLs via its SPA fallback. Pushes to `main` also trigger `.github/workflows/deploy.yml` for GitHub Pages. `vite.config.ts` chooses `/` for Netlify/Cloudflare and `/okay-tools/` for Pages. The build generates digest JSON and RSS before compiling the app.

## Dashboard Check

The homepage groups tools into Audit, Build, and Lab and previews the latest five digest items. Its combined check reuses the existing Drift Score, default-audit, and token-costumes engines. Paste CSS to compute locally; enter a URL to use the existing `/api/fetch-url` endpoint, combining linked stylesheets, embedded styles, inline declarations, and page-source pattern matches. URL checks require the existing server endpoint (Netlify or Vite dev); on a static-only host, paste CSS instead.

The report starts empty, with no sample or invented metrics. Submitted checks show measured spacing counts, default-pattern density, costume tokens, and expandable findings. Evidence previews show bounded matched snippets, never entire HTML source lines; expanded findings scroll within a limited-height panel. A flagged count represents which of the three checks found a signal, not the total number of defects. No account is required, and pasted CSS is not sent to a server. The UI test suite covers CSS results, minified HTML, URL response parsing, invalid input, timeout/abort recovery, navigation, subscription, and responsive accessibility.

## Daily Design-Engineering Digest

The working name, route, reader profile, model, tags, site URL, and source-removal contact are in `config/signal.json`. Rename the display name there; the storage and command names deliberately stay stable. `/signal` displays the latest published digest, `/signal/YYYY-MM-DD` a particular date, `/signal/archive` all available dates, and `/signal/rss.xml` the RSS feed. On Pages these live under `/okay-tools/`. No sample digest is published: the homepage preview displays an explicit empty state until real data exists.

### Run Locally

Use Node 22 or newer. Set `ANTHROPIC_API_KEY` in your shell environment or in the ignored, private `.env.local` file; never put it in source files. The CLI loads `.env.local` automatically without overriding exported environment variables. For a key not scoped to a workspace, set `ANTHROPIC_WORKSPACE_ID` or the optional `workspaceId` in `config/signal.json`; this is sent as the required `anthropic-workspace-id` header. Use the API workspace ID starting with `wrkspc_`, not an organization UUID. Configure the same ID as a GitHub repository variable for scheduled runs. Workspace-scoped keys do not require it. `ANTHROPIC_MODEL` optionally overrides the configured inexpensive Haiku model.

```sh
npm ci
npm run signal:build -- --dry-run
npm run signal:build
npm run build
npm run dev
```

Dry runs print ranks, scores, summaries, sources, tags, reasons, and token usage without writing anything. They still call the scoring API and incur its normal cost. The pipeline fetches feeds concurrently with a 10-second deadline per feed, uses only feed metadata, keeps the previous 36 hours, removes canonical-URL and near-title duplicates including every past digest, and scores at most 300 candidates in batches of 20. Scoring has a separate 60-second deadline and uses forced structured tool output. Invalid batch structure or an entirely rejected batch gets one retry; individual copied, overlong, or non-plain-text summaries are excluded without discarding other valid items. Weighted scores are rounded and capped at 100, with a minimum of 60 and at most 10 published items. A published date is immutable; rerunning that date prints the existing digest without API calls.

Files in `data/signal/YYYY-MM-DD.json` are the source of truth. `npm run signal:assets` builds the newest-first manifest and RSS in `public/signal`; `npm run build` does this automatically. Generated assets are not committed. Failed feeds/batches and excluded sources are logged. No digest is written if all feeds or all scoring batches fail; a successful run with no qualifying posts can publish an empty digest. No account, database, full-article scraper, or email digest is involved.

### Edit Sources And Scoring

Add/remove entries in `config/signal-sources.json`: `{ "name", "site", "feed", "weight" }`. Use `weight: 1.0` unless deliberately tuning a source. Deleting an entry stops future ingestion; historical attribution stays intact. A `null` feed is excluded and logged. Current feed discovery verified 18 sources; Emil Kowalski and Rauno Freiberg were unavailable and remain excluded. EightShapes uses its Medium publication; Linear and Supabase use the feeds advertised on their changelog pages. Feed availability can change.

```sh
npm run signal:build -- --discover --dry-run
npm run signal:build -- --discover
npm run signal:test
```

Discovery checks homepage RSS/Atom `<link rel="alternate">` metadata, then feed endpoint candidates, validating actual RSS/Atom XML. It never scrapes article content. Only explicit non-dry discovery updates source configuration. Edit `readerProfile` in `config/signal.json` to change relevance; editorial rules and untrusted-input handling live in `scripts/signal/scoring.mjs`. Summaries and reasons have strict word limits, fixed tags, and checks against copying excerpts.

### UI Verification

```sh
npm run build
npm run signal:test:ui
NETLIFY=true npm run build
SIGNAL_BASE_PATH=/ npm run signal:test:ui
```

The UI suite starts and stops its own production preview, checks populated digests through in-memory fixtures, and writes screenshots and accessibility reports to a temporary directory. It covers archive navigation, fallback/error states, 375px layouts, safe outbound links, the homepage card, and existing hash routes. Whole-page axe audits cover populated Signal; the homepage axe check covers only the new card, leaving existing previews unchanged. Lighthouse measures the real built manifest, which is empty until a digest is published. Install Chromium with `npx playwright install chromium` if no supported local browser is available.

### Scheduled Publishing

`.github/workflows/signal.yml` runs daily at 05:00 UTC and can be manually dispatched. GitHub schedules are best-effort and can be delayed. Enable Actions on the default branch, add repository secret `ANTHROPIC_API_KEY`, and permit workflow write access to contents/actions. Branch protection must allow the bot to publish generated JSON to `main`.

The workflow tests, builds the dated digest, verifies the production build, commits only `data/signal`, pushes, then explicitly dispatches the existing Pages deployment. This dispatch is required because `GITHUB_TOKEN` commits do not trigger push workflows. A Netlify site connected to `main` rebuilds on the push; alternatively configure repository secret `NETLIFY_BUILD_HOOK` for an explicit Netlify rebuild request. After this one-time setup, daily ingestion and deployment require no manual steps. Secrets are passed through environment variables and never logged. Remote Actions, scoring, and deployment require these credentials/configuration and cannot be validated by local unit tests.

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
