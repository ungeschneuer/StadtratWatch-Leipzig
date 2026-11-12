// The public ALLRIS pages of the Leipzig council information system. They carry what OParl does not: the official
// result on each agenda item page (to020), available a few days after a session, and the meeting's attachments, among
// them the Verlaufsprotokoll. Attachment links are bound to a server session, so the client keeps its cookies.

export const ALLRIS_BASE_URL = 'https://ratsinformation.leipzig.de/allris_leipzig_public';

const REQUEST_TIMEOUT_MILLISECONDS = 120_000;
const PAUSE_MILLISECONDS = 300;
const RETRY_PAUSE_MILLISECONDS = 5_000;
const MAXIMUM_ATTEMPTS = 3;

export type AllrisClient = {
  getText(path: string): Promise<string>;
  getBytes(path: string): Promise<Uint8Array>;
};

type FetchPage = (url: string, init: RequestInit) => Promise<Response>;

export type AllrisClientOptions = {
  fetchImplementation?: FetchPage;
  pauseMilliseconds?: number;
  retryPauseMilliseconds?: number;
};

// ALLRIS does not answer GitHub's runners at all, while it answers other machines within a second. Waiting out every
// timeout again cost six minutes per session, so the first one ends ALLRIS for the rest of the run.
export class AllrisUnreachableError extends Error {
  constructor(cause: unknown) {
    super(`ALLRIS does not answer (${cause instanceof Error ? cause.message : String(cause)})`, { cause });
    this.name = 'AllrisUnreachableError';
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

export function createAllrisClient(userAgent: string, options: AllrisClientOptions = {}): AllrisClient {
  const fetchImplementation: FetchPage = options.fetchImplementation ?? fetch;
  const pauseMilliseconds = options.pauseMilliseconds ?? PAUSE_MILLISECONDS;
  const retryPauseMilliseconds = options.retryPauseMilliseconds ?? RETRY_PAUSE_MILLISECONDS;
  const cookies = new Map<string, string>();
  let lastRequestAt = 0;
  let unreachable: AllrisUnreachableError | null = null;

  function rememberCookies(response: Response) {
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(';');
      const separator = pair.indexOf('=');
      cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
    }
  }

  async function fetchOnce(path: string): Promise<Response> {
    const wait = lastRequestAt + pauseMilliseconds - Date.now();
    if (wait > 0) await Bun.sleep(wait);
    lastRequestAt = Date.now();
    return await fetchImplementation(`${ALLRIS_BASE_URL}/${path.replace(/^\.?\//, '')}`, {
      headers: {
        'User-Agent': userAgent,
        ...(cookies.size > 0 ? { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
    });
  }

  async function request(path: string): Promise<Response> {
    if (unreachable) throw unreachable;
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await fetchOnce(path);
        rememberCookies(response);
        if (response.status >= 500 && attempt < MAXIMUM_ATTEMPTS) throw new Error(`answered ${response.status}`);
        if (!response.ok) throw new Error(`GET ${path} answered ${response.status}`);
        return response;
      } catch (error) {
        if (isTimeout(error)) {
          unreachable = new AllrisUnreachableError(error);
          throw unreachable;
        }
        if (attempt >= MAXIMUM_ATTEMPTS) throw error;
        await Bun.sleep(retryPauseMilliseconds * attempt);
      }
    }
  }

  return {
    getText: async (path) => (await request(path)).text(),
    getBytes: async (path) => new Uint8Array(await (await request(path)).arrayBuffer()),
  };
}

export function meetingPagePath(meetingNumericId: string): string {
  return `to010?SILFDNR=${meetingNumericId}`;
}

export function agendaItemPagePath(agendaItemNumericId: string): string {
  return `to020?TOLFDNR=${agendaItemNumericId}`;
}

// The link of an attachment on the meeting page, by its title („Verlaufsprotokoll öffentlich“).
export function findAttachmentPath(meetingPage: string, title: RegExp): string | null {
  for (const match of meetingPage.matchAll(
    /<a\s+href="(\.\/to010\?[^"]*attachment[^"]*-link[^"]*)"[^>]*>([^<]+)<\/a>/g,
  )) {
    if (title.test(match[2])) return decodeEntities(match[1]);
  }
  return null;
}

export function listAgendaItemIds(meetingPage: string): string[] {
  return [...new Set([...meetingPage.matchAll(/to020\?TOLFDNR=(\d+)/g)].map((match) => match[1]))];
}

// The page text as lines, without markup, scripts and styles.
export function pageLines(html: string): string[] {
  const text = html
    .replaceAll(/<(script|style)[\s\S]*?<\/\1>/g, '')
    .replaceAll(/<br\s*\/?>|<\/(?:div|p|li|tr|td|th|h\d|dt|dd|span)>/gi, '\n')
    .replaceAll(/<[^>]+>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replaceAll(/\s+/g, ' ').trim())
    .filter((line) => line !== '');
}

function decodeEntities(text: string): string {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')
    .replaceAll(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}
