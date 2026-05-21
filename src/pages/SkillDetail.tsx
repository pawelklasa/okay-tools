import { Link, useParams, Navigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
import productionDesignSrc from "../../skills/production-design/SKILL.md?raw";
import { SkillsFooter } from "./Skills";

type SkillRecord = {
  slug: string;
  name: string;
  install: string;
  githubUrl: string;
  rawUrl: string;
  source: string;
};

const SKILL_FILES: Record<string, SkillRecord> = {
  "production-design": {
    slug: "production-design",
    name: "production-design",
    install: "claude code plugin install pawelklasa/okay-tools-skills/production-design",
    githubUrl:
      "https://github.com/pawelklasa/okay-tools-skills/blob/main/production-design/SKILL.md",
    rawUrl:
      "https://raw.githubusercontent.com/pawelklasa/okay-tools-skills/main/production-design/SKILL.md",
    source: productionDesignSrc,
  },
};

export function SkillDetail() {
  const { slug = "" } = useParams();
  const skill = SKILL_FILES[slug];
  if (!skill) return <Navigate to="/skills" replace />;

  const { frontmatter, body } = splitFrontmatter(skill.source);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
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
        <span className="text-[var(--color-fg-dim)] mx-1">/</span>
        <Link
          to="/skills"
          className="text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          skills
        </Link>
        <span className="text-[var(--color-fg-dim)] mx-1">/</span>
        <span className="mono text-[12.5px] text-[var(--color-fg)]">{skill.slug}</span>
      </header>

      {/* Title */}
      <section className="px-8 lg:px-16 pt-8 lg:pt-12 pb-6 max-w-3xl">
        <p className="mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent-400)] mb-5">
          skill · {frontmatter.license ?? "MIT"}
        </p>
        <h1 className="text-[40px] md:text-[56px] font-semibold tracking-[-0.03em] leading-[1.05] text-[var(--color-fg)]">
          {frontmatter.name ?? skill.name}
        </h1>
        {frontmatter.description && (
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-fg-muted)]">
            {frontmatter.description}
          </p>
        )}
      </section>

      {/* Install */}
      <section className="px-8 lg:px-16 pb-8 max-w-3xl">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-2">
          Install
        </p>
        <InstallBar command={skill.install} />
      </section>

      {/* Rendered SKILL.md */}
      <section className="px-8 lg:px-16 pb-10 max-w-3xl">
        <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-7 md:p-10">
          <Markdown source={body} />
        </article>
      </section>

      {/* Why this exists */}
      <section className="px-8 lg:px-16 pb-10 max-w-3xl">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-7">
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent-400)] mb-3">
            Why this exists
          </p>
          <p className="text-[15px] leading-relaxed text-[var(--color-fg-muted)]">
            An alternative to Anthropic's{" "}
            <a
              href="https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-fg)] underline-offset-4 hover:underline"
            >
              frontend-design skill
            </a>
            , which targets distinctive marketing surfaces and does not address accessibility,
            constraints, or what the model is actually doing when it samples. Full reasoning in the
            article:{" "}
            <a
              href="https://medium.com/design-bootcamp/the-most-installed-design-document-of-2026-is-30-lines-long-6b9a89834bd8"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-fg)] underline-offset-4 hover:underline"
            >
              The most installed design document of 2026 is 30 lines long
            </a>
            .
          </p>
        </div>
      </section>

      {/* Links */}
      <section className="px-8 lg:px-16 pb-14 max-w-3xl flex flex-wrap gap-4 text-[13px]">
        <a
          href={skill.githubUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline-offset-4 hover:underline"
        >
          View on GitHub →
        </a>
        <a
          href={skill.rawUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline-offset-4 hover:underline"
        >
          View raw file →
        </a>
        <Link
          to="/skills"
          className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline-offset-4 hover:underline"
        >
          ← All skills
        </Link>
      </section>

      <SkillsFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Install bar with copy
// ---------------------------------------------------------------------------

function InstallBar({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] flex items-stretch overflow-hidden">
      <code className="mono text-[12.5px] text-[var(--color-fg)] px-4 py-3 flex-1 overflow-x-auto whitespace-nowrap">
        $ {command}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny markdown renderer — supports the subset used in SKILL.md
// ---------------------------------------------------------------------------

type Frontmatter = Record<string, string>;

function splitFrontmatter(src: string): { frontmatter: Frontmatter; body: string } {
  const match = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: src };
  const fm: Frontmatter = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim();
  }
  return { frontmatter: fm, body: match[2].trim() };
}

function renderInline(text: string): ReactNode[] {
  // Order: code, links, bold. We tokenise with a single regex.
  const nodes: ReactNode[] = [];
  const regex =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`c${key++}`}
          className="mono text-[12.5px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-fg)]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={`b${key++}`} className="text-[var(--color-fg)] font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      const lm = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) {
        nodes.push(
          <a
            key={`l${key++}`}
            href={lm[2]}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-accent-400)] underline-offset-4 hover:underline"
          >
            {lm[1]}
          </a>
        );
      }
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Headings
    let h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      if (level === 1) {
        out.push(
          <h1
            key={k++}
            className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--color-fg)] mt-8 mb-4 first:mt-0"
          >
            {renderInline(text)}
          </h1>
        );
      } else if (level === 2) {
        out.push(
          <h2
            key={k++}
            className="text-[22px] font-semibold tracking-[-0.015em] text-[var(--color-fg)] mt-10 mb-3 first:mt-0 pt-6 border-t border-[var(--color-border)] first:border-t-0 first:pt-0"
          >
            {renderInline(text)}
          </h2>
        );
      } else {
        out.push(
          <h3
            key={k++}
            className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--color-fg)] mt-6 mb-2"
          >
            {renderInline(text)}
          </h3>
        );
      }
      i++;
      continue;
    }

    // Code block
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      out.push(
        <pre
          key={k++}
          className="mono text-[12.5px] leading-relaxed bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] p-4 overflow-x-auto my-4"
        >
          <code>{buf.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul
          key={k++}
          className="list-disc pl-6 my-4 space-y-2 text-[15px] leading-relaxed text-[var(--color-fg-muted)] marker:text-[var(--color-fg-dim)]"
        >
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Paragraph (collect consecutive non-blank, non-special lines)
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|[-*]\s|```)/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    out.push(
      <p
        key={k++}
        className="my-4 text-[15px] leading-relaxed text-[var(--color-fg-muted)]"
      >
        {renderInline(paraLines.join(" "))}
      </p>
    );
  }

  return <div className="skill-md">{out}</div>;
}
