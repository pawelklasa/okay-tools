# Drift Score

**One transparent number for how much your design system has drifted from itself.**

Drift is not a feeling — it is a count. Drift Score takes a CSS file, a repository,
or a live URL, normalises every distinct value it finds (with stated rules), and
compares the counts against published baselines (USWDS, Material 3, GitHub Primer,
Tailwind, Bootstrap).

The scoring method must be transparent and defensible above everything else.
That is the entire purpose of this package. Read this file before trusting the
number.

---

## Three inputs, one engine

```
   raw observations  ->  normalize()  ->  score()  ->  DriftReport
```

| Input mode | How it collects observations                                   |
| ---------- | -------------------------------------------------------------- |
| **CLI**    | `npx okay-drift ./path` walks the repo, parses CSS/JSX/HTML    |
| **Paste**  | Same parser as CLI, in the browser                             |
| **URL**    | A headless Chromium reads computed styles of visible elements  |

All three converge on the same normalisation and the same baselines. There is no
mode-specific weighting.

---

## What gets counted

12 categories, in this order:

1. `textColor`
2. `bgColor`
3. `borderColor`
4. `fontFamily`
5. `fontSize`
6. `fontWeight`
7. `lineHeight`
8. `spacing` (margin, padding, gap)
9. `borderRadius`
10. `boxShadow`
11. `transitionDuration`
12. `zIndex`

For each category we report `count` (distinct values after normalisation), the
baseline `min/max`, and `delta` (positive = over budget). `overBudget` is the
simple sum of positive deltas across categories. That is the headline number.

There is **no hidden weighting**. If a category's delta is +3, that is +3 to the
headline. You can re-derive the headline from the breakdown table by hand.

---

## Normalisation rules

Each rule below appears in `report.rulesApplied`. They are emitted on every run
so you can see exactly what was done.

### Colour

- All colour observations are parsed into **OKLCH** (Björn Ottosson, 2020).
- Two colours are considered the same iff their **ΔE in OKLab is ≤ 0.02** by
  default. 0.02 is roughly the smallest difference a calibrated monitor can
  resolve; on real screens it is imperceptible. The threshold is configurable
  via the UI slider or the `--tolerance` CLI flag.
- This is the single most important rule in the tool: a system with 14
  near-identical greys (`#2a2a2e`, `#2b2b2f`, `#2c2c30` …) is reported as
  **1 colour, with 13 duplicates** — not 14 colours.
- Cross-bucket merge: after initial bucketing the engine re-merges any pair of
  representative colours that are still within ΔE, so values that fell on
  opposite sides of a grid boundary do not split.
- `transparent`, `rgba(_, 0)`, and similar are dropped before bucketing.

### Lengths (spacing, font-size, line-height, radius)

- `px`, `rem` (assumed 16px root), `em`, `pt` are normalised to a common unit.
- Spacing values are bucketed to the nearest **1px** by default; the bucket
  size is configurable.
- `0` and very small values (< 1px) are not counted as distinct spacing values.

### Font families

- Stack lists are split on commas; only the first non-quoted family is counted.
- `inherit`, `system-ui`, and the generic families (`sans-serif`, `serif`,
  `monospace`) are normalised so they do not double-count.

### Font weights

- Keywords (`normal`, `bold`) are mapped to numeric (400, 700) before counting.

### Shadows

- Each `box-shadow` value (full string) is one observation. Multi-shadow values
  (comma-separated) are kept as one value, since the shadow's identity is the
  whole stack.

### z-index

- Numeric values only; `auto` is dropped.

---

## Baselines and citations

| Category             | min | max | Source                                                                |
| -------------------- | --: | --: | --------------------------------------------------------------------- |
| `textColor`          |   3 |   8 | Material 3, GitHub Primer, USWDS converge on 4–8 text colours         |
| `bgColor`            |   3 |   8 | Material 3 surface tones (5), Primer surface roles (~6)               |
| `borderColor`        |   2 |   6 | Primer border roles (default/muted/subtle/strong/on-emphasis)         |
| `fontFamily`         |   1 |   3 | Default in production systems; >3 is a documented drift signal        |
| `fontSize`           |   5 |  12 | USWDS 9, Primer 8, Material 3 ~11, Tailwind default 13                |
| `fontWeight`         |   2 |   5 | Most systems ship 2–4 weights; >5 is variable-font sprawl             |
| `lineHeight`         |   2 |   5 | Tailwind default 6; Material 3: 5; Primer: 4                          |
| `spacing`            |   6 |  16 | USWDS 11, Primer 10, Material 3 12, Tailwind common-use ~14           |
| `borderRadius`       |   2 |   6 | Tailwind default 8, Material 3 7, most production systems 3–5         |
| `boxShadow`          |   3 |   6 | Material 3 elevation 0–5, Tailwind shadow scale 6 steps               |
| `transitionDuration` |   2 |   5 | Material 3 motion tokens: 5 durations; most systems 3–4               |
| `zIndex`             |   3 |   8 | Bootstrap stacking layers: 7; Primer: 5; ad-hoc `9999`s are drift     |

If you disagree with a number, edit `src/baselines.js`. Do not silently re-weight
the score in code — change the citation.

`zeroheight 2026 Design Systems Report` informs which signals matter (drift,
duplicate values, ad-hoc `9999` z-indexes).

---

## CLI

```sh
npx okay-drift                # scan current directory
npx okay-drift ./packages     # scan a path
npx okay-drift --json         # emit machine-readable report
npx okay-drift --tolerance 0.05   # widen the ΔE colour bucket
```

The CLI is the primary, most-polished mode. It returns a non-zero exit code
when any category is over budget — wire it into CI.

It honours `.gitignore` and additionally skips `node_modules`, `dist`, `build`,
`.next`, `.cache`, `coverage`, `out`, and binary asset folders by default.

## Paste mode

Open `/drift` in okay.tools and paste any CSS, SCSS, JSX, or HTML. Same parser
as the CLI, runs entirely in the browser. Nothing is sent to a server.

## URL mode

`POST /api/drift-scan` (Netlify Function) launches headless Chromium, navigates
to the URL, waits for `networkidle`, and reads `getComputedStyle()` for every
visible element (capped at 5000). Third-party iframes/embeds are excluded by
host and listed in the report.

URL mode requires `playwright-core` in the deployment environment. In local
dev a Vite middleware mirrors the function — install `playwright-core` as a
dev dependency to enable it.

---

## Known limitations

These are written down so you can decide whether the number is meaningful for
your codebase.

- **Tailwind arbitrary values.** Repo-mode parses CSS-shaped tokens. Inline
  utility classes like `text-[13px]` are not counted as a `fontSize`
  observation. If you use a lot of arbitrary-value utilities, paste the compiled
  CSS or use URL mode.
- **CSS variables.** A `--bg: #2a2a2e` declaration counts the value once.
  References (`var(--bg)`) are not separately counted. This is intentional:
  drift is about distinct *resolved* values, and the resolved value is the
  declaration.
- **Dynamic styles.** Anything injected after `networkidle` (e.g. lazy-loaded
  charts) is not captured by URL mode.
- **Element cap.** URL mode stops at 5000 visible elements. A warning is added
  to the report when this happens.
- **No semantic naming check.** Drift Score does not know whether your token is
  called `--surface-2` or `--gray-200-but-actually-the-card-bg`. That is a
  separate tool (see `/defaults` on okay.tools).

---

## Tests

```sh
node --test packages/drift-engine/test/*.test.js
```

21 tests cover normalisation, scoring, and the parser. They are intentionally
written before any UI.

---

## Licence

MIT.
