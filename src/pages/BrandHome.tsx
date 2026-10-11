import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmailCapture } from "../components/EmailCapture";
import { BrandFooter, BrandHeader } from "../components/BrandChrome";
import { checkDesignSystem, fetchDesignSystem, type DashboardReport } from "../lib/dashboardCheck";
import { CATEGORIES } from "../lib/drift";
import { publicationLabel, signalConfig, signalDate, signalHref, signalPath, useSignalDigests, utcToday } from "../lib/signal";

const writingHref = "https://medium.com/design-bootcamp/color-is-finally-ok-82f368f3408c";
const toolGroups = [
  { name: "Audit", tools: [
    { name: "Drift Score", to: "/drift", description: "Count distinct used values against published baselines.", tags: "CLI / Paste CSS / Live URL" },
    { name: "token-costumes", to: "/tokens", description: "Find primitives dressed up as semantic tokens.", tags: "Costumes / Polysemy / Layers" },
    { name: "default-audit", to: "/defaults", description: "See which AI-era defaults made it into your code.", tags: "shadcn / Tailwind / Inter / Lucide" },
  ] },
  { name: "Build", tools: [
    { name: "Color is finally OK", to: "/color", description: "Balanced palettes, honest lightness. Finally.", tags: "OKLCH / Palette / Ramp / Contrast" },
    { name: "honest-tokens", to: "/generate", description: "One brand colour. A complete three-layer token system.", tags: "Generate / Tailwind / DTCG" },
    { name: "skills", to: "/skills", description: "Production design constraints for your AI coding tools.", tags: "Claude Code / Accessibility" },
  ] },
  { name: "Lab", tools: [
    { name: "form-hostility", to: "/forms", description: "Four validation strategies. One timing playground.", tags: "Eager / Lazy / On-blur / Smart" },
    { name: "preflight", to: "/preflight", description: "The software checklists you cannot skip.", tags: "Deploy / Review / Launch" },
  ] },
];

export function BrandHome() {
  const [input, setInput] = useState("");
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function runCheck() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError(null);
    setRunning(true);
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 20_000);
    try {
      const value = input.trim();
      if (!value) throw new Error("Enter a URL or paste CSS to run the check.");
      if (input.length > 2_000_000) throw new Error("This check accepts up to 2 MB of CSS and page source.");
      let next: DashboardReport;
      if (/[{};\n]/.test(input)) {
        next = checkDesignSystem(value);
      } else {
        let target: URL;
        try { target = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); }
        catch { throw new Error("Enter a valid HTTP or HTTPS URL, or paste CSS."); }
        if (!/^https?:$/.test(target.protocol) || /\s/.test(value) || target.username || target.password || !/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z\d-]{2,}$/i.test(target.hostname)) {
          throw new Error("Enter a valid HTTP or HTTPS URL, or paste CSS.");
        }
        next = await fetchDesignSystem(target.href, controller.signal);
      }
      if (controller.signal.aborted) return;
      setReport(next);
    } catch (cause) {
      if (request.current !== controller) return;
      if (timedOut) setError("The check timed out after 20 seconds. Try again or paste CSS instead.");
      else if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not run the check. Try again.");
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller && (!controller.signal.aborted || timedOut)) setRunning(false);
    }
  }

  return (
    <div className="dashboard min-h-screen flex flex-col">
      <BrandHeader dashboard />
      <div id="dashboard-content" className="dashboard-content">
        <section id="check" className="dashboard-hero" aria-labelledby="dashboard-heading">
          <div className="dashboard-intro">
            <p className="dashboard-eyebrow mono">Quality control for design systems,<br />now that AI writes the UI</p>
            <h1 id="dashboard-heading"><span>Is your design system</span><br />okay?</h1>
            <p className="dashboard-description">Most <strong>design defaults</strong> get accepted without evaluation. Paste a URL or your CSS and see what yours are costing you.</p>
            <form className="dashboard-check" onSubmit={(event) => { event.preventDefault(); void runCheck(); }}>
              <label htmlFor="dashboard-input" className="sr-only">URL or CSS to check</label>
              <textarea id="dashboard-input" rows={input.includes("\n") ? Math.min(6, input.split("\n").length) : 1} value={input} spellCheck={false} placeholder="your-site.com or paste CSS" aria-describedby={error ? "dashboard-error" : undefined} aria-invalid={Boolean(error)} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!running) void runCheck(); }
              }} />
              <button type="submit" disabled={running}>{running ? "Checking..." : "Run the check"} <span aria-hidden>→</span></button>
            </form>
            {error && <p id="dashboard-error" className="dashboard-error" role="alert">{error}</p>}
            <p className="dashboard-check-note mono">// Runs Drift Score, default-audit and token-costumes in one pass. Free, no sign-up.</p>
            <span className="sr-only" role="status">{running ? "Checking your design system." : report ? `Check complete. ${report.findings} checks flagged.` : "Ready to check."}</span>
          </div>
          <Report report={report} />
        </section>
        <div className="dashboard-signal-band">
          <DashboardSignal />
          <aside className="dashboard-studio" aria-label="From the studio">
            <p className="dashboard-eyebrow mono">From the studio</p>
            <div className="dashboard-studio-item"><p className="dashboard-label mono">Latest writing</p><a href={writingHref} target="_blank" rel="noreferrer">Color is finally OK <span aria-hidden>↗</span></a><p>Why HSL was lying about lightness.</p></div>
            <div className="dashboard-email"><p className="dashboard-label mono">Get the next one</p><h2>One email when a tool ships.</h2><EmailCapture source="landing" prompt="" hideHeading /></div>
          </aside>
        </div>
        <section id="tools" className="dashboard-tools" aria-labelledby="tools-heading">
          <div className="dashboard-section-heading"><h2 id="tools-heading"><span>The</span> tools.</h2><p className="mono">8 tools · MIT · no sign-up</p></div>
          {toolGroups.map((group, index) => <div className={`dashboard-tool-group dashboard-tool-group-${group.name.toLowerCase()}`} key={group.name}>
            <h3 className="dashboard-eyebrow mono">{String(index + 1).padStart(2, "0")} · {group.name}<span className="dashboard-group-description">{["Find out what's broken.", "Fix it properly.", "Experiments and playgrounds."][index]}</span></h3>
            <div className="dashboard-tool-grid">{group.tools.map((tool) => <Link className="dashboard-tool" key={tool.to} to={tool.to}><h4>{tool.name}<span aria-hidden>→</span></h4><p>{tool.description}</p><div className="dashboard-tool-tags mono">{tool.tags.split(" / ").map(tag => <span key={tag}>{tag}</span>)}</div></Link>)}</div>
          </div>)}
        </section>
        <section id="writing" className="dashboard-writing" aria-labelledby="writing-heading">
          <h2 id="writing-heading" className="dashboard-eyebrow mono">Writing & experiments</h2>
          <a href={writingHref} target="_blank" rel="noreferrer"><div><h3>Color is finally OK</h3><p>Why HSL was lying about lightness, and what to do about it.</p></div><span className="mono">APR 22, 2026 <span aria-hidden>↗</span></span></a>
          <Link to="/forms"><div><h3>form-hostility</h3><p>Four validation strategies. Six failure modes. One playground.</p></div><span className="mono">PLAYGROUND <span aria-hidden>→</span></span></Link>
        </section>
      </div>
      <BrandFooter dashboard />
    </div>
  );
}

function Report({ report }: { report: DashboardReport | null }) {
  if (!report) return <section className="dashboard-report dashboard-report-empty" aria-label="Design system report">
    <div className="dashboard-report-top mono">Okay report</div>
    <div className="dashboard-verdict"><h2>Your results go here.</h2></div>
    <div className="dashboard-metrics">{["Spacing", "Defaults", "Costumes"].map(label => <div key={label}><span className="dashboard-label mono">{label}</span><strong aria-label="Not checked">—</strong></div>)}</div>
    <p className="dashboard-report-caveat mono">No check run yet.</p>
  </section>;
  const compact = (value: string) => value.length > 160 ? `${value.slice(0, 157)}...` : value;
  const costume = report.tokens.costumes[0];
  const defaultGroup = report.defaults.groups[0];
  return <section className="dashboard-report" aria-label="Design system report">
    <div className="dashboard-report-top mono"><span>Okay report</span><span className="dashboard-report-source">[{compact(report.source)}]</span></div>
    <div className="dashboard-verdict"><h2>{report.findings ? "Not okay." : "Looks okay."}</h2><p className="mono">{report.findings} {report.findings === 1 ? "check" : "checks"} flagged</p></div>
    <div className="dashboard-metrics">
      <Link to="/drift"><span className="dashboard-label mono">Spacing</span><strong>{report.spacing.distinctCount}</strong><span className={`mono ${report.spacing.delta ? "dashboard-flag" : ""}`}>{report.spacing.delta ? `+${report.spacing.delta} over baseline` : "Within baseline"}</span></Link>
      <Link to="/defaults"><span className="dashboard-label mono">Defaults</span><strong>{report.defaults.score}<small>/100</small></strong><span className="mono">Density</span></Link>
      <Link to="/tokens"><span className="dashboard-label mono">Costumes</span><strong>{report.tokens.costumeCount}</strong><span className="mono">Literal tokens</span></Link>
    </div>
    <div className="dashboard-evidence mono">
      {costume && <div><code><span>{compact(costume.token.cssName)}</span>: {compact(costume.token.value)};</code><p>// {costume.reason}</p></div>}
      {defaultGroup && <div>{defaultGroup.evidence.slice(0, 2).map((evidence, index) => <code key={`${evidence.line}-${index}`}>{compact(evidence.match ?? defaultGroup.items[0] ?? defaultGroup.name)}</code>)}<p>// {defaultGroup.name} ({defaultGroup.source})</p></div>}
      {!costume && !defaultGroup && <p>// {report.drift.totalObservations} CSS observations checked.</p>}
    </div>
    <details className="dashboard-findings"><summary>View findings</summary>
      <div className="dashboard-finding-list">
        <h3><Link to="/drift">Drift Score →</Link></h3>
        {report.drift.categories.filter((category) => category.delta > 0).map((category) => <p key={category.category}>{CATEGORIES[category.category]}: {category.distinctCount} values, +{category.delta} over baseline ({category.baseline.max}).</p>)}
        {!report.drift.overBudget && <p>No categories over baseline.</p>}
        <h3><Link to="/defaults">default-audit →</Link></h3>
        {report.defaults.groups.map((group) => <p key={group.key}>{group.name} · {group.source} · {group.evidence.length} matches</p>)}
        {!report.defaults.groups.length && <p>No default patterns detected.</p>}
        <h3><Link to="/tokens">token-costumes →</Link></h3>
        {report.tokens.costumes.map((finding) => <p key={finding.token.cssName}><code>{finding.token.cssName}: {finding.token.value}</code> · {finding.reason}</p>)}
        {!report.tokens.costumeCount && <p>No costume tokens detected.</p>}
      </div>
    </details>
    <p className="dashboard-report-caveat mono">Pattern matches, not a design verdict.</p>
    <Link className="dashboard-report-fix" to="/generate">Fix it with honest-tokens <span aria-hidden>→</span></Link>
  </section>;
}

function DashboardSignal() {
  const state = useSignalDigests();
  const digest = state.digests[0];
  const sparse = Boolean(digest && digest.kept > 0 && digest.kept <= 3);
  return <section className="dashboard-signal" data-sparse={sparse} aria-labelledby="dashboard-signal-heading">
    <div className="dashboard-signal-top"><a className="dashboard-eyebrow mono" href={signalHref()}>{signalConfig.name}</a><span className="mono">{digest ? signalDate(digest.date).toUpperCase() : "DAILY DIGEST"}</span></div>
    <div className="dashboard-signal-heading"><h2 id="dashboard-signal-heading"><span>{digest ? digest.date === utcToday() ? "Today," : "The latest," : "Signal,"}</span> worth reading.</h2>{digest && <p className="mono">{digest.kept} selected{digest.sources?.length ? ` / ${digest.sources.length} sources` : ""}</p>}</div>
    {state.status === "loading" && <p className="dashboard-feed-state" role="status">Loading the latest digest...</p>}
    {state.status === "error" && <div className="dashboard-feed-state"><p role="alert">Could not load the digest.</p><button type="button" onClick={state.retry}>Try again <span aria-hidden>↻</span></button></div>}
    {state.status === "ready" && !digest && <p className="dashboard-feed-state">Awaiting the first digest.</p>}
    {digest && <ol className="dashboard-signal-rows">{digest.items.slice(0, 5).map((item) => {
      const published = publicationLabel(item.publishedAt, digest.date);
      return <li key={item.url}><span className="dashboard-rank mono">{String(item.rank).padStart(2, "0")}</span><a href={item.url} target="_blank" rel="noopener noreferrer"><h3>{item.title} <span aria-hidden>↗</span></h3><p className="mono"><span>{item.source}</span> · <time dateTime={published.timestamp ? item.publishedAt : undefined} title={published.timestamp}>{published.label}</time></p>{sparse && <><p className="dashboard-signal-summary">{item.summary}</p><div className="dashboard-tool-tags mono">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div></>}<p className="dashboard-signal-why mono" title={item.why}>// {item.why}</p></a></li>;
    })}</ol>}
    <div className="dashboard-signal-bottom mono"><a href={signalHref()}>{digest ? digest.kept > 5 ? `See all ${digest.kept}` : "Read the digest" : "Open Signal"} <span aria-hidden>→</span></a><div><a href={signalHref(`${signalPath}/archive`)}>Archive</a><a href={signalHref(`${signalPath}/rss.xml`)}>RSS</a></div></div>
  </section>;
}
