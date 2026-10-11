import { Link, useMatch, useParams } from "react-router-dom";
import { BrandFooter, BrandHeader } from "../components/BrandChrome";
import { SignalTag } from "../components/signal/SignalCard";
import {
  digestNotice, publicationLabel, signalConfig, signalDate, signalHref, signalPath,
  utcToday, useSignalDigests,
} from "../lib/signal";
import type { SignalDigest, SignalItem } from "../lib/signal";

function DigestCounts({ digest }: { digest: SignalDigest }) {
  return (
    <>
      Scanned <span className="text-[var(--color-brand-yellow)]">{digest.scanned}</span> posts
      {digest.sources && <> from <span className="text-[var(--color-brand-yellow)]">{digest.sources.length}</span> sources</>}
      {" · "}<span className="whitespace-nowrap">Kept <span className="text-[var(--color-brand-yellow)]">{digest.kept}</span></span>
    </>
  );
}

function ReadingRow({ item, date }: { item: SignalItem; date: string }) {
  const published = publicationLabel(item.publishedAt, date);
  const tags = signalConfig.tags.filter((tag) => item.tags.includes(tag));
  return (
    <li className="signal-row px-5 py-6 md:px-8 md:py-7">
      <span className="mono signal-rank text-[32px] md:text-[40px] leading-none text-[var(--color-brand-yellow)]" aria-label={`Rank ${item.rank}`}>
        {String(item.rank).padStart(2, "0")}
      </span>
      <article className="min-w-0">
        <h2 className="text-[20px] md:text-[24px] font-semibold tracking-tight leading-snug break-words">
          <a className="hover:text-[var(--color-brand-yellow)] transition-colors" href={item.url} target="_blank" rel="noopener noreferrer">
            {item.title} <span aria-hidden="true" className="text-[var(--color-fg-muted)]">→</span>
          </a>
        </h2>
        <p className="mono text-[11px] leading-relaxed text-[var(--color-fg-muted)] mt-2 break-words">
          {item.source} · {published.timestamp ? <time dateTime={item.publishedAt} title={published.timestamp}>{published.label}</time> : published.label}
        </p>
        <p className="text-[14px] leading-relaxed text-[var(--color-fg-muted)] mt-4 break-words">{item.summary}</p>
        <p className="mono text-[12px] leading-relaxed text-[var(--color-fg-muted)] mt-3 break-words">
          <span className="text-[var(--color-brand-yellow)]" aria-hidden="true">// </span>{item.why}
        </p>
        {tags.length > 0 && <div className="flex flex-wrap gap-1.5 mt-4">{tags.map((tag) => <SignalTag key={tag} tag={tag} />)}</div>}
      </article>
    </li>
  );
}

export function Signal() {
  const { date } = useParams<{ date: string }>();
  const archive = Boolean(useMatch(`${signalPath}/archive`));
  const { status, digests, retry } = useSignalDigests();
  const index = date ? digests.findIndex((digest) => digest.date === date) : 0;
  const digest = digests[index];
  const notice = !archive && !date && digest ? digestNotice(digest.date) : null;
  const previous = digest ? digests[index + 1] : undefined;
  const next = digest ? digests[index - 1] : undefined;

  return (
    <div className="signal-page min-h-screen flex flex-col">
      <a href="#signal-main" className="signal-skip mono text-[12px]">Skip to content</a>
      <BrandHeader />
      <main id="signal-main" tabIndex={-1} className="flex-1 min-w-0 px-8 lg:px-16 pt-8 lg:pt-12 pb-12">
        <section className="max-w-5xl pb-7" aria-labelledby="signal-heading">
          <p className="mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-fg-muted)] mb-6">
            {signalConfig.name} - {archive ? "Archive" : date ? digest ? signalDate(digest.date) : date : signalDate(digest?.date ?? utcToday())}
          </p>
          <h1 id="signal-heading" className="text-[44px] md:text-[64px] lg:text-[76px] font-semibold tracking-[-0.035em] leading-[1.02] text-[var(--color-fg)]">
            {archive ? <><span className="text-[var(--color-fg-dim)]">The</span> archive.</> : <><span className="text-[var(--color-fg-dim)]">{digest ? ["None", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"][digest.kept] : "Ten"}</span> worth reading.</>}
          </h1>
          {!archive && status === "ready" && digest && <p className="mt-3 text-[16px] leading-relaxed text-[var(--color-fg-muted)]"><DigestCounts digest={digest} /></p>}
          {notice && <p className="mono text-[11px] leading-relaxed text-[var(--color-fg-muted)] mt-6">{notice}</p>}
        </section>

        {status === "loading" && <p role="status" className="text-[14px] text-[var(--color-fg-muted)] py-8">Loading {signalConfig.name}...</p>}
        {status === "error" && <div role="alert" className="py-8 text-[14px] text-[var(--color-fg-muted)]">
          <p>Could not load the digests.</p>
          <button type="button" onClick={retry} className="mt-4 inline-flex items-center gap-2 text-[var(--color-fg)] hover:text-[var(--color-brand-yellow)]">
            Retry <span aria-hidden="true">→</span>
          </button>
        </div>}
        {status === "ready" && (archive ? (
          digests.length ? <ol className="rounded-[var(--radius-lg)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {digests.map((entry) => <li key={entry.date}>
              <Link to={`${signalPath}/${entry.date}`} className="group flex items-center gap-4 px-5 py-5 md:px-8 hover:bg-[var(--color-surface)] transition-colors rounded-[inherit]">
                <div className="flex-1 min-w-0">
                  <p className="mono text-[11px] text-[var(--color-fg-muted)] mb-2"><time dateTime={entry.date}>{signalDate(entry.date)}</time> · <span className="text-[var(--color-brand-yellow)]">{entry.kept}</span> kept</p>
                  <p className="text-[18px] font-semibold tracking-tight break-words">{entry.items[0]?.title ?? "No posts kept in this run"}</p>
                </div>
                <span aria-hidden="true" className="text-lg text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)]">→</span>
              </Link>
            </li>)}
          </ol> : <p className="text-[14px] text-[var(--color-fg-muted)] py-8">No digest has landed yet.</p>
        ) : digest ? (
          digest.items.length ? <ol className="rounded-[var(--radius-lg)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {digest.items.map((item) => <ReadingRow key={item.url} item={item} date={digest.date} />)}
          </ol> : <p className="text-[14px] text-[var(--color-fg-muted)] py-8">No posts kept in this run.</p>
        ) : <div className="py-8">
          <h2 className="text-[22px] font-semibold">{date ? "Not found" : "No digest has landed yet."}</h2>
          {date && <p className="mt-2 text-[14px] text-[var(--color-fg-muted)] break-words">No digest is available for {date}.</p>}
        </div>)}

        {!archive && status === "ready" && digest && <nav aria-label="Digest dates" className="flex flex-wrap justify-between gap-4 py-6 mono text-[12px] text-[var(--color-fg-muted)]">
          {previous ? <Link to={`${signalPath}/${previous.date}`} className="hover:text-[var(--color-fg)]">← Previous · {signalDate(previous.date)}</Link> : <span />}
          {next && <Link to={`${signalPath}/${next.date}`} className="hover:text-[var(--color-fg)]">Next · {signalDate(next.date)} →</Link>}
        </nav>}
        <nav aria-label={`${signalConfig.name} navigation`} className="flex flex-wrap gap-x-6 gap-y-3 mono text-[12px] text-[var(--color-fg-muted)] mt-6">
          {(archive || date) && <Link to={signalPath} className="hover:text-[var(--color-fg)]">Latest →</Link>}
          {!archive && <Link to={`${signalPath}/archive`} className="hover:text-[var(--color-fg)]">Archive →</Link>}
          <a href={signalHref(`${signalPath}/rss.xml`)} className="hover:text-[var(--color-fg)]">RSS →</a>
        </nav>
        <p className="text-[13px] leading-relaxed text-[var(--color-fg-muted)] mt-8">Summaries are AI-written. Click through — the original is always better.</p>
        <p className="mono text-[11px] leading-relaxed text-[var(--color-fg-muted)] mt-3">
          Sources: <a href={signalConfig.contactUrl} className="underline underline-offset-4 hover:text-[var(--color-fg)]">request removal →</a>
        </p>
      </main>
      <BrandFooter />
    </div>
  );
}