import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../src/score.js";
import { BASELINES } from "../src/baselines.js";

test("score returns a report with all categories", () => {
  const report = score({ mode: "paste", target: "test", observations: [] });
  assert.equal(report.categories.length, 12);
  for (const cat of report.categories) {
    assert.equal(cat.distinctCount, 0);
    assert.equal(cat.baseline.max, BASELINES[cat.category].max);
  }
});

test("over-budget greys are flagged as `over`", () => {
  // 12 visibly distinct greys, baseline.max for textColor is 8 → over.
  const obs = [
    "#111", "#222", "#333", "#444", "#555", "#666",
    "#777", "#888", "#999", "#aaa", "#bbb", "#ccc",
  ].map((raw) => ({ category: "textColor", raw }));
  const report = score({ mode: "paste", target: "t", observations: obs });
  const text = report.categories.find((c) => c.category === "textColor");
  assert.equal(text.distinctCount, 12);
  assert.equal(text.status, "over");
  assert.equal(text.delta, 12 - BASELINES.textColor.max);
});

test("overBudget headline sums positive deltas across categories", () => {
  const obs = [
    ...["#111", "#222", "#333", "#444", "#555", "#666", "#777", "#888", "#999"]
      .map((raw) => ({ category: "textColor", raw })), // 9 vs max 8 → +1
    ...Array.from({ length: 8 }, (_, i) => ({ category: "fontFamily", raw: `Font${i}` })), // 8 vs max 3 → +5
  ];
  const report = score({ mode: "paste", target: "t", observations: obs });
  assert.equal(report.overBudget, 1 + 5);
});

test("rulesApplied is always present and non-empty", () => {
  const report = score({ mode: "paste", target: "t", observations: [] });
  assert.ok(report.rulesApplied.length > 5);
});

test("config defaults round-trip through report", () => {
  const report = score({ mode: "paste", target: "t", observations: [], config: { colorToleranceDeltaE: 0.05 } });
  assert.equal(report.config.colorToleranceDeltaE, 0.05);
  assert.equal(report.config.dropTransparent, true); // default preserved
});
