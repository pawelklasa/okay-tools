import { signalConfig, signalHref, signalDate, publicationLabel, useSignalDigests, utcToday } from "../../lib/signal";

export function SignalTag({ tag }: { tag: string }) {
  return (
    <span className="mono text-[10px] px-2 py-1 rounded bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
      {tag}
    </span>
  );
}

const samples = [
  "When a token needs a better name",
  "A closer look at CSS layout",
  "Making motion respect the reader",
];

export function SignalCard() {
  const { status, digests } = useSignalDigests();
  const latest = digests[0];
  const preview = latest?.items.slice(0, 3);
  return (
    <a
      href={signalHref()}
      className="signal-card group rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-border-strong)] transition flex flex-col min-w-0"
    >
      <div className="signal-card-preview aspect-[16/10] bg-[var(--color-bg)] border-b border-[var(--color-border)] p-5 flex flex-col justify-center gap-3">
        <p className="mono text-[9.5px] uppercase tracking-wider text-[var(--color-fg-muted)]">
          {latest ? `${latest.date === utcToday() ? "TODAY" : signalDate(latest.date)} - ${latest.kept} OF ${latest.scanned}` : "SAMPLE PREVIEW - 10 OF 214"}
        </p>
        <ol className="flex flex-col gap-3">
          {(preview?.length ? preview : !latest ? samples : []).map((item, index) => {
            const sample = typeof item === "string";
            const published = sample ? null : publicationLabel(item.publishedAt, latest.date);
            return (
              <li key={sample ? item : item.url} className="flex gap-3 min-w-0">
                <span className="mono text-[18px] leading-snug text-[var(--color-brand-yellow)] shrink-0">
                  {String(sample ? index + 1 : item.rank).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold leading-snug line-clamp-2 break-words">
                    {sample ? item : item.title}
                  </p>
                  <p className="mono text-[9px] text-[var(--color-fg-muted)] mt-1 break-words" title={published?.timestamp}>
                    {sample ? "Illustrative title" : <>{item.source} · {published?.label}</>}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        {latest && !latest.items.length && <p className="text-[13px] text-[var(--color-fg-muted)]">No posts kept in this run.</p>}
        {!latest && <p className="mono text-[9px] text-[var(--color-fg-muted)]">{status === "loading" ? "Checking the latest run..." : status === "error" ? "Latest run unavailable" : "No digest has landed yet"}</p>}
      </div>
      <div className="p-6">
        <div className="flex items-baseline justify-between mb-2 gap-2">
          <h2 className="text-[22px] font-semibold tracking-tight text-[var(--color-fg)] break-words min-w-0">{signalConfig.name}</h2>
          <span aria-hidden="true" className="text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)] transition text-lg">→</span>
        </div>
        <p className="text-[14px] leading-relaxed text-[var(--color-fg-muted)] mb-4">
          Design-engineering news, ranked. Every day the 10 posts worth your time, out of the hundreds that aren't.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["Daily", "Ranked", "RSS", "Design eng"].map((tag) => <SignalTag key={tag} tag={tag} />)}
        </div>
      </div>
    </a>
  );
}