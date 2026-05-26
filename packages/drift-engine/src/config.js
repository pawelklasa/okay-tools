// Default normalisation configuration. Every value here MUST appear in the
// "method" panel of the result UI so a reader can independently verify the
// number. If you change a default, write down WHY in the README.

/** @type {import('./types').NormalizationConfig} */
export const DEFAULT_CONFIG = {
  // Perceptual colour tolerance, in OKLCH ΔE.
  //
  // 0.02 is roughly "you cannot reliably tell these two greys apart on a
  // calibrated monitor at normal viewing distance". 0.04 is "a designer
  // squinting can tell, a user can't". We chose 0.02 to bias toward
  // OVER-counting greys (more conservative against false claims of drift)
  // and to make the swatch view visually convincing. Tune in /drift UI.
  colorToleranceDeltaE: 0.02,

  // Spacing bucket in CSS pixels. Sub-pixel differences are noise.
  spacingBucketPx: 1,

  // Min spacing (px) to count at all. 0 and very-small paddings (1-2px borders
  // hairlines etc.) are not "spacing decisions" and shouldn't pollute the count.
  spacingMinPx: 2,

  // Drop fully transparent colours. They are not a design choice; they are
  // the absence of one.
  dropTransparent: true,

  // Collapse longhand into shorthand-equivalent counts. padding-top:8px and
  // padding:8px contribute one observation each, but the *distinct value*
  // they normalise to is the same number.
  collapseShorthand: true,

  // Skip elements rendered with display:none, visibility:hidden, or zero
  // bounding box. Only meaningful in URL mode. Pure-CSS modes can't tell.
  ignoreHidden: true,

  // Exclude third-party iframes and embeds from the count. They are reported
  // separately so no one can say we counted YouTube's CSS as drift.
  excludeThirdParty: true,

  // Maximum samples kept per distinct value, for the swatch view and offender
  // list. Counts themselves are unaffected.
  samplesPerValue: 6,
};

/**
 * @param {Partial<import('./types').NormalizationConfig> | undefined} partial
 * @returns {import('./types').NormalizationConfig}
 */
export function configWithDefaults(partial) {
  return { ...DEFAULT_CONFIG, ...(partial || {}) };
}
