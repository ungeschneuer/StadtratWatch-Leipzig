export type HttpResponse = { status: number; body: string };

export type HttpClient = {
  getText(url: string): Promise<HttpResponse>;
  postJson(url: string, payload: object): Promise<unknown>;
};

export const DEFAULT_USER_AGENT =
  'StadtratWatch-Leipzig-Scraper/0.1 (+https://github.com/ungeschneuer/StadtratWatch-web)';

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
    async getText(url) {
      await waitForTurn();
      const response = await fetch(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(60_000) });
      return { status: response.status, body: await response.text() };
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
  for (let attempt = 0; ; attempt++) {
    const outcome = await http.getText(url).then(
      (response) => response,
      (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (!(outcome instanceof Error) && outcome.status === 200) return outcome.body;
    const failure = outcome instanceof Error ? outcome : new Error(`GET ${url} answered ${outcome.status}`);
    const retryable = outcome instanceof Error || outcome.status === 429 || outcome.status >= 500;
    if (!retryable || attempt >= retryPauses.length) throw failure;
    await Bun.sleep(retryPauses[attempt]);
  }
}
