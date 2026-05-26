import test from "node:test";
import assert from "node:assert/strict";
import { extractObservationsFromCss } from "../src/parseCss.js";
import { score } from "../src/score.js";

test("extracts colours from CSS declarations", () => {
  const css = `
    .a { color: #fff; background-color: rgb(20, 20, 20); border: 1px solid #333; }
    .b { color: red; }
  `;
  const obs = extractObservationsFromCss(css);
  const text = obs.filter((o) => o.category === "textColor").map((o) => o.raw);
  assert.ok(text.includes("#fff"));
  assert.ok(text.includes("red"));
  const bg = obs.filter((o) => o.category === "bgColor").map((o) => o.raw);
  assert.ok(bg.some((v) => v.startsWith("rgb(")));
});

test("extracts spacing from shorthand padding/margin/gap", () => {
  const css = `
    .a { padding: 8px 16px; margin-top: 24px; gap: 12px; }
  `;
  const obs = extractObservationsFromCss(css);
  const spacing = obs.filter((o) => o.category === "spacing").map((o) => o.raw);
  assert.deepEqual(spacing.sort(), ["12px", "16px", "24px", "8px"]);
});

test("extracts box-shadow as a single observation per declaration", () => {
  const css = `.a { box-shadow: 0 1px 2px rgba(0,0,0,0.1); }`;
  const obs = extractObservationsFromCss(css);
  const sh = obs.filter((o) => o.category === "boxShadow");
  assert.equal(sh.length, 1);
});

test("inline style attributes in JSX/HTML are parsed", () => {
  const jsx = `<div style="color: #888; padding: 10px"></div>`;
  const obs = extractObservationsFromCss(jsx);
  assert.ok(obs.some((o) => o.category === "textColor" && o.raw === "#888"));
  assert.ok(obs.some((o) => o.category === "spacing" && o.raw === "10px"));
});

test("end-to-end: paste a small CSS file and get a report", () => {
  const css = `
    :root { --bg: #0f1115; --fg: #f5f5f7; }
    body { color: #f5f5f7; background: #0f1115; font-family: Inter, sans-serif; }
    h1 { font-size: 32px; font-weight: 700; line-height: 1.1; }
    p  { font-size: 16px; font-weight: 400; line-height: 1.5; color: #c9c9d1; }
    .card { padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    a { color: #5ec3ff; transition: color 200ms ease; }
  `;
  const obs = extractObservationsFromCss(css);
  const r = score({ mode: "paste", target: "test.css", observations: obs });
  // Sanity: at least three text colours (white, muted, link), one font family,
  // a couple of font sizes, a shadow, a duration.
  const find = (c) => r.categories.find((x) => x.category === c).distinctCount;
  assert.ok(find("textColor") >= 2, `textColor count ${find("textColor")}`);
  assert.ok(find("fontSize") >= 2);
  assert.ok(find("fontFamily") >= 1);
  assert.ok(find("boxShadow") >= 1);
  assert.ok(find("transitionDuration") >= 1);
});
