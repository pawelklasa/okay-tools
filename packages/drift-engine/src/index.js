// Public surface of the drift-engine.
//
// One engine. Three input modes (CLI repo scan, paste, URL via headless
// browser). All three converge here:
//
//   raw observations -> normalize() -> score() -> DriftReport
//
// The credibility of the entire tool rests on these few hundred lines. Keep
// them small, transparent, and well-commented.

export { normalize, RULES } from "./normalize.js";
export { score, CATEGORY_ORDER, CATEGORIES } from "./score.js";
export { BASELINES } from "./baselines.js";
export { parseCss, extractObservationsFromCss } from "./parseCss.js";
export { scanRepo } from "./scanRepo.js";
export {
  DEFAULT_CONFIG,
  configWithDefaults,
} from "./config.js";
