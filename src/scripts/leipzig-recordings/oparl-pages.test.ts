import { describe, expect, it } from 'bun:test';

import { followOparlPages } from './oparl-pages.ts';

async function collect(pages: Record<string, unknown>, first: string): Promise<number[]> {
  const items: number[] = [];
  for await (const page of followOparlPages<number>((url) => Promise.resolve(pages[url]), first))
    items.push(...page.data);
  return items;
}

describe('followOparlPages', () => {
  it('follows next links to the last page', async () => {
    const pages = { a: { data: [1], links: { next: 'b' } }, b: { data: [2] } };

    expect(await collect(pages, 'a')).toEqual([1, 2]);
  });

  it('fails instead of looping when a page links back', async () => {
    const pages = { a: { data: [1], links: { next: 'b' } }, b: { data: [2], links: { next: 'a' } } };

    await expect(collect(pages, 'a')).rejects.toThrow('returns page a twice');
  });

  it('fails on a list without end', async () => {
    const endless = new Proxy({}, { get: (_, url) => ({ data: [], links: { next: `${String(url)}x` } }) });

    await expect(collect(endless as Record<string, unknown>, 'p')).rejects.toThrow('more than 500 pages');
  });
});
