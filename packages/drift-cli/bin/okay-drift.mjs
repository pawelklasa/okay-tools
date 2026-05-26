#!/usr/bin/env node
// okay-drift — the working surface.
//
// Run inside any project directory:
//   npx okay-drift
//   npx okay-drift --json
//   npx okay-drift --open                 # open the full result in the browser
//   npx okay-drift --tolerance 0.03
//   npx okay-drift ./packages/web
//
// Nothing leaves your machine. We respect .gitignore and skip node_modules
// and common build outputs.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";

import { scanRepo, score, CATEGORIES, CATEGORY_ORDER } from "../../drift-engine/src/index.js";

// --- tiny ansi (no chalk dep) ---
const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (open, close) => (s) => supportsColor ? `\u001b[${open}m${s}\u001b[${close}m` : s;
const ansi = {
  bold: wrap("1", "22"),
  dim: wrap("2", "22"),
  red: wrap("31", "39"),
  green: wrap("32", "39"),
  cyan: wrap("36", "39"),
};
const dim = (s) => ansi.dim(s);
const err = (s) => process.stderr.write(ansi.red(s) + "\n");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (flag("--help") || flag("-h")) {
  printHelp();
  process.exit(0);
}

const VALUED_FLAGS = new Set(["--tolerance"]);
const positionals = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith("--")) {
    if (VALUED_FLAGS.has(a)) i++; // skip its value
    continue;
  }
  positionals.push(a);
}
const target = positionals[0] || ".";
const rootArg = path.resolve(process.cwd(), target);
if (!fs.existsSync(rootArg) || !fs.statSync(rootArg).isDirectory()) {
  err(`Not a directory: ${rootArg}`);
  process.exit(2);
}

const config = {};
const tol = arg("--tolerance");
if (tol) config.colorToleranceDeltaE = parseFloat(tol);

const tStart = Date.now();
process.stderr.write(dim(`Scanning ${rootArg} ...\n`));
const scan = scanRepo(rootArg, {});
const report = score({
  mode: "repo",
  target: rootArg,
  observations: scan.observations,
  config,
  warnings: scan.warnings,
  offenders: scan.offenders,
});
const elapsed = Date.now() - tStart;

if (flag("--json")) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(0);
}

printHuman(report, scan, elapsed);

if (flag("--open")) {
  openInBrowser(report);
}

function printHuman(report, scan, elapsedMs) {
  const c = ansi;
  console.log("");
  console.log(c.bold(c.cyan("  okay-drift")) + c.dim(`  v0.1  ·  ${path.basename(report.target)}`));
  console.log("");
  console.log(
    `  ${c.bold(String(report.totalDistinct))} distinct values across ${c.bold(String(scan.filesScanned))} files` +
    c.dim(`  (${(scan.bytesScanned / 1024).toFixed(0)} KB in ${elapsedMs}ms)`)
  );
  if (report.overBudget > 0) {
    console.log(`  ${c.red("●")} ${c.bold(String(report.overBudget))} over baseline`);
  } else {
    console.log(`  ${c.green("●")} Within baseline`);
  }
  console.log("");
  console.log(c.dim("  " + "—".repeat(64)));
  console.log("");

  const w = Math.max(...CATEGORY_ORDER.map((k) => CATEGORIES[k].length));
  for (const cat of report.categories) {
    const label = CATEGORIES[cat.category].padEnd(w);
    const range = `${cat.baseline.min}–${cat.baseline.max}`;
    const count = String(cat.distinctCount).padStart(3);
    const marker =
      cat.status === "over" ? c.red("over ") :
      cat.status === "under" ? c.dim("under") : c.green("ok   ");
    const delta = cat.status === "over" ? c.red(` +${cat.delta}`) : "";
    console.log(`  ${label}  ${c.bold(count)}  ${c.dim(`baseline ${range}`)}  ${marker}${delta}`);
  }

  if (report.offenders && report.offenders.length) {
    console.log("");
    console.log(c.dim("  " + "—".repeat(64)));
    console.log("");
    console.log(c.bold("  Worst offender files") + c.dim(" (most hardcoded values)"));
    console.log("");
    for (const off of report.offenders.slice(0, 10)) {
      console.log(`    ${c.dim(String(off.hardcodedCount).padStart(4))}  ${off.file}`);
    }
  }

  if (report.warnings.length) {
    console.log("");
    for (const w of report.warnings) console.log(c.dim(`  ! ${w}`));
  }

  console.log("");
  console.log(c.dim(`  tolerance ΔE ≤ ${report.config.colorToleranceDeltaE}  ·  ${report.rulesApplied.length} normalisation rules applied`));
  console.log(c.dim("  Run with --open to view the full result, swatches, and method panel in the browser."));
  console.log("");
}

function openInBrowser(report) {
  // Write the report as a temp JSON file and open the /drift page with a
  // ?import= pointer. The web page reads the file via fetch(file://) when
  // possible, otherwise we just print the path for manual import.
  const tmp = path.join(os.tmpdir(), `okay-drift-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(report, null, 2));
  console.log(ansi.dim(`  Wrote ${tmp}`));
  console.log(ansi.dim("  Open https://okay.tools/#/drift  and paste the file under \u201CImport CLI report\u201D."));

  const opener =
    process.platform === "darwin" ? `open` :
    process.platform === "win32"  ? `start` : `xdg-open`;
  try {
    spawn(opener, ["https://okay.tools/#/drift?source=cli"], { stdio: "ignore", detached: true }).unref();
  } catch { /* ignore */ }
}

function printHelp() {
  console.log(`
  okay-drift — measure design-system drift in your codebase

  Usage
    npx okay-drift [path]              scan a folder (default: cwd)
    npx okay-drift --json              machine-readable output
    npx okay-drift --open              also open the result in the browser
    npx okay-drift --tolerance 0.02    perceptual ΔE colour tolerance

  Nothing leaves your machine. node_modules and .gitignore'd paths are skipped.
  Method, baselines, and citations: https://okay.tools/#/drift
`);
}
