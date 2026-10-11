import { useEffect, useState } from "react";
import { z } from "zod";
import config from "../../config/signal.json";

export const signalConfig = config;
export const signalPath = `/${config.path.split("/").filter(Boolean).join("/")}`;

export function signalHref(path = signalPath) {
  return `${import.meta.env.BASE_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

const digestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => {
    const time = Date.parse(`${date}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date;
  }),
  scanned: z.number().int().nonnegative(),
  kept: z.number().int().nonnegative(),
  sources: z.array(z.string()).optional(),
  items: z.array(z.object({
    rank: z.number().int().positive(),
    title: z.string(),
    url: z.string().url().refine((url) => /^https?:\/\//i.test(url)),
    source: z.string(),
    publishedAt: z.string(),
    score: z.number(),
    summary: z.string(),
    why: z.string(),
    tags: z.array(z.string()),
  })),
});

export type SignalDigest = z.infer<typeof digestSchema>;
export type SignalItem = SignalDigest["items"][number];

type DigestState =
  | { status: "loading"; digests: SignalDigest[] }
  | { status: "ready"; digests: SignalDigest[] }
  | { status: "error"; digests: SignalDigest[] };

export function useSignalDigests() {
  const [state, setState] = useState<DigestState>({ status: "loading", digests: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(signalHref(`${signalPath}/digests.json`), {
          signal: controller.signal,
          cache: "no-cache",
        });
        if (!response.ok) throw new Error(`Digest request failed: ${response.status}`);
        const digests = z.array(digestSchema).parse(await response.json());
        if (!controller.signal.aborted) {
          setState({ status: "ready", digests: digests.sort((left, right) => right.date.localeCompare(left.date)) });
        }
      } catch {
        if (!controller.signal.aborted) setState({ status: "error", digests: [] });
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setState({ status: "loading", digests: [] });
    setAttempt((value) => value + 1);
  }

  return { ...state, retry };
}

export function utcToday(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function signalDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function digestNotice(date: string, now = new Date()) {
  if (date === utcToday(now)) return null;
  const yesterday = utcToday(new Date(now.getTime() - 86_400_000));
  return date === yesterday
    ? "TODAY'S RUN HASN'T LANDED YET - SHOWING YESTERDAY"
    : `TODAY'S RUN HASN'T LANDED YET - SHOWING ${signalDate(date).toUpperCase()}`;
}

export function publicationLabel(publishedAt: string, digestDate: string, now = new Date()) {
  const published = new Date(publishedAt);
  if (!Number.isFinite(published.getTime())) return { label: "Date unavailable", timestamp: undefined };
  const timestamp = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
  }).format(published) + " UTC";
  const elapsed = now.getTime() - published.getTime();
  if (digestDate !== utcToday(now) || elapsed < 0) return { label: timestamp, timestamp };
  const minutes = Math.floor(elapsed / 60_000);
  const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const label = minutes < 1 ? "just now"
    : minutes < 60 ? relative.format(-minutes, "minute")
    : minutes < 1440 ? relative.format(-Math.floor(minutes / 60), "hour")
    : relative.format(-Math.floor(minutes / 1440), "day");
  return { label, timestamp };
}