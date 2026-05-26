// Scoring. Combines normalised buckets with stated baselines into a final
// DriftReport. No magic, no composite score: every number is count vs. range.

import { BASELINES } from "./baselines.js";
import { normalize, RULES } from "./normalize.js";
import { configWithDefaults } from "./config.js";
import { parseColorToOklch, oklchDeltaE } from "./colorMath.js";

/** @type {import('./types').Category[]} */
export const CATEGORY_ORDER = [
  "textColor",
  "bgColor",
  "borderColor",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "spacing",
  "borderRadius",
  "boxShadow",
  "transitionDuration",
  "zIndex",
];

export const CATEGORIES = /** @type {Record<import('./types').Category, string>} */ ({
  textColor:          "Text colours",
  bgColor:            "Background colours",
  borderColor:        "Border colours",
  fontFamily:         "Font families",
  fontSize:           "Font sizes",
  fontWeight:         "Font weights",
  lineHeight:         "Line heights",
  spacing:            "Spacing values",
  borderRadius:       "Border radii",
  boxShadow:          "Box shadows",
  transitionDuration: "Transition durations",
  zIndex:             "z-index values",
});

const COLOUR_CATS = new Set(["textColor", "bgColor", "borderColor"]);

/**
 * Count near-duplicate pairs within one colour category. A pair counts when
 * two post-dedup values are between `tolerance` and `tolerance * 2.5` apart
 * in OKLab \u0394E \u2014 close enough that a designer would call them "the same
 * grey" but far enough that the strict dedup left them as distinct values.
 * This is the signal the headline needs to call out drift that the
 * per-category count alone misses (e.g. five near-identical greys all
 * separately listed but still inside the baseline range).
 *
 * @param {import('./types').NormalizedValue[]} values
 * @param {number} tolerance
 * @returns {number} pair count
 */
function countNearDuplicatePairs(values, tolerance) {
  const oklchs = values
    .map((v) => parseColorToOklch(v.display.split("@")[0]))
    .filter((x) => x != null);
  let pairs = 0;
  const lo = tolerance;
  const hi = tolerance * 2.5;
  for (let i = 0; i < oklchs.length; i++) {
    for (let j = i + 1; j < oklchs.length; j++) {
      const d = oklchDeltaE(oklchs[i], oklchs[j]);
      if (d > lo && d <= hi) pairs++;
    }
  }
  return pairs;
}

/**
 * @param {object} input
 * @param {"repo"|"paste"|"url"} input.mode
 * @param {string} input.target
 * @param {import('./types').RawObservation[]} input.observations
 * @param {Partial<import('./types').NormalizationConfig>=} input.config
 * @param {string[]=} input.warnings
 * @param {string[]=} input.thirdPartyExclusions
 * @param {import('./types').OffenderFile[]=} input.offenders
 * @returns {import('./types').DriftReport}
 */
export function score(input) {
  const config = configWithDefaults(input.config);
  const buckets = normalize(input.observations || [], config);

  /** @type {import('./types').CategoryReport[]} */
  const categories = CATEGORY_ORDER.map((cat) => {
    const m = buckets.get(cat) || new Map();
    const values = Array.from(m.values()).sort((a, b) => b.occurrences - a.occurrences);
    const baseline = BASELINES[cat];
    const distinctCount = values.length;

    // Delta is POSITIVE ONLY. A count below baseline.min is not "negative
    // drift" \u2014 it means the system is sparse, which is a separate signal,
    // not a defect. Drift is too many distinct values.
    const delta = Math.max(0, distinctCount - baseline.max);

    /** @type {"over"|"ok"|"unused"} */
    const status =
      distinctCount === 0       ? "unused" :
      distinctCount > baseline.max ? "over" :
      "ok";

    const nearDuplicateClusters = COLOUR_CATS.has(cat)
      ? countNearDuplicatePairs(values, config.colorToleranceDeltaE)
      : 0;

    return { category: cat, distinctCount, values, baseline, delta, status, nearDuplicateClusters };
  });

  const totalDistinct = categories.reduce((n, c) => n + c.distinctCount, 0);
  const totalObservations = categories.reduce(
    (n, c) => n + c.values.reduce((nn, v) => nn + v.occurrences, 0), 0
  );
  const overBudget = categories.reduce((n, c) => n + c.delta, 0);
  const nearDuplicateClusters = categories.reduce((n, c) => n + c.nearDuplicateClusters, 0);

  // Worst category: highest positive delta. If none over budget, fall back to
  // the category with the most near-duplicate clusters. If nothing is wrong,
  // null \u2014 the headline will say "within baseline".
  let worstCategory = null;
  const over = categories.filter((c) => c.delta > 0).sort((a, b) => b.delta - a.delta);
  if (over.length > 0) {
    worstCategory = over[0].category;
  } else {
    const ndup = categories
      .filter((c) => c.nearDuplicateClusters > 0)
      .sort((a, b) => b.nearDuplicateClusters - a.nearDuplicateClusters);
    if (ndup.length > 0) worstCategory = ndup[0].category;
  }

  return {
    mode: input.mode,
    target: input.target,
    generatedAt: new Date().toISOString(),
    config,
    categories,
    rulesApplied: RULES.slice(),
    warnings: input.warnings || [],
    thirdPartyExclusions: input.thirdPartyExclusions || [],
    offenders: input.offenders,
    totalDistinct,
    totalObservations,
    overBudget,
    nearDuplicateClusters,
    worstCategory,
  };
}
