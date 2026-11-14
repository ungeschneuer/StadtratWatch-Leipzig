import type { JsonStore } from './json-file-store.ts';

export type HttpResponse = { status: number; body: string; headers?: Record<string, string> };

export type HttpClient = {
  getText(url: string, requestHeaders?: Record<string, string>): Promise<HttpResponse>;
  postJson(url: string, payload: object): Promise<unknown>;
};

export const DEFAULT_USER_AGENT =
  'StadtratWatch-Leipzig-Scraper/0.1 (+https://github.com/ungeschneuer/StadtratWatch-Leipzig)';

// A pause between requests keeps the load on the city's and the hoster's servers low.
export function createPoliteHttpClient(userAgent: string, pauseMilliseconds: number): HttpClient {
  let lastRequestAt = 0;

  async function waitForTurn() {
    const waitMilliseconds = lastRequestAt + pauseMilliseconds - Date.now();
    if (waitMilliseconds > 0) {
      await Bun.sleep(waitMilliseconds);
    }
    lastRequestAt = Date.now();
  }

  return {
    async getText(url, requestHeaders = {}) {
      await waitForTurn();
      const response = await fetch(url, {
        headers: { ...requestHeaders, 'User-Agent': userAgent },
        signal: AbortSignal.timeout(60_000),
      });
      return {
        status: response.status,
        body: await response.text(),
        headers: Object.fromEntries(response.headers.entries()),
      };
    },
    async postJson(url, payload) {
      await waitForTurn();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': userAgent, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(`POST ${url} answered ${response.status}`);
      }
      return response.json();
    },
  };
}

// OParl and ALLRIS time out or answer 5xx now and then; a later attempt usually succeeds. Other statuses are final.
const RETRY_PAUSES_MILLISECONDS = [5_000, 20_000];

export async function getTextOrThrow(
  http: HttpClient,
  url: string,
  retryPauses: number[] = RETRY_PAUSES_MILLISECONDS,
): Promise<string> {
  return (await getResponseOrThrow(http, url, {}, [200], retryPauses)).body;
}

async function getResponseOrThrow(
  http: HttpClient,
  url: string,
  requestHeaders: Record<string, string>,
  acceptedStatuses: number[],
  retryPauses: number[],
): Promise<HttpResponse> {
  for (let attempt = 0; ; attempt++) {
    const outcome = await http.getText(url, requestHeaders).then(
      (response) => response,
      (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (!(outcome instanceof Error) && acceptedStatuses.includes(outcome.status)) return outcome;
    const failure = outcome instanceof Error ? outcome : new Error(`GET ${url} answered ${outcome.status}`);
    const retryable = outcome instanceof Error || outcome.status === 429 || outcome.status >= 500;
    if (!retryable || attempt >= retryPauses.length) throw failure;
    await Bun.sleep(retryPauses[attempt]);
  }
}

type RevalidatedText = { url: string; etag: string | null; lastModified: string | null; body: string };

export type RevalidatedTextResult = { body: string; notModified: boolean };

// A file that rarely changes is asked for with the validators of the stored copy; the server then answers 304 without
// sending it again. A server without ETag or Last-Modified gets a plain request, as before.
export async function getTextRevalidated(
  http: HttpClient,
  url: string,
  store: JsonStore,
  retryPauses: number[] = RETRY_PAUSES_MILLISECONDS,
): Promise<RevalidatedTextResult> {
  const stored = await store.read<RevalidatedText>(url);
  const usable = stored !== null && stored.url === url && typeof stored.body === 'string' ? stored : null;
  const response = await getResponseOrThrow(
    http,
    url,
    usable ? validatorHeaders(usable) : {},
    usable ? [200, 304] : [200],
    retryPauses,
  );
  if (response.status === 304 && usable) return { body: usable.body, notModified: true };
  const headers = lowerCaseKeys(response.headers ?? {});
  await store.write(url, {
    url,
    etag: headers['etag'] ?? null,
    lastModified: headers['last-modified'] ?? null,
    body: response.body,
  } satisfies RevalidatedText);
  return { body: response.body, notModified: false };
}

function validatorHeaders(stored: RevalidatedText): Record<string, string> {
  const headers: Record<string, string> = {};
  if (stored.etag) headers['If-None-Match'] = stored.etag;
  if (stored.lastModified) headers['If-Modified-Since'] = stored.lastModified;
  return headers;
}

function lowerCaseKeys(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
}
