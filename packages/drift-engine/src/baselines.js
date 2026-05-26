// Healthy baselines per category.
//
// Drift is not a feeling. It is a count against a stated baseline. Every
// number below comes from a published source (linked in README.md) or from
// the conservative, designer-defensible reading of one. If you disagree with
// a baseline, change it here — DO NOT silently re-weight the score.
//
// Convention:
//   - min: below this, the system is suspiciously sparse (rare in practice).
//   - max: above this, you are paying interest on drift.
//
// Sources (full citations in README.md):
//   USWDS: U.S. Web Design System tokens (spacing, sizing, colour ramp)
//   M3:    Material Design 3 (typography, elevation/shadow, spacing)
//   GitHub Primer: type ramp, shadow ramp, colour usage
//   Tailwind CSS defaults: spacing scale, colour ramp
//   zeroheight 2026 Design Systems Report: drift signals

/** @type {import('./types').Baselines} */
export const BASELINES = {
  // Greys / chromatic colours used as text.
  // M3 / Primer / USWDS all converge near 4-8 distinct text colours
  // (primary, secondary, disabled, link, inverse, on-colour, error, success).
  textColor: {
    min: 3,
    max: 8,
    source: "Material 3, GitHub Primer, USWDS converge on 4–8 text colours",
  },

  // Surface / background colours.
  // M3 has 5 surface tones + 1 background; Primer ~6; USWDS ~6.
  bgColor: {
    min: 3,
    max: 8,
    source: "Material 3 surface tones (5), Primer surface roles (~6)",
  },

  // Border / outline colours. Almost always 3–6 in healthy systems.
  borderColor: {
    min: 2,
    max: 6,
    source: "Primer border roles (default, muted, subtle, strong, on-emphasis)",
  },

  // Font families. Designers and engineers agree: 1 sans + 1 mono is the
  // boring honest answer. 2 is normal. 3 is a smell. 4+ is drift.
  fontFamily: {
    min: 1,
    max: 3,
    source: "Default in most production systems; >3 is a documented drift signal",
  },

  // Type scale steps.
  // M3 type scale: 15 roles but ~11 distinct sizes. Tailwind default: 13.
  // USWDS: 9. Primer: 8.
  // We are generous here: a rich type system can legitimately use ~12.
  fontSize: {
    min: 5,
    max: 12,
    source: "USWDS 9, Primer 8, Material 3 ~11, Tailwind default 13",
  },

  // Font weights. The honest answer is 2–4 (e.g. 400/500/600/700).
  fontWeight: {
    min: 2,
    max: 5,
    source: "Most systems ship 2–4 weights; >5 is variable-font sprawl",
  },

  // Line heights. 3–5 distinct values is the bell curve.
  lineHeight: {
    min: 2,
    max: 5,
    source: "Tailwind default: 6; Material 3: 5; Primer: 4",
  },

  // Spacing scale. Tailwind: 35 nominal but ~12-15 in actual use.
  // USWDS: 11. Primer: 10. M3: 12.
  // The interesting cliff is at ~20 — past that, every spacing is bespoke.
  spacing: {
    min: 6,
    max: 16,
    source: "USWDS 11, Primer 10, Material 3 12, Tailwind common-use ~14",
  },

  // Border radii.
  borderRadius: {
    min: 2,
    max: 6,
    source: "Tailwind default 8, Material 3 7, most production systems 3–5",
  },

  // Shadow steps.
  // M3 elevation: 6 levels (0–5). Tailwind: 6. Primer: 4.
  boxShadow: {
    min: 3,
    max: 6,
    source: "Material 3 elevation 0–5, Tailwind shadow scale 6 steps",
  },

  // Transition durations.
  transitionDuration: {
    min: 2,
    max: 5,
    source: "Material 3 motion tokens: 5 durations; most systems 3–4",
  },

  // z-index. A real system has ~4-6 stacking layers (base, dropdown, sticky,
  // modal-backdrop, modal, toast, tooltip). Above 8 in production is a smell;
  // values like z-index:9999 are not a design decision.
  zIndex: {
    min: 3,
    max: 8,
    source: "Bootstrap stacking layers: 7; Primer: 5; ad-hoc 9999s are drift",
  },
};
