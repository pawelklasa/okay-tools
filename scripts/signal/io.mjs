import { readFile, readdir, mkdir, open, rename, unlink, link } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { safeUrl, plainText } from './core.mjs';

const httpUrl = z.string().refine(value => safeUrl(value) !== null, 'Expected a safe HTTP(S) URL');
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T05:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const words = value => value.trim().split(/\s+/).filter(Boolean).length;
const textSchema = z.string().min(1).refine(value => plainText(value, Infinity) === value, 'Expected nonempty plain text');
export const summarySchema = textSchema.refine(value => words(value) <= 40);
export const whySchema = textSchema.refine(value => words(value) <= 12);
export const configSchema = z.object({
  name: z.string().min(1), path: z.string().regex(/^\/[a-z0-9-]+$/), siteUrl: httpUrl, contactUrl: httpUrl,
  model: z.string().min(1), readerProfile: z.string().min(1),
  workspaceId: z.string().regex(/^wrkspc_[A-Za-z0-9]+$/).optional(),
  tags: z.array(z.string().min(1)).min(1).refine(tags => new Set(tags).size === tags.length),
}).strict();
export const sourcesSchema = z.array(z.object({
  name: z.string().min(1), site: httpUrl, feed: httpUrl.nullable(),
  weight: z.number().positive().finite().default(1),
}).strict()).refine(sources => new Set(sources.map(source => source.name)).size === sources.length);

export function digestSchema(config) {
  return z.object({
    date: dateString, scanned: z.number().int().nonnegative(), kept: z.number().int().nonnegative(),
    sources: z.array(textSchema).refine(sources => new Set(sources).size === sources.length).optional(),
    items: z.array(z.object({
      rank: z.number().int().positive(), title: textSchema, url: httpUrl,
      source: textSchema, publishedAt: z.iso.datetime(),
      score: z.number().int().min(0).max(100), summary: summarySchema,
      tags: z.array(z.enum(config.tags)).min(1).max(3).refine(tags => new Set(tags).size === tags.length),
      why: whySchema,
    }).strict()).max(10),
  }).strict().refine(digest => digest.kept === digest.items.length && digest.kept <= digest.scanned,
    'Kept must equal item count and not exceed scanned')
    .refine(digest => digest.items.every((item, index) => item.rank === index + 1), 'Ranks must be sequential and one-based');
}

export async function readConfig(root) {
  const config = configSchema.parse(JSON.parse(await readFile(path.join(root, 'config/signal.json'), 'utf8')));
  const sources = sourcesSchema.parse(JSON.parse(await readFile(path.join(root, 'config/signal-sources.json'), 'utf8')));
  return { config, sources };
}

export async function readHistory(dataDir, config) {
  let names;
  try {
    names = await readdir(dataDir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error('Cannot read Signal history directory');
  }
  return Promise.all(names.filter(name => name.endsWith('.json')).sort().map(async name => {
    try {
      const digest = digestSchema(config).parse(JSON.parse(await readFile(path.join(dataDir, name), 'utf8')));
      if (name !== `${digest.date}.json`) throw new Error('Date mismatch');
      return digest;
    } catch {
      throw new Error(`Invalid or unreadable Signal history: ${name}`);
    }
  }));
}

export async function atomicJson(file, value, exclusive = false) {
  await atomicWrite(file, `${JSON.stringify(value, null, 2)}\n`, exclusive);
}

export async function atomicWrite(file, content, exclusive = false) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, 'wx');
    try {
      await handle.writeFile(content, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (exclusive) await link(temporary, file);
    else await rename(temporary, file);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}