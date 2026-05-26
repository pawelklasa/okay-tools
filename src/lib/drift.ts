// Bridge between the TS-only web app and the JS drift-engine package.
// We re-export under typed names so TSX consumers see a normal TS module.
// We deliberately import from individual submodules (not index.js) to avoid
// pulling the Node-only scanRepo.js into the browser bundle.

// @ts-expect-error — JS module with .d.ts adjacent
import * as scoreMod from "../../packages/drift-engine/src/score.js";
// @ts-expect-error — JS module
import * as parseMod from "../../packages/drift-engine/src/parseCss.js";
// @ts-expect-error — JS module
import * as normMod from "../../packages/drift-engine/src/normalize.js";
// @ts-expect-error — JS module
import * as baseMod from "../../packages/drift-engine/src/baselines.js";
// @ts-expect-error — JS module
import * as cfgMod from "../../packages/drift-engine/src/config.js";

const engine = {
  ...scoreMod,
  ...parseMod,
  ...normMod,
  ...baseMod,
  ...cfgMod,
};

export type Category =
  | "textColor" | "bgColor" | "borderColor" | "fontFamily"
  | "fontSize" | "fontWeight" | "lineHeight" | "spacing"
  | "borderRadius" | "boxShadow" | "transitionDuration" | "zIndex";

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
  source?: { file?: string; line?: number; selector?: string; tag?: string; role?: string };
}

export interface NormalizedValue {
  key: string;
  display: string;
  category: Category;
  occurrences: number;
  samples: RawObservation[];
}

export interface BaselineRange { min: number; max: number; source: string }

export interface CategoryReport {
  category: Category;
  distinctCount: number;
  values: NormalizedValue[];
  baseline: BaselineRange;
  /** Positive only: max(0, distinctCount - baseline.max). */
  delta: number;
  status: "over" | "ok" | "unused";
  /** Colour categories only: pairs within tolerance × (1, 2.5]. */
  nearDuplicateClusters: number;
}

export interface OffenderFile { file: string; hardcodedCount: number; distinctValues: number }

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
  totalDistinct: number;
  totalObservations: number;
  overBudget: number;
  nearDuplicateClusters: number;
  worstCategory: Category | null;
}

export const parseCss = engine.parseCss as (text: string, meta?: { file?: string }) => RawObservation[];
export const score = engine.score as (input: {
  mode: "repo" | "paste" | "url";
  target: string;
  observations: RawObservation[];
  config?: Partial<NormalizationConfig>;
  warnings?: string[];
  thirdPartyExclusions?: string[];
  offenders?: OffenderFile[];
}) => DriftReport;
export const CATEGORIES = engine.CATEGORIES as Record<Category, string>;
export const CATEGORY_ORDER = engine.CATEGORY_ORDER as Category[];
export const BASELINES = engine.BASELINES as Record<Category, BaselineRange>;
export const DEFAULT_CONFIG = engine.DEFAULT_CONFIG as NormalizationConfig;
