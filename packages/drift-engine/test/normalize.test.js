import test from "node:test";
import assert from "node:assert/strict";
import { parseColorToOklch, oklchDeltaE, oklchToHex } from "../src/colorMath.js";
import { normalize, __test } from "../src/normalize.js";
import { configWithDefaults } from "../src/config.js";

test("hex, rgb, and named colours that mean the same thing parse to the same OKLCH", () => {
  const a = parseColorToOklch("#ff0000");
  const b = parseColorToOklch("rgb(255, 0, 0)");
  const c = parseColorToOklch("red");
  assert.ok(a && b && c);
  assert.ok(oklchDeltaE(a, b) < 0.001, "hex === rgb");
  assert.ok(oklchDeltaE(a, c) < 0.001, "hex === named");
});

test("near-duplicate greys bucket together within 0.02 ΔE", () => {
  const cfg = configWithDefaults({ colorToleranceDeltaE: 0.02 });
  const obs = [
    { category: "textColor", raw: "#333333" },
    { category: "textColor", raw: "#343434" }, // perceptually identical
    { category: "textColor", raw: "rgb(51, 51, 51)" }, // === #333
  ];
  const out = normalize(obs, cfg);
  assert.equal(out.get("textColor").size, 1, "three near-identical greys should bucket to one");
  const v = Array.from(out.get("textColor").values())[0];
  assert.equal(v.occurrences, 3);
});

test("clearly distinct greys do NOT bucket together", () => {
  const cfg = configWithDefaults({ colorToleranceDeltaE: 0.02 });
  const obs = [
    { category: "textColor", raw: "#222" },
    { category: "textColor", raw: "#666" }, // visibly different
    { category: "textColor", raw: "#aaa" },
  ];
  const out = normalize(obs, cfg);
  assert.equal(out.get("textColor").size, 3);
});

test("transparent values are dropped", () => {
  const cfg = configWithDefaults({});
  const obs = [
    { category: "bgColor", raw: "transparent" },
    { category: "bgColor", raw: "rgba(0,0,0,0)" },
    { category: "bgColor", raw: "#000" },
  ];
  const out = normalize(obs, cfg);
  assert.equal(out.get("bgColor").size, 1);
});

test("px and rem of equivalent magnitude bucket to the same spacing value", () => {
  const cfg = configWithDefaults({});
  const obs = [
    { category: "spacing", raw: "16px" },
    { category: "spacing", raw: "1rem" }, // 16px assumed
  ];
  const out = normalize(obs, cfg);
  assert.equal(out.get("spacing").size, 1);
});

test("hairline (sub-spacingMinPx) values are dropped from spacing", () => {
  const cfg = configWithDefaults({ spacingMinPx: 2 });
  const obs = [
    { category: "spacing", raw: "1px" },
    { category: "spacing", raw: "0.5px" },
    { category: "spacing", raw: "8px" },
  ];
  const out = normalize(obs, cfg);
  assert.equal(out.get("spacing").size, 1);
});

test("font weight `normal` and `400` are the same bucket", () => {
  const out = normalize(
    [{ category: "fontWeight", raw: "normal" }, { category: "fontWeight", raw: "400" }],
    configWithDefaults({})
  );
  assert.equal(out.get("fontWeight").size, 1);
});

test("font family ignores fallback stack", () => {
  const out = normalize(
    [
      { category: "fontFamily", raw: '"Inter", system-ui, sans-serif' },
      { category: "fontFamily", raw: "Inter, Helvetica" },
    ],
    configWithDefaults({})
  );
  assert.equal(out.get("fontFamily").size, 1);
});

test("transition durations normalise across units", () => {
  const out = normalize(
    [
      { category: "transitionDuration", raw: "200ms" },
      { category: "transitionDuration", raw: "0.2s" },
    ],
    configWithDefaults({})
  );
  assert.equal(out.get("transitionDuration").size, 1);
});

test("oklchToHex round-trip stays close on a known sRGB grey", () => {
  const ok = parseColorToOklch("#5b5b5b");
  const hex = oklchToHex(ok);
  // Within 1 byte channel after sRGB <-> linear <-> Oklab round-trip
  const ok2 = parseColorToOklch(hex);
  assert.ok(oklchDeltaE(ok, ok2) < 0.005);
});

test("lengthToPx handles px, rem, em, pt, percent", () => {
  const { lengthToPx } = __test;
  assert.equal(lengthToPx("16px"), 16);
  assert.equal(lengthToPx("1rem"), 16);
  assert.equal(lengthToPx("1em"), 16);
  assert.equal(lengthToPx("12pt"), 16);
  assert.equal(lengthToPx("50%"), null);
  assert.equal(lengthToPx(""), null);
});
