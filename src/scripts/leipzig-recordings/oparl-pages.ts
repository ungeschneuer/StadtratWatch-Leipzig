type OparlPage<T> = { data: T[]; links?: { next?: string } };

// OParl lists are paged through `links.next`. A server that hands out a page it already gave, or pages without end,
// would keep the run looping; such a list fails instead.
const MAXIMUM_PAGES = 500;

export async function* followOparlPages<T>(
  fetchJson: (url: string) => Promise<unknown>,
  firstPageUrl: string,
): AsyncGenerator<OparlPage<T>> {
  const visited = new Set<string>();
  let pageUrl: string | undefined = firstPageUrl;
  while (pageUrl) {
    if (visited.has(pageUrl)) throw new Error(`OParl list ${firstPageUrl} returns page ${pageUrl} twice`);
    if (visited.size >= MAXIMUM_PAGES)
      throw new Error(`OParl list ${firstPageUrl} has more than ${MAXIMUM_PAGES} pages`);
    visited.add(pageUrl);
    const page = (await fetchJson(pageUrl)) as OparlPage<T>;
    yield page;
    pageUrl = page.links?.next;
  }
}
