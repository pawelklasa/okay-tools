// Repo / folder scanner. Node-only.
//
// Walks a directory, skipping node_modules, build outputs, and .gitignore'd
// paths (best-effort: we read .gitignore if present and apply its lines as
// simple globs). For each visual-bearing file, extract observations and tag
// them with the file path so the worst-offender view is actionable.

import * as fs from "node:fs";
import * as path from "node:path";
import { extractObservationsFromCss } from "./parseCss.js";

const VISUAL_EXT = new Set([
  ".css", ".scss", ".sass", ".less",
  ".js", ".jsx", ".mjs", ".cjs",
  ".ts", ".tsx", ".mts", ".cts",
  ".vue", ".svelte", ".astro",
  ".html", ".htm",
  ".json", // tokens files
]);

const ALWAYS_SKIP = new Set([
  "node_modules", ".git", ".next", ".turbo", ".cache", ".parcel-cache",
  "dist", "build", "out", ".output", "coverage", ".nuxt", ".vercel",
  ".netlify", ".wrangler", ".svelte-kit", "storybook-static",
]);

/**
 * Read a .gitignore file into a simple matcher. We don't replicate full git
 * semantics — only literal directory names and simple suffix globs (`*.log`).
 * The point is to skip generated assets, not to be a gitignore reference impl.
 *
 * @param {string} root
 * @returns {(rel: string) => boolean}
 */
function loadGitignore(root) {
  const file = path.join(root, ".gitignore");
  if (!fs.existsSync(file)) return () => false;
  const lines = fs.readFileSync(file, "utf8").split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("!"));
  const dirs = new Set();
  const suffixes = [];
  const literals = new Set();
  for (const raw of lines) {
    const l = raw.replace(/^\/+/, "");
    if (l.startsWith("*.")) suffixes.push(l.slice(1));
    else if (l.endsWith("/")) dirs.add(l.slice(0, -1));
    else if (!l.includes("*")) literals.add(l);
  }
  return (rel) => {
    const parts = rel.split(path.sep);
    if (parts.some((p) => dirs.has(p) || literals.has(p))) return true;
    return suffixes.some((s) => rel.endsWith(s));
  };
}

/**
 * @param {string} root absolute folder path
 * @param {{ maxFiles?: number; maxBytes?: number; }} [opts]
 * @returns {{ observations: import('./types').RawObservation[], offenders: import('./types').OffenderFile[], filesScanned: number, bytesScanned: number, warnings: string[] }}
 */
export function scanRepo(root, opts = {}) {
  const maxFiles = opts.maxFiles ?? 5000;
  const maxBytes = opts.maxBytes ?? 50 * 1024 * 1024;
  const isIgnored = loadGitignore(root);

  /** @type {import('./types').RawObservation[]} */
  const observations = [];
  /** @type {Map<string, { hardcoded: number; distinct: Set<string> }>} */
  const perFile = new Map();
  /** @type {string[]} */
  const warnings = [];

  let filesScanned = 0;
  let bytesScanned = 0;

  /** @param {string} dir */
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (filesScanned >= maxFiles || bytesScanned >= maxBytes) return;
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full);
      if (ALWAYS_SKIP.has(entry.name)) continue;
      if (isIgnored(rel)) continue;

      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!VISUAL_EXT.has(ext)) continue;

      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      if (stat.size > 1024 * 1024) {
        warnings.push(`Skipped ${rel}: file >1MB`);
        continue;
      }
      let text;
      try { text = fs.readFileSync(full, "utf8"); } catch { continue; }
      bytesScanned += text.length;
      filesScanned++;

      const found = extractObservationsFromCss(text, { file: rel });
      if (found.length === 0) continue;

      const fileRec = perFile.get(rel) || { hardcoded: 0, distinct: new Set() };
      for (const obs of found) {
        observations.push(obs);
        // "Hardcoded" heuristic: raw value contains a literal #hex, rgb(),
        // hsl(), or an unbucketed px length — i.e. not a var(--…) reference.
        if (!/\bvar\(/.test(obs.raw)) fileRec.hardcoded++;
        fileRec.distinct.add(obs.raw.trim());
      }
      perFile.set(rel, fileRec);
    }
  }

  walk(root);

  const offenders = Array.from(perFile.entries())
    .map(([file, r]) => ({ file, hardcodedCount: r.hardcoded, distinctValues: r.distinct.size }))
    .sort((a, b) => b.hardcodedCount - a.hardcodedCount)
    .slice(0, 50);

  if (filesScanned >= maxFiles) warnings.push(`File cap reached (${maxFiles}); some files were skipped.`);
  if (bytesScanned >= maxBytes) warnings.push(`Byte cap reached; some files were skipped.`);

  return { observations, offenders, filesScanned, bytesScanned, warnings };
}
