import type { JsonStore } from './json-file-store.ts';
import { followOparlPages } from './oparl-pages.ts';

export type OparlObject = { id: string; deleted?: boolean };

type CachedOparlList<T> = {
  listUrl: string;
  fullFetchStartedAt: string;
  fetchStartedAt: string;
  items: T[];
};

export type IncrementalListOptions = {
  fetchJson: (url: string) => Promise<unknown>;
  store: JsonStore;
  now: Date;
  fullRefreshAfterDays?: number;
};

export type IncrementalListResult<T> = { items: T[]; mode: 'full' | 'incremental'; changedItems: number };

// A weekly full download catches what an incremental one cannot: an object the server changed without updating its
// `modified` date, or a cache that was restored from an older run.
const DEFAULT_FULL_REFRESH_AFTER_DAYS = 7;

// `modified_since` asks from a little before the previous run started, so a change made during that run, or a server
// clock that runs behind, is not missed. Merging by ID makes the overlap harmless.
const MODIFIED_SINCE_OVERLAP_MILLISECONDS = 24 * 60 * 60 * 1000;

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

// OParl 1.1 lists only return the objects changed since `modified_since`, deleted ones included with `deleted: true`.
// The complete list is the cached one with those changes applied; deleted objects are left out, as in a full list.
export async function fetchOparlListIncrementally<T extends OparlObject>(
  listUrl: string,
  { fetchJson, store, now, fullRefreshAfterDays = DEFAULT_FULL_REFRESH_AFTER_DAYS }: IncrementalListOptions,
): Promise<IncrementalListResult<T>> {
  const cached = await store.read<CachedOparlList<T>>(listUrl);
  const fetchStartedAt = now.toISOString();

  if (!isUsableForIncrementalFetch(cached, listUrl, now, fullRefreshAfterDays)) {
    const items = withoutDeleted(await fetchAllPages<T>(fetchJson, listUrl));
    await store.write(listUrl, { listUrl, fullFetchStartedAt: fetchStartedAt, fetchStartedAt, items });
    return { items, mode: 'full', changedItems: items.length };
  }

  const modifiedSince = new Date(Date.parse(cached.fetchStartedAt) - MODIFIED_SINCE_OVERLAP_MILLISECONDS);
  const changes = await fetchAllPages<T>(fetchJson, withModifiedSince(listUrl, modifiedSince));
  const items = applyChanges(cached.items, changes);
  await store.write(listUrl, { ...cached, fetchStartedAt, items });
  return { items, mode: 'incremental', changedItems: changes.length };
}

function isUsableForIncrementalFetch<T>(
  cached: CachedOparlList<T> | null,
  listUrl: string,
  now: Date,
  fullRefreshAfterDays: number,
): cached is CachedOparlList<T> {
  if (!cached || cached.listUrl !== listUrl || !Array.isArray(cached.items)) return false;
  const fullFetchAge = now.getTime() - Date.parse(cached.fullFetchStartedAt);
  const lastFetchAge = now.getTime() - Date.parse(cached.fetchStartedAt);
  return fullFetchAge >= 0 && fullFetchAge < fullRefreshAfterDays * DAY_MILLISECONDS && lastFetchAge >= 0;
}

export function withModifiedSince(listUrl: string, modifiedSince: Date): string {
  const url = new URL(listUrl);
  url.searchParams.set('modified_since', modifiedSince.toISOString());
  return url.toString();
}

export function applyChanges<T extends OparlObject>(items: T[], changes: T[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const change of changes) {
    if (change.deleted) byId.delete(change.id);
    else byId.set(change.id, change);
  }
  return [...byId.values()];
}

function withoutDeleted<T extends OparlObject>(items: T[]): T[] {
  return items.filter((item) => !item.deleted);
}

async function fetchAllPages<T>(fetchJson: (url: string) => Promise<unknown>, firstPageUrl: string): Promise<T[]> {
  const items: T[] = [];
  for await (const page of followOparlPages<T>(fetchJson, firstPageUrl)) items.push(...page.data);
  return items;
}
