import { Link } from "react-router-dom";
import { useState } from "react";

const SKILLS = [
  {
    slug: "production-design",
    name: "production-design",
    description:
      "Design guidance for shipping production software. Constraints first, accessibility as the floor, deterministic rules over vibes.",
    install: "claude code plugin install pawelklasa/okay-tools-skills/production-design",
    githubUrl:
      "https://github.com/pawelklasa/okay-tools-skills/blob/main/production-design/SKILL.md",
    tags: ["Dashboards", "SaaS", "Internal tools", "WCAG 2.2 AA"],
  },
];

export function Skills() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar — matches BrandHome */}
      <header className="px-8 lg:px-16 pt-7 flex items-center gap-2.5">
        <Link to="/" className="flex items-center gap-2.5">
          <span
            className="w-7 h-7 rounded-md"
            style={{
              background:
                "conic-gradient(from 0deg, oklch(0.72 0.18 30), oklch(0.72 0.18 110), oklch(0.72 0.18 200), oklch(0.72 0.18 290), oklch(0.72 0.18 30))",
            }}
          />
          <span className="font-semibold tracking-tight text-[15px]">
            okay<span className="text-[var(--color-fg-dim)]">.tools</span>
          </span>
        </Link>
      </header>

      {/* Hero */}
      <section className="px-8 lg:px-16 pt-8 lg:pt-12 pb-7 max-w-4xl">
        <p className="mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-6">
          Claude Code skills · published openly
        </p>
        <h1 className="text-[44px] md:text-[64px] lg:text-[76px] font-semibold tracking-[-0.035em] leading-[1.02] text-[var(--color-fg)]">
          Skills.
        </h1>
        <p className="mt-4 text-[18px] leading-relaxed text-[var(--color-fg-muted)] max-w-2xl">
          Claude Code skills for production software.
        </p>
        <p className="mt-6 text-[15px] leading-relaxed text-[var(--color-fg-muted)] max-w-2xl">
          A skill is a markdown file with YAML frontmatter that Claude Code loads as durable
          context for a class of task. The defaults that ship with the model converge on a
          marketing landing page. Most software is not that. These skills move the defaults
          somewhere more useful.
        </p>
      </section>

      {/* Skill list */}
      <section className="px-8 lg:px-16 pb-12 grid gap-5">
        {SKILLS.map((s) => (
          <SkillCard key={s.slug} skill={s} />
        ))}
      </section>

      <SkillsFooter />
    </div>
  );
}

function SkillCard({
  skill,
}: {
  skill: (typeof SKILLS)[number];
}) {
  return (
    <article className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      <div className="p-6 lg:p-8 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent-400)] mb-2">
              skill
            </p>
            <h2 className="text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
              {skill.name}
            </h2>
          </div>
          <Link
            to={`/skills/${skill.slug}`}
            className="mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition self-start mt-2"
          >
            View full file →
          </Link>
        </div>

        <p className="text-[15px] leading-relaxed text-[var(--color-fg-muted)] max-w-3xl">
          {skill.description}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {skill.tags.map((t) => (
            <span
              key={t}
              className="mono text-[10px] px-2 py-1 rounded bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]"
            >
              {t}
            </span>
          ))}
        </div>

        <InstallBlock command={skill.install} />

        <div className="flex flex-wrap gap-4 text-[13px]">
          <a
            href={skill.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline-offset-4 hover:underline"
          >
            View SKILL.md on GitHub →
          </a>
          <Link
            to={`/skills/${skill.slug}`}
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline-offset-4 hover:underline"
          >
            Read it here →
          </Link>
        </div>
      </div>
    </article>
  );
}

function InstallBlock({ command }: { command: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] flex items-stretch overflow-hidden max-w-3xl">
      <code className="mono text-[12.5px] text-[var(--color-fg)] px-4 py-3 flex-1 overflow-x-auto whitespace-nowrap">
        $ {command}
      </code>
      <CopyButton text={command} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          // ignore
        }
      }}
      className="mono text-[10px] uppercase tracking-[0.16em] px-4 border-l border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
      aria-label="Copy install command"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function SkillsFooter() {
  return (
    <footer className="mt-auto px-8 lg:px-16 py-8 flex flex-wrap gap-x-6 gap-y-3 items-center justify-between text-xs text-[var(--color-fg-dim)] border-t border-[var(--color-border)]">
      <p>
        Published by{" "}
        <a
          href="https://pavka.design/"
          className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          Pawel Klasa
        </a>
        . Read the article that started this:{" "}
        <a
          href="https://medium.com/design-bootcamp/the-most-installed-design-document-of-2026-is-30-lines-long-6b9a89834bd8"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline-offset-4 hover:underline"
        >
          The most installed design document of 2026 is 30 lines long
        </a>
        .
      </p>
      <div className="flex gap-5">
        <Link to="/" className="hover:text-[var(--color-fg)]">
          okay.tools
        </Link>
        <a
          href="https://github.com/pawelklasa/okay-tools-skills"
          target="_blank"
          rel="noreferrer"
          className="hover:text-[var(--color-fg)]"
        >
          GitHub
        </a>
      </div>
      <p className="mono">MIT</p>
    </footer>
  );
}
