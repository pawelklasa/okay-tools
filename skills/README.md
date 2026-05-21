# okay-tools-skills

Claude Code skills for production software, published by [Pawel Klasa](https://pavka.design/).

Hosted at [okay.tools/skills](https://okay.tools/#/skills).

## What is a Claude Code skill

A skill is a markdown file with YAML frontmatter that Claude Code loads as durable context. It tells the model how to approach a class of task. Skills live in this repo so they can be reviewed, versioned, and audited like any other document.

## Available skills

### production-design

Design guidance for shipping production software. Dashboards, enterprise SaaS, internal tools, regulated industries.

Three thesis points:

1. **Constraints first.** Aesthetic is derived from audience, context, purpose, brand, accessibility, and performance budget. Never picked from a vibe list.
2. **Accessibility as foundation.** WCAG 2.2 AA is the floor, not the goal.
3. **Honesty about the model.** The model is a stochastic sampler prone to converging on the median of its training data. It gets deterministic rules, not pep talk.

Install:

```sh
claude code plugin install pawelklasa/okay-tools-skills/production-design
```

File: [`production-design/SKILL.md`](production-design/SKILL.md)

## Why this exists

An alternative to Anthropic's [frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md), which targets distinctive marketing surfaces and does not address accessibility, constraints, or what the model is actually doing when it samples.

Read the article: [The most installed design document of 2026 is 30 lines long](https://medium.com/design-bootcamp/the-most-installed-design-document-of-2026-is-30-lines-long-6b9a89834bd8).

## Licence

MIT. Use them, fork them, rewrite them. Open an issue if you ship a version that improves on them.
