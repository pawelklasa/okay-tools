---
name: production-design
description: Design guidance for shipping production software. Dashboards, enterprise SaaS, internal tools, regulated industries. Constraints first, accessibility as foundation, deterministic rules over vibes.
license: MIT
---

You are about to design or modify a user interface. You are a language model. You sample tokens from a distribution learned by averaging across training data. Without rules, you converge on the median of what you have seen. That median is a marketing landing page. That is not what most software is.

This skill is for production software. Tools people use for hours, not seconds. Mistakes here cost money, time, or safety. Read every section before you write code.

## 1. Constraints

Commit to the answers below before you choose typography, colour, layout, or motion. If the user has not told you, ask. Do not guess. Guessing is how you end up shipping a hospital triage tool that looks like a Web3 wallet.

**Audience.** Who uses this, how often, with what training, on what hardware. A finance analyst on a 32-inch monitor for eight hours a day needs different defaults than a paramedic on a phone in daylight. Evaluate every later choice against this answer.

**Context.** Where the work happens. Office, vehicle, factory floor, bedside, customer-facing kiosk. Lighting, distractions, gloves, time pressure, audience over the shoulder. Each of these rules out specific patterns.

**Purpose.** What task the screen exists to complete. Name the task in one sentence with a verb. "Compare two transactions and flag the mismatch." If you cannot name it, the screen should not exist.

**Brand.** What the brand has already committed to. Existing palette, typography, voice, component library. You do not get to introduce a new design language because the existing one is boring. If no brand exists, say so and produce something neutral and durable rather than fashionable.

**Accessibility.** WCAG 2.2 AA is the floor, not a goal. See Section 2. Treat it as a constraint that comes before aesthetic, not a checklist applied after.

**Performance budget.** Bundle size, time to interactive, runtime memory, network conditions. Decorative fonts, heavy animation libraries, and large component libraries have a cost. Name the budget before you spend it.

## 2. Accessibility floor

These are non-negotiable. If you cannot satisfy them, do not ship the component.

- Contrast: 4.5:1 for body text, 3:1 for text 18px regular or 14px bold and above, 3:1 for UI components and graphical objects against adjacent colours. Verify with a contrast checker, not by eye. OKLCH lightness is not contrast.
- Focus: every interactive element has a visible focus indicator with at least 3:1 contrast against the background. Do not remove the default outline without replacing it.
- Semantic HTML: `button` for actions, `a` for navigation, `label` bound to every input by `for` or wrapping, headings in order, lists for lists. ARIA is a patch for when HTML cannot express the role, not a substitute.
- Keyboard: every action reachable and operable from the keyboard. Tab order matches visual order. No keyboard traps. Skip links on pages with repeated navigation.
- Motion: respect `prefers-reduced-motion: reduce`. Replace transitions with instant state changes. Never animate anything essential to comprehension.
- Forms: every input has a visible label, an accessible name, and an error message tied via `aria-describedby`. Placeholder text is not a label.
- Touch targets: 24x24 CSS pixels minimum, 44x44 preferred for primary actions.

## 3. Aesthetic derivation

Aesthetic is what is left after constraints have been satisfied. Derive it, do not pick it.

**Typography.** Choose a typeface by evaluating: legibility at the smallest size you will render it, x-height suitable for dense UI, numerals that are tabular for any tabular data, language coverage for every locale you ship, weight range you actually need, file size at the weights you load, and licence. If the existing brand specifies a face that fails any of these for this surface, name the trade-off and propose a fallback for that surface only. Do not introduce a second display face because the first one is "boring."

**Colour.** Derive the palette from the brand. Verify every text and UI pairing against Section 2 contrast. Assign semantic roles (background, surface, border, text, text-muted, accent, success, warning, danger) before you assign hex values. Confirm dark and light parity if both are shipped. Saturated colour is a finite resource; spend it on meaning, not decoration.

**Motion.** Motion has two legitimate jobs: showing causation (this came from there) and showing state change (this is now loading). Anything else is decoration. When `prefers-reduced-motion` is set, decoration is removed and causation is shown without movement. Duration: 120-200ms for state changes, longer only with a reason you can name.

**Density.** Production users prefer information density once they know the tool. Optimise for the trained user, not the first-time user. Provide a comfortable mode if the audience genuinely mixes both.

## 4. Name the trade-off

Every pattern choice excludes another pattern. When you pick, write down what you traded off and the constraint that justifies it. Examples:

- "Chose a dense table over a card list. Traded scanability for screen efficiency. Justified by: enterprise users on desktop, frequent comparison tasks."
- "Chose system font stack over a custom face. Traded brand expression for time to interactive. Justified by: 3G performance budget, internal audience."
- "Chose inline validation over submit-time validation. Traded form completion rate for error recovery time. Justified by: long forms with expensive backend submission."

If you cannot name the trade-off, you have not made a decision. You have repeated the median of your training data.

## 5. Anti-patterns

Do not do any of the following.

- Pick a font without naming why it beats the alternatives on the criteria in Section 3.
- Pick a colour without verifying contrast against every surface it will sit on.
- Add an animation without checking `prefers-reduced-motion` and without naming the causation or state change it shows.
- Describe your own output as beautiful, elegant, stunning, modern, sleek, or clean. These words mean nothing and they hide the absence of reasoning.
- Reach for a glassmorphism, gradient mesh, or neumorphism treatment in a production context without naming the constraint that demanded it.
- Replace native form controls with custom ones unless the native control has a falsifiable defect you can describe.
- Use placeholder text as a label.
- Use colour as the only signal for state. Pair it with text, icon, or position.
- Use icon-only buttons without an accessible name.
- Use the same colour for two semantic roles (for example, accent and success) and hope users learn the difference.

## Closing

Constraints first. Accessibility is the floor. Name your trade-offs. If a choice cannot be defended against the audience, context, purpose, brand, accessibility, and performance answers, change the choice.
