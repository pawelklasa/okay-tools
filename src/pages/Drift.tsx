import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card, PageHeader, Button, Field } from "../components/ui";
import {
  parseCss,
  score,
  DEFAULT_CONFIG,
  type DriftReport,
} from "../lib/drift";
import { ResultPanel } from "../components/drift/ResultPanel";

type Mode = "paste" | "url" | "repo";

// Live URL scan needs a server-side runtime (Netlify function or local Vite
// middleware). On static hosts like GitHub Pages there is no such runtime, so
// we hide the tab entirely instead of showing a disabled one. Paste CSS and
// the CLI work everywhere.
const SUPPORTS_LIVE_URL =
  typeof window !== "undefined" &&
  !window.location.hostname.endsWith(".github.io") &&
  import.meta.env.BASE_URL !== "/okay-tools/";

export function Drift() {
  const [mode, setMode] = useState<Mode>("paste");
  const [report, setReport] = useState<DriftReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(DEFAULT_CONFIG.colorToleranceDeltaE);

  return (
    <div className="min-h-screen flex flex-col">
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

      <PageHeader
        eyebrow="DRIFT SCORE · v0.1"
        title="How drifted is your design system?"
        description="Count distinct used values against published baselines. The score is a count, not an opinion — every normalisation rule is listed below."
      />

      <section className="px-8 lg:px-16 pb-6 max-w-5xl">
        <div className="flex flex-wrap gap-1.5 mb-4">
          <ModeTab active={mode === "paste"} onClick={() => setMode("paste")}>Paste CSS</ModeTab>
          {SUPPORTS_LIVE_URL && (
            <ModeTab active={mode === "url"} onClick={() => setMode("url")}>Live URL</ModeTab>
          )}
          <ModeTab active={mode === "repo"} onClick={() => setMode("repo")}>Repo / Folder (CLI)</ModeTab>
        </div>

        {mode === "paste" && (
          <PasteMode
            tolerance={tolerance}
            setTolerance={setTolerance}
            onReport={(r) => { setReport(r); setError(null); }}
            onError={setError}
            running={running}
            setRunning={setRunning}
          />
        )}
        {mode === "url" && (
          <UrlMode
            tolerance={tolerance}
            setTolerance={setTolerance}
            onReport={(r) => { setReport(r); setError(null); }}
            onError={setError}
            running={running}
            setRunning={setRunning}
          />
        )}
        {mode === "repo" && (
          <RepoMode
            onReport={(r) => { setReport(r); setError(null); }}
            onError={setError}
          />
        )}

        {error && (
          <Card className="mt-4 border-[var(--color-err)]/40">
            <p className="text-[13px] text-[var(--color-err)]">{error}</p>
          </Card>
        )}
      </section>

      {report && (
        <section className="px-8 lg:px-16 pb-16 max-w-5xl w-full">
          <ResultPanel report={report} />
        </section>
      )}
    </div>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`mono text-[11px] uppercase tracking-[0.14em] px-3 py-2 rounded-[var(--radius-sm)] border transition ${
        active
          ? "bg-[var(--color-surface-2)] border-[var(--color-border-strong)] text-[var(--color-fg)]"
          : "bg-transparent border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
      }`}
    >
      {children}
    </button>
  );
}

// ---------- PASTE ----------

function PasteMode(props: {
  tolerance: number;
  setTolerance: (n: number) => void;
  onReport: (r: DriftReport) => void;
  onError: (e: string) => void;
  running: boolean;
  setRunning: (b: boolean) => void;
}) {
  const [text, setText] = useState(SAMPLE_CSS);
  const run = () => {
    try {
      const obs = parseCss(text, { file: "pasted.css" });
      if (obs.length === 0) {
        props.onError("No visual values found in pasted text. Paste CSS, a tokens file, or a JSX snippet with style attributes.");
        return;
      }
      const report = score({
        mode: "paste",
        target: "Pasted content",
        observations: obs,
        config: { colorToleranceDeltaE: props.tolerance },
      });
      props.onReport(report);
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Could not parse pasted content");
    }
  };
  return (
    <Card>
      <Field label="Paste CSS, tokens, or a stylesheet" hint={`${text.length.toLocaleString()} chars`}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={12}
          className="w-full font-mono"
        />
      </Field>
      <div className="mt-3 flex flex-wrap items-center gap-3 justify-between">
        <ToleranceControl value={props.tolerance} onChange={props.setTolerance} />
        <Button variant="primary" onClick={run}>Measure drift</Button>
      </div>
    </Card>
  );
}

// ---------- URL ----------

function UrlMode(props: {
  tolerance: number;
  setTolerance: (n: number) => void;
  onReport: (r: DriftReport) => void;
  onError: (e: string) => void;
  running: boolean;
  setRunning: (b: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  // GitHub Pages and other static hosts can't run the /api/drift-scan
  // function. Detect and surface a clear message instead of letting fetch()
  // hit a 404 HTML page that fails JSON.parse with a cryptic error.
  const isStaticHost =
    typeof window !== "undefined" &&
    (window.location.hostname.endsWith(".github.io") ||
      import.meta.env.BASE_URL === "/okay-tools/");
  const run = async () => {
    if (!url.trim()) { props.onError("Enter a URL."); return; }
    if (isStaticHost) {
      props.onError(
        "Live URL scan needs a server-side runtime. This deploy is on GitHub Pages (static hosting). Use Paste CSS, or run the CLI: `okay-drift --json > drift.json` and import the file under Repo / Folder."
      );
      return;
    }
    props.setRunning(true);
    try {
      const r = await fetch("/api/drift-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, tolerance: props.tolerance }),
      });
      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        props.onError(
          `Scan endpoint returned ${r.status} ${ct || "unknown content-type"}. This usually means the deploy doesn't run the /api/drift-scan function. Use Paste CSS or the CLI instead.`
        );
        return;
      }
      const data = await r.json();
      if (!r.ok) {
        props.onError(data.error || `Scan failed (${r.status}).`);
        return;
      }
      props.onReport(data);
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Network error");
    } finally {
      props.setRunning(false);
    }
  };
  return (
    <Card>
      <Field label="Live URL" hint={isStaticHost ? "static host — use Paste / CLI" : "https only, public hosts"}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          autoComplete="off"
          disabled={isStaticHost}
        />
      </Field>
      <p className="mt-2 text-[12px] text-[var(--color-fg-dim)]">
        {isStaticHost
          ? "This deploy is on GitHub Pages and can't run the headless-browser scan. The Paste CSS tab and the CLI work everywhere."
          : "We render the page in a headless browser, read computed styles, and discard the URL. Rate-limited. Third-party iframes are listed but not counted."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 justify-between">
        <ToleranceControl value={props.tolerance} onChange={props.setTolerance} />
        <Button variant="primary" onClick={run} disabled={isStaticHost}>
          {props.running ? "Scanning…" : "Scan URL"}
        </Button>
      </div>
    </Card>
  );
}

// ---------- REPO ----------

function RepoMode(props: { onReport: (r: DriftReport) => void; onError: (e: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.categories) throw new Error("Not a drift report (no `categories`).");
      props.onReport(data as DriftReport);
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Could not read file");
    }
  };
  return (
    <Card>
      <p className="text-[14px] text-[var(--color-fg-muted)] leading-relaxed">
        The repo scanner runs locally so nothing leaves your machine. From the
        root of your project:
      </p>
      <pre className="mono mt-3 text-[12px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] p-3 overflow-x-auto">
{`npx okay-drift                 # scan and print to stdout
npx okay-drift --open          # scan and open the result in this page
npx okay-drift --json > drift.json   # write a report file you can drop below`}
      </pre>
      <p className="mt-3 text-[13px] text-[var(--color-fg-muted)]">
        The third command writes <span className="mono">drift.json</span> into
        your current directory. Drop that file here to view the report:
      </p>
      <div className="mt-2 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          className="text-[12px]"
        />
      </div>
    </Card>
  );
}

function ToleranceControl({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  // OKLab ΔE is Euclidean distance in OKLab (Björn Ottosson, 2020).
  // ~0.02 is the just-noticeable difference on a calibrated monitor at normal
  // viewing distance. (Roughly equivalent to CIEDE2000 ΔE ≈ 1.0.)
  // We expose 0.005–0.06, default 0.02. Don't change defaults silently.
  return (
    <label className="flex items-center gap-2 text-[12px] text-[var(--color-fg-muted)]">
      <span className="mono uppercase tracking-wider text-[10px] text-[var(--color-fg-dim)]">
        ΔE (OKLab)
      </span>
      <input
        type="range"
        min={0.005}
        max={0.06}
        step={0.005}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-32"
      />
      <span className="mono w-12">{value.toFixed(3)}</span>
      <span className="text-[11px] text-[var(--color-fg-dim)] hidden md:inline">
        JND ≈ 0.02
      </span>
    </label>
  );
}

const SAMPLE_CSS = `/* Sample stylesheet with deliberate, realistic drift.
   Near-duplicate greys, ad-hoc spacing, accreted radii and shadows \u2014 the
   kind of CSS you get six months into a project without a token system. */
body, .body-1 { color: #f5f5f7; background: #0f1115; font-family: Inter, sans-serif; font-size: 16px; line-height: 1.5; }
h1 { color: #ffffff; font-family: Inter, sans-serif; font-size: 32px; font-weight: 700; line-height: 1.1; }
h2 { color: #fefefe; font-family: "Inter", sans-serif; font-size: 28px; font-weight: 700; line-height: 1.12; }
h3 { color: #fdfdfd; font-family: Inter, sans-serif; font-size: 24px; font-weight: 600; line-height: 1.15; }
h4 { color: #fcfcfc; font-family: Inter, sans-serif; font-size: 21px; font-weight: 600; line-height: 1.2; }
h5 { color: #f8f8fa; font-family: Inter, sans-serif; font-size: 19px; font-weight: 600; line-height: 1.22; }
p  { color: #c9c9d1; font-size: 15px; line-height: 1.55; }
.muted { color: #bababa; font-size: 13px; line-height: 1.6; }
.muted-2 { color: #b8b8b8; font-size: 13px; }
.muted-3 { color: #b5b5bb; font-size: 12.5px; }
.muted-4 { color: rgba(186, 186, 186, 0.92); font-size: 12px; line-height: 1.65; }
.dim { color: #9a9aa3; font-size: 11.5px; line-height: 1.7; }
.dim-2 { color: #99999f; font-size: 11px; }
.warn { color: #d97a4a; font-family: "Roboto", sans-serif; font-weight: 500; }
.success { color: #2ea16a; font-family: "SF Pro Text", system-ui, sans-serif; font-weight: 600; }
.link { color: #5ec3ff; font-family: "Helvetica Neue", Helvetica, sans-serif; transition: color 200ms ease; }
.link:hover { color: #6ec5ff; transition: color 180ms ease-out; }
.link:focus { outline-color: #7ec8ff; transition: outline 160ms ease; }
.btn-a { padding: 9px 17px; border-radius: 7px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
.btn-b { padding: 10px 18px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.22); }
.btn-c { padding: 11px 19px; border-radius: 9px; box-shadow: 0 2px 6px rgba(0,0,0,0.25); }
.btn-d { padding: 13px 21px; border-radius: 10px; box-shadow: 0 3px 8px rgba(0,0,0,0.28); }
.btn-e { padding: 15px 23px; border-radius: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.30); }
.card-a { padding: 14px; margin: 6px 9px; border-radius: 12px; box-shadow: 0 6px 14px rgba(0,0,0,0.32); background: #1a1c22; border: 1px solid #2a2c33; }
.card-b { padding: 18px; margin: 7px 11px; border-radius: 13px; box-shadow: 0 8px 20px rgba(0,0,0,0.36); background: #1b1d23; border: 1px solid #2c2e35; }
.card-c { padding: 22px; margin: 5px 13px; border-radius: 14px; box-shadow: 0 12px 28px rgba(0,0,0,0.40); background: #1d1f25; border: 1px solid #2b2d34; }
.grid { gap: 19px; padding: 25px 31px; }
.grid-tight { gap: 6.5px; padding: 11px 15px; }
.stack > * + * { margin-top: 27px; }
.stack-sm > * + * { margin-top: 4.5px; }
.modal { z-index: 9999; }
.toast { z-index: 8000; }
`;

