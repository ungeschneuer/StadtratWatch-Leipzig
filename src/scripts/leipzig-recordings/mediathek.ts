export const MEDIATHEK_BASE_URL = 'https://www.leipzig.de';
export const MEDIATHEK_LISTING_URL = `${MEDIATHEK_BASE_URL}/mediathek/video`;

const RECORDING_PATH_PREFIX = '/mediathek/video/aufzeichnung-der-ratsversammlung-vom-';

const GERMAN_MONTH_SLUGS = [
  'januar',
  'februar',
  'maerz',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'dezember',
];

const GERMAN_MONTH_NAMES = [
  'januar',
  'februar',
  'märz',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'dezember',
];

export type PlayerReference = {
  serverIp: string;
  serverApp: string;
  streamName: string;
};

export type RecordingPage = {
  title: string;
  date: string;
  player: PlayerReference;
  // The hoster's player page that leipzig.de embeds; it accepts `startsekunde` for links to a moment.
  playerUrl: string;
};

export function findRecordingPageUrls(listingHtml: string): string[] {
  const pattern = new RegExp(`href="(${escapeRegExp(RECORDING_PATH_PREFIX)}[^"#?]+)"`, 'g');
  const paths = new Set<string>();
  for (const match of listingHtml.matchAll(pattern)) {
    paths.add(match[1]);
  }
  return [...paths].sort().map((path) => `${MEDIATHEK_BASE_URL}${path}`);
}

// The city names the pages inconsistently ("vom-28102026" next to "vom-29-oktober-2026"), so every known variant is tried.
export function recordingPageUrlCandidates(isoDate: string): string[] {
  const [year, month, day] = isoDate.split('-');
  const monthSlug = GERMAN_MONTH_SLUGS[Number(month) - 1];
  const slugs = [`${day}${month}${year}`, `${Number(day)}-${monthSlug}-${year}`, `${day}-${monthSlug}-${year}`];
  return [...new Set(slugs)].map((slug) => `${MEDIATHEK_BASE_URL}${RECORDING_PATH_PREFIX}${slug}`);
}

export function parseRecordingPage(html: string): RecordingPage {
  const title = decodeHtmlEntities(matchOrThrow(html, /<title>([^<]*)<\/title>/, 'page title')).trim();
  const date = parseGermanDate(title);
  if (!date) {
    throw new Error(`No session date in page title "${title}"`);
  }
  const playerUrl = parsePlayerUrl(html);
  return { title, date, player: parsePlayerReference(playerUrl), playerUrl };
}

export function parseGermanDate(text: string): string | undefined {
  const numeric = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  if (numeric) {
    return toIsoDate(numeric[3], numeric[2], numeric[1]);
  }
  const written = text.toLowerCase().match(/\b(\d{1,2})\.\s*([a-zä]+)\s+(\d{4})\b/);
  if (written) {
    const monthIndex = GERMAN_MONTH_NAMES.indexOf(written[2]);
    if (monthIndex >= 0) {
      return toIsoDate(written[3], String(monthIndex + 1), written[1]);
    }
  }
  return undefined;
}

function parsePlayerUrl(html: string): string {
  const iframeTag = matchOrThrow(html, /<iframe[^>]*class="media-player-iframe"[^>]*>/, 'media player iframe');
  return decodeHtmlEntities(matchOrThrow(iframeTag, /\bsrc="([^"]+)"/, 'media player iframe src'));
}

function parsePlayerReference(source: string): PlayerReference {
  const parameters = new URL(source).searchParams;
  const serverIp = parameters.get('serverip');
  const serverApp = parameters.get('serverapp');
  const streamName = parameters.get('streamname') ?? parameters.get('smil');
  if (!serverIp || !serverApp || !streamName) {
    throw new Error(`Media player iframe misses serverip, serverapp or stream name: ${source}`);
  }
  return { serverIp, serverApp, streamName };
}

function toIsoDate(year: string, month: string, day: string): string {
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function matchOrThrow(text: string, pattern: RegExp, description: string): string {
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`No ${description} found`);
  }
  return match[1] ?? match[0];
}

function decodeHtmlEntities(text: string): string {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
