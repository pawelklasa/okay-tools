// Type surface for the drift engine. The runtime is JavaScript so these are
// only used by TypeScript consumers (the web app, the CLI under tsc, IDEs).

export type Category =
  | "textColor"
  | "bgColor"
  | "borderColor"
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "lineHeight"
  | "spacing"
  | "borderRadius"
  | "boxShadow"
  | "transitionDuration"
  | "zIndex";

export interface NormalizationConfig {
  colorToleranceDeltaE: number;
  spacingBucketPx: number;
  spacingMinPx: number;
  dropTransparent: boolean;
  collapseShorthand: boolean;
  ignoreHidden: boolean;
  excludeThirdParty: boolean;
  samplesPerValue: number;
}

export interface RawObservation {
  category: Category;
  raw: string;
  /** Where it came from. file+line for repo/paste, selector/tag for URL mode. */
  source?: {
    file?: string;
    line?: number;
    selector?: string;
    tag?: string;
    role?: "stylesheet" | "inline" | "computed";
  };
}

export interface NormalizedValue {
  /** Stable bucket key. Two observations with the same key are "the same value". */
  key: string;
  /** Human-readable representation (e.g. "#3a3a3a", "16px", "Inter"). */
  display: string;
  category: Category;
  /** Original raw inputs that mapped to this bucket. */
  occurrences: number;
  samples: RawObservation[];
}

export interface BaselineRange {
  /** Healthy lower bound (a system smaller than this is suspiciously sparse). */
  min: number;
  /** Healthy upper bound. Above this is drift. */
  max: number;
  /** Human source citation, shown in the method panel. */
  source: string;
}

export type Baselines = Record<Category, BaselineRange>;

export interface CategoryReport {
  category: Category;
  distinctCount: number;
  values: NormalizedValue[];
  baseline: BaselineRange;
  /**
   * Drift contribution. POSITIVE ONLY: max(0, distinctCount - baseline.max).
   * Below-baseline counts are NOT reported as negative drift. Drift is too
   * many distinct values, never too few.
   */
  delta: number;
  /**
   * `over`    : distinctCount > baseline.max (drift)
   * `ok`      : within baseline OR below baseline (a sparse system is not drift)
   * `unused`  : distinctCount === 0 (category not defined in input)
   */
  status: "over" | "ok" | "unused";
  /**
   * Pairs of post-dedup colour values that survived the ΔE threshold but are
   * still suspiciously close (within `colorToleranceDeltaE × 2.5`). Each pair
   * is one "near-duplicate cluster" — a sign that two near-identical greys
   * are being treated as distinct decisions when they probably are the same
   * decision drifted. Colour categories only; 0 otherwise.
   */
  nearDuplicateClusters: number;
}

export interface OffenderFile {
  file: string;
  hardcodedCount: number;
  /** Distinct values found in this file. */
  distinctValues: number;
}

export interface DriftReport {
  mode: "repo" | "paste" | "url";
  target: string;
  generatedAt: string;
  config: NormalizationConfig;
  categories: CategoryReport[];
  rulesApplied: string[];
  warnings: string[];
  thirdPartyExclusions: string[];
  offenders?: OffenderFile[];
  /** Total distinct values across all categories. */
  totalDistinct: number;
  /** Total observations seen (before bucketing). */
  totalObservations: number;
  /** Sum of (delta where positive). The headline drift number. */
  overBudget: number;
  /** Sum of nearDuplicateClusters across categories (colour categories only). */
  nearDuplicateClusters: number;
  /**
   * The single most over-budget category (highest delta), or the category
   * with the most near-duplicate clusters if no category is over budget,
   * or null if the input is clean. Drives the headline copy.
   */
  worstCategory: Category | null;
}
