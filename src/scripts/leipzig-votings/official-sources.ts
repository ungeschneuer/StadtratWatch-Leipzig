import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  agendaItemPagePath,
  ALLRIS_BASE_URL,
  type AllrisClient,
  findAttachmentPath,
  listAgendaItemIds,
  meetingPagePath,
  pageLines,
} from './allris.ts';
import {
  extractPdfText,
  MINUTES_PARSER_VERSION,
  type MinutesFile,
  type MinutesVote,
  parseAgendaItemPage,
  parseMinutes,
} from './minutes.ts';
import type { OfficialSources } from './official-result.ts';
import {
  extractPdfLines,
  parseVerlaufsprotokoll,
  VERLAUF_PARSER_VERSION,
  type VerlaufFile,
} from './verlaufsprotokoll.ts';

export type SourceContext = {
  sessionId: string;
  oparlMeetingId: string | null;
  dataDir: string;
  cacheDir: string;
  offline: boolean;
  fetchJson: (url: string) => Promise<unknown>;
  allris: AllrisClient;
  warn: (message: string) => void;
  now: Date;
};

// The agenda item pages are read until the minutes appear; as results are entered over days, they are read again at
// most this often.
const AGENDA_ITEM_PAGES_REFRESH_MILLISECONDS = 20 * 60 * 60 * 1000;

export async function loadOfficialSources(context: SourceContext): Promise<OfficialSources> {
  const meetingPage = await meetingPageOf(context);
  return {
    minutes: await loadMinutes(context, meetingPage),
    verlauf: await loadVerlauf(context, meetingPage),
  };
}

function sessionFile(context: SourceContext, name: string): string {
  return join(context.dataDir, context.sessionId, `${name}-${context.sessionId}.json`);
}

function cachedPdf(context: SourceContext, name: string): string {
  return join(context.cacheDir, 'official', `${name}-${context.sessionId}.pdf`);
}

async function readJson<T>(path: string): Promise<T | null> {
  return readFile(path, 'utf-8')
    .then((json) => JSON.parse(json) as T)
    .catch(() => null);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readCachedPdf(path: string): Promise<Uint8Array | null> {
  return readFile(path)
    .then((bytes) => new Uint8Array(bytes))
    .catch(() => null);
}

async function cachePdf(path: string, pdf: Uint8Array): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, pdf);
}

let meetingPages = new Map<string, Promise<string | null>>();

// For tests: forget the meeting pages read so far.
export function forgetMeetingPages() {
  meetingPages = new Map();
}

function meetingPageOf(context: SourceContext): Promise<string | null> {
  const id = numericId(context.oparlMeetingId);
  if (!id || context.offline) return Promise.resolve(null);
  if (!meetingPages.has(id)) {
    meetingPages.set(
      id,
      context.allris.getText(meetingPagePath(id)).catch((error: unknown) => {
        context.warn(`${context.sessionId}: ALLRIS meeting page not readable (${String(error)})`);
        return null;
      }),
    );
  }
  return meetingPages.get(id) as Promise<string | null>;
}

// --- Minutes (Beschlussprotokoll), or the agenda item pages until they appear ---

async function loadMinutes(context: SourceContext, meetingPage: string | null): Promise<OfficialSources['minutes']> {
  const path = sessionFile(context, 'minutes');
  const stored = await readJson<MinutesFile>(path);
  const current = stored?.parserVersion === MINUTES_PARSER_VERSION ? stored : null;
  if (current?.kind === 'beschlussprotokoll') return { kind: current.kind, votes: current.votes };

  try {
    const protocol = await readProtocol(context, stored?.kind === 'beschlussprotokoll' ? stored.source : null);
    if (protocol) {
      const file: MinutesFile = {
        sessionId: context.sessionId,
        kind: 'beschlussprotokoll',
        source: protocol.source,
        fetchedAt: context.now.toISOString(),
        parserVersion: MINUTES_PARSER_VERSION,
        votes: parseMinutes(await extractPdfText(protocol.pdf)),
      };
      await writeJson(path, file);
      return { kind: file.kind, votes: file.votes };
    }

    const fresh =
      current?.kind === 'agenda-item-pages' &&
      context.now.getTime() - Date.parse(current.fetchedAt) < AGENDA_ITEM_PAGES_REFRESH_MILLISECONDS;
    if (fresh || context.offline || !meetingPage) {
      return current || stored ? { kind: (current ?? stored)!.kind, votes: (current ?? stored)!.votes } : null;
    }
    const votes = await readAgendaItemPages(context, meetingPage);
    if (votes.length === 0) return null;
    const file: MinutesFile = {
      sessionId: context.sessionId,
      kind: 'agenda-item-pages',
      source: `${ALLRIS_BASE_URL}/${meetingPagePath(numericId(context.oparlMeetingId) ?? '')}`,
      fetchedAt: context.now.toISOString(),
      parserVersion: MINUTES_PARSER_VERSION,
      votes,
    };
    await writeJson(path, file);
    return { kind: file.kind, votes };
  } catch (error) {
    context.warn(`${context.sessionId}: minutes not readable (${error instanceof Error ? error.message : error})`);
    return stored ? { kind: stored.kind, votes: stored.votes } : null;
  }
}

async function readProtocol(
  context: SourceContext,
  knownSource: string | null,
): Promise<{ source: string; pdf: Uint8Array } | null> {
  const pdfPath = cachedPdf(context, 'beschlussprotokoll');
  const cached = await readCachedPdf(pdfPath);
  if (cached && knownSource) return { source: knownSource, pdf: cached };
  if (context.offline || !context.oparlMeetingId) return null;
  const meeting = (await context.fetchJson(context.oparlMeetingId)) as {
    resultsProtocol?: string | { accessUrl?: string };
  };
  const protocol = meeting.resultsProtocol;
  const source = (typeof protocol === 'string' ? protocol : protocol?.accessUrl) ?? null;
  if (!source) return null;
  const pdf = cached ?? (await context.allris.getBytes(source.replace(`${ALLRIS_BASE_URL}/`, '')));
  if (!isPdf(pdf)) throw new Error(`${source} is no PDF`);
  await cachePdf(pdfPath, pdf);
  return { source, pdf };
}

async function readAgendaItemPages(context: SourceContext, meetingPage: string): Promise<MinutesVote[]> {
  const votes: MinutesVote[] = [];
  for (const id of listAgendaItemIds(meetingPage)) {
    const lines = pageLines(await context.allris.getText(agendaItemPagePath(id)));
    for (const vote of parseAgendaItemPage(lines)) votes.push({ order: votes.length, ...vote });
  }
  return votes;
}

// --- Verlaufsprotokoll ---

async function loadVerlauf(context: SourceContext, meetingPage: string | null): Promise<OfficialSources['verlauf']> {
  const path = sessionFile(context, 'verlaufsprotokoll');
  const stored = await readJson<VerlaufFile>(path);
  if (stored?.parserVersion === VERLAUF_PARSER_VERSION) return stored.results;

  const pdfPath = cachedPdf(context, 'verlaufsprotokoll');
  try {
    let pdf = await readCachedPdf(pdfPath);
    let source = stored?.source ?? null;
    if (!pdf) {
      const attachment = meetingPage ? findAttachmentPath(meetingPage, /Verlaufsprotokoll/i) : null;
      if (!attachment) return stored?.results ?? null;
      pdf = await downloadAttachment(context, attachment);
      if (!pdf) return stored?.results ?? null;
      source = `${ALLRIS_BASE_URL}/${meetingPagePath(numericId(context.oparlMeetingId) ?? '')}`;
      await cachePdf(pdfPath, pdf);
    }
    const file: VerlaufFile = {
      sessionId: context.sessionId,
      source: source ?? '',
      fetchedAt: stored?.fetchedAt ?? context.now.toISOString(),
      parserVersion: VERLAUF_PARSER_VERSION,
      results: parseVerlaufsprotokoll(await extractPdfLines(pdf), agendaNumbersOf(meetingPage)),
    };
    await writeJson(path, file);
    return file.results;
  } catch (error) {
    context.warn(
      `${context.sessionId}: Verlaufsprotokoll not readable (${error instanceof Error ? error.message : error})`,
    );
    return stored?.results ?? null;
  }
}

// The attachment link belongs to the server session of the page it was read from; if the answer is not a PDF, the page
// is read again and the link tried once more.
async function downloadAttachment(context: SourceContext, attachment: string): Promise<Uint8Array | null> {
  const first = await context.allris.getBytes(attachment);
  if (isPdf(first)) return first;
  const id = numericId(context.oparlMeetingId);
  if (!id) return null;
  const page = await context.allris.getText(meetingPagePath(id));
  const retry = findAttachmentPath(page, /Verlaufsprotokoll/i);
  if (!retry) return null;
  const second = await context.allris.getBytes(retry);
  return isPdf(second) ? second : null;
}

function isPdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

// The agenda numbers of the meeting page („Ö 19.5.6“) and all their parents.
export function agendaNumbersOf(meetingPage: string | null): Set<string> {
  const numbers = new Set<string>();
  for (const match of (meetingPage ?? '').matchAll(/>\s*[ÖN]\s+(\d+(?:\.\d+)*)\s*</g)) {
    const parts = match[1].split('.');
    parts.forEach((_, index) => numbers.add(parts.slice(0, index + 1).join('.')));
  }
  return numbers;
}

function numericId(url: string | null): string | null {
  return url ? url.slice(url.lastIndexOf('/') + 1) : null;
}
