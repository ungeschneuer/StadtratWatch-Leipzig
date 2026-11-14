import { describe, expect, it } from 'bun:test';

import { applyChanges, fetchOparlListIncrementally, withModifiedSince } from './incremental-oparl-list.ts';
import { createMemoryJsonStore } from './json-file-store.ts';

const LIST_URL = 'https://oparl.example/bodies/1/persons?size=100';

type Person = { id: string; name: string; deleted?: boolean };

function fakeOparl(pagesByUrl: Record<string, { data: Person[]; links?: { next?: string } }>) {
  const requested: string[] = [];
  return {
    requested,
    fetchJson(url: string) {
      requested.push(url);
      const page = pagesByUrl[url];
      return page ? Promise.resolve(page) : Promise.reject(new Error(`unexpected request ${url}`));
    },
  };
}

const firstRun = new Date('2026-11-10T04:43:00Z');
const nextDay = new Date('2026-11-11T04:43:00Z');

describe('fetchOparlListIncrementally', () => {
  it('downloads every page when nothing is cached', async () => {
    const oparl = fakeOparl({
      [LIST_URL]: { data: [{ id: 'p1', name: 'A' }], links: { next: `${LIST_URL}&page=2` } },
      [`${LIST_URL}&page=2`]: { data: [{ id: 'p2', name: 'B' }] },
    });

    const result = await fetchOparlListIncrementally<Person>(LIST_URL, {
      fetchJson: oparl.fetchJson,
      store: createMemoryJsonStore(),
      now: firstRun,
    });

    expect(result.mode).toEqual('full');
    expect(result.items.map((person) => person.id)).toEqual(['p1', 'p2']);
  });

  it('asks only for changes since a day before the previous run and applies them', async () => {
    const store = createMemoryJsonStore();
    const changesUrl = withModifiedSince(LIST_URL, new Date('2026-11-09T04:43:00Z'));
    const oparl = fakeOparl({
      [LIST_URL]: {
        data: [
          { id: 'p1', name: 'A' },
          { id: 'p2', name: 'B' },
          { id: 'p3', name: 'C' },
        ],
      },
      [changesUrl]: {
        data: [
          { id: 'p2', name: 'B renamed' },
          { id: 'p3', name: 'C', deleted: true },
          { id: 'p4', name: 'D' },
        ],
      },
    });
    const options = { fetchJson: oparl.fetchJson, store };

    await fetchOparlListIncrementally<Person>(LIST_URL, { ...options, now: firstRun });
    const result = await fetchOparlListIncrementally<Person>(LIST_URL, { ...options, now: nextDay });

    expect(oparl.requested.at(-1)).toEqual(changesUrl);
    expect(result).toEqual({
      mode: 'incremental',
      changedItems: 3,
      items: [
        { id: 'p1', name: 'A' },
        { id: 'p2', name: 'B renamed' },
        { id: 'p4', name: 'D' },
      ],
    });
  });

  it('downloads everything again once the last full download is a week old', async () => {
    const store = createMemoryJsonStore();
    const oparl = fakeOparl({ [LIST_URL]: { data: [{ id: 'p1', name: 'A' }] } });
    const options = { fetchJson: oparl.fetchJson, store };

    await fetchOparlListIncrementally<Person>(LIST_URL, { ...options, now: firstRun });
    const result = await fetchOparlListIncrementally<Person>(LIST_URL, {
      ...options,
      now: new Date('2026-11-17T04:43:00Z'),
    });

    expect(result.mode).toEqual('full');
    expect(oparl.requested).toEqual([LIST_URL, LIST_URL]);
  });

  it('downloads everything when the cache belongs to another list or cannot be read', async () => {
    const store = createMemoryJsonStore();
    store.entries.set(LIST_URL, { listUrl: LIST_URL, fullFetchStartedAt: 'yesterday', fetchStartedAt: 'x', items: [] });
    const oparl = fakeOparl({ [LIST_URL]: { data: [{ id: 'p1', name: 'A' }] } });

    const result = await fetchOparlListIncrementally<Person>(LIST_URL, {
      fetchJson: oparl.fetchJson,
      store,
      now: firstRun,
    });

    expect(result.mode).toEqual('full');
  });

  it('leaves deleted objects out of a full download', async () => {
    const oparl = fakeOparl({
      [LIST_URL]: {
        data: [
          { id: 'p1', name: 'A' },
          { id: 'p2', name: 'B', deleted: true },
        ],
      },
    });

    const result = await fetchOparlListIncrementally<Person>(LIST_URL, {
      fetchJson: oparl.fetchJson,
      store: createMemoryJsonStore(),
      now: firstRun,
    });

    expect(result.items.map((person) => person.id)).toEqual(['p1']);
  });

  it('keeps the cache unchanged when a download fails', async () => {
    const store = createMemoryJsonStore();
    const working = fakeOparl({ [LIST_URL]: { data: [{ id: 'p1', name: 'A' }] } });
    await fetchOparlListIncrementally<Person>(LIST_URL, { fetchJson: working.fetchJson, store, now: firstRun });
    const cachedBefore = structuredClone(store.entries.get(LIST_URL));

    const failing = fakeOparl({});
    await expect(
      fetchOparlListIncrementally<Person>(LIST_URL, { fetchJson: failing.fetchJson, store, now: nextDay }),
    ).rejects.toThrow('unexpected request');
    expect(store.entries.get(LIST_URL)).toEqual(cachedBefore);
  });
});

describe('withModifiedSince', () => {
  it('keeps the existing query and adds the date in UTC', () => {
    expect(withModifiedSince(LIST_URL, new Date('2026-11-09T04:43:00Z'))).toEqual(
      'https://oparl.example/bodies/1/persons?size=100&modified_since=2026-11-09T04%3A43%3A00.000Z',
    );
  });
});

describe('applyChanges', () => {
  it('keeps the order of known objects and appends new ones', () => {
    const items = [
      { id: 'a', name: '1' },
      { id: 'b', name: '2' },
    ];

    expect(
      applyChanges(items, [
        { id: 'c', name: '3' },
        { id: 'a', name: '1 changed' },
      ]),
    ).toEqual([
      { id: 'a', name: '1 changed' },
      { id: 'b', name: '2' },
      { id: 'c', name: '3' },
    ]);
  });
});
