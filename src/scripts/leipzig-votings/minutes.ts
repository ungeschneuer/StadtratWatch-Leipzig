import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// The minutes (Niederschrift, „Beschlussprotokoll“) that OParl links as `resultsProtocol` list the official result of
// every vote: per agenda item, per point when points were voted on separately, and procedural motions with their
// counts. They are the strongest independent source for the board reading and cover sessions without subtitles.

export type PdfTextItem = { page: number; x: number; y: number; text: string };

export type MinutesVote = {
  // Position in the minutes, which follow the agenda.
  order: number;
  agendaItemNumber: string;
  paperReference: string | null;
  // The line that introduces the result: „Abstimmungsergebnis zu Punkt 2:“, or the sentence of a procedural motion.
  label: string;
  procedural: boolean;
  J: number;
  N: number;
  E: number;
};

// Raised whenever parseMinutes changes, so stored minutes are parsed again from the cached PDF.
export const MINUTES_PARSER_VERSION = 4;

export type MinutesFile = {
  sessionId: string;
  // beschlussprotokoll: the minutes PDF; agenda-item-pages: the ALLRIS pages of the items, until the minutes appear.
  kind: 'beschlussprotokoll' | 'agenda-item-pages';
  source: string;
  fetchedAt: string;
  parserVersion: number;
  votes: MinutesVote[];
};

export async function extractPdfText(pdf: Uint8Array): Promise<PdfTextItem[]> {
  const loadingTask = getDocument({ data: pdf, verbosity: 0 });
  const document = await loadingTask.promise;
  const items: PdfTextItem[] = [];
  for (let page = 1; page <= document.numPages; page++) {
    const content = await (await document.getPage(page)).getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || item.str.trim() === '') continue;
      items.push({ page, x: Math.round(item.transform[4]), y: Math.round(item.transform[5]), text: item.str });
    }
  }
  await loadingTask.destroy();
  return items;
}

// Layout of the Leipzig minutes: the agenda item number sits in a narrow left column (wrapping „19.5“ / „.1“ or „19.1“ /
// „3.1“), the
// paper reference in a right column (wrapping „VIII-DS-01619-NF-02-“ / „ÄA-01“), the text in between.
// Agenda numbers start at x = 45 in every minutes so far; numbered list items of a resolution start at 53.
const NUMBER_COLUMN_RIGHT = 50;
const PAPER_COLUMN_LEFT = 400;
// The paper reference can sit a few points higher than the number of its row.
const LINE_TOLERANCE = 6;
const NUMBER_CONTINUATION_DISTANCE = 16;
const PAGE_TOP = 740;
const PAGE_BOTTOM = 120;

type Line = { page: number; y: number; number: string | null; paper: string | null; text: string };

function toLines(items: PdfTextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: { page: number; y: number; items: PdfTextItem[] }[] = [];
  for (const item of sorted) {
    const line = lines.at(-1);
    if (line && line.page === item.page && Math.abs(line.y - item.y) <= LINE_TOLERANCE) line.items.push(item);
    else lines.push({ page: item.page, y: item.y, items: [item] });
  }
  return lines.map(({ page, y, items: lineItems }) => {
    const part = (accept: (item: PdfTextItem) => boolean) =>
      lineItems
        .filter(accept)
        .map((item) => item.text.trim())
        .join(' ')
        .trim();
    const number = part((item) => item.x < NUMBER_COLUMN_RIGHT);
    const paper = part((item) => item.x >= PAPER_COLUMN_LEFT);
    return {
      page,
      y,
      number: number || null,
      paper: paper || null,
      text: part((item) => item.x >= NUMBER_COLUMN_RIGHT && item.x < PAPER_COLUMN_LEFT),
    };
  });
}

type AgendaBlock = { number: string; paper: string | null; lines: string[] };

function toAgendaBlocks(lines: Line[]): AgendaBlock[] {
  const blocks: AgendaBlock[] = [];
  let previousNumberLine: Line | null = null;
  for (const line of lines) {
    if (line.number) {
      const block = blocks.at(-1);
      if (block && previousNumberLine && continuesNumber(previousNumberLine, line)) {
        block.number += line.number;
      } else {
        blocks.push({ number: line.number, paper: null, lines: [] });
      }
      previousNumberLine = line;
    }
    const block = blocks.at(-1);
    if (!block) continue;
    if (line.paper && /^(?:V[IVX]*-|[A-ZÄÖÜ][A-Za-zÄÖÜäöü]{0,3}-\d|\d)/.test(line.paper)) {
      block.paper = joinPaperParts(block.paper, line.paper);
    }
    if (line.text) block.lines.push(line.text);
  }
  return blocks
    .map((block) => ({ ...block, number: block.number.replaceAll(/\s/g, '') }))
    .filter((block) => /^\d+(?:\.\d+)*$/.test(block.number));
}

function continuesNumber(previous: Line, line: Line): boolean {
  if (!/^[\d.]+$/.test(line.number ?? '')) return false;
  if (previous.page === line.page) return previous.y - line.y <= NUMBER_CONTINUATION_DISTANCE;
  return line.page === previous.page + 1 && previous.y <= PAGE_BOTTOM && line.y >= PAGE_TOP;
}

function joinPaperParts(known: string | null, part: string): string {
  if (!known) return part;
  return known.endsWith('-') ? `${known}${part}` : known;
}

const COUNT_LINE = { J: /^Ja-Stimmen:\s*(\d+)/, N: /^Nein-Stimmen:\s*(\d+)/, E: /^Enthaltungen:\s*(\d+)/ };
const INLINE_RESULT = /\((?:Abstimmungsergebnis:\s*)?(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})\)/g;
const PROCEDURAL =
  /Geschäftsordnung|Vertagung|vertagen|Absetzung|abzusetzen|Rückverweis|zurückzuverweisen|Rederecht|Redezeit|Rednerliste|Ende der Debatte|Schluss der Debatte|Unterbrechung|Reihenfolge/i;

export function parseMinutes(items: PdfTextItem[]): MinutesVote[] {
  const votes: MinutesVote[] = [];
  for (const block of toAgendaBlocks(toLines(items))) {
    for (const result of resultsInLines(block.lines)) {
      votes.push({ order: votes.length, agendaItemNumber: block.number, paperReference: block.paper, ...result });
    }
  }
  return votes;
}

type LineResult = Pick<MinutesVote, 'label' | 'procedural' | 'J' | 'N' | 'E'>;

// Results inside the text of one agenda item: „Ja-Stimmen: 28 / Nein-Stimmen: 31 / Enthaltungen: 1“ on three lines, or
// a procedural motion with its result in brackets („wird abgelehnt (25/28/0)“).
export function resultsInLines(lines: string[]): LineResult[] {
  const results: LineResult[] = [];
  const add = (label: string, J: number, N: number, E: number) =>
    results.push({ label, procedural: PROCEDURAL.test(label), J, N, E });

  const text = lines.join(' ');
  for (const match of text.matchAll(INLINE_RESULT)) {
    add(sentenceBefore(text, match.index), Number(match[1]), Number(match[2]), Number(match[3]));
  }
  lines.forEach((line, index) => {
    const yes = line.match(COUNT_LINE.J);
    const no = lines[index + 1]?.match(COUNT_LINE.N);
    const abstentions = lines[index + 2]?.match(COUNT_LINE.E);
    if (!yes || !no || !abstentions) return;
    add(labelBefore(lines, index), Number(yes[1]), Number(no[1]), Number(abstentions[1]));
  });
  return results;
}

// The agenda item page of ALLRIS (to020) shows the same results as the minutes, a few days after the session.
export function parseAgendaItemPage(lines: string[]): Omit<MinutesVote, 'order'>[] {
  const after = (label: string) => lines[lines.indexOf(label) + 1] ?? '';
  const agendaItemNumber = after('TOP:')
    .replace(/^[ÖN]\s*/, '')
    .trim();
  const paperReference = after('Vorlage:').match(/^(V[IVX]*-\S+)/)?.[1] ?? null;
  const start = lines.findIndex((line) => line === 'Abstimmungsergebnis');
  if (!/^\d+(?:\.\d+)*$/.test(agendaItemNumber) || start < 0) return [];
  return resultsInLines(lines.slice(start + 1)).map((result) => ({ agendaItemNumber, paperReference, ...result }));
}

function sentenceBefore(text: string, offset: number): string {
  const start = Math.max(text.lastIndexOf('. ', offset) + 2, text.lastIndexOf(': ', offset) + 2, 0);
  return text.slice(start, offset).trim();
}

// The result of an item is introduced by „Abstimmungsergebnis …:“; a procedural motion in the agenda confirmation by its
// own sentence („Der Absetzungsantrag … wird mit folgendem Abstimmungsergebnis abgelehnt:“).
function labelBefore(lines: string[], countIndex: number): string {
  const previous = lines[countIndex - 1] ?? '';
  if (/folgendem Abstimmungsergebnis/i.test(previous)) return sentenceEndingAt(lines, countIndex - 1);
  // „Abstimmungsergebnis:“, „Abstimmungsergebnis zu Punkt 2:“, or „zu Beschlusspunkt 2:“ below a shared heading.
  if (/^Abstimmungsergebnis/i.test(previous)) return previous;
  if (/:$/.test(previous) && previous.length < 80) {
    const heading = lines.slice(0, countIndex - 1).findLast((line) => /^Abstimmungsergebnis/i.test(line));
    return heading ? `${heading} ${previous}` : previous;
  }
  return sentenceEndingAt(lines, countIndex - 1);
}

function sentenceEndingAt(lines: string[], lastIndex: number): string {
  const sentence: string[] = [];
  for (let index = lastIndex; index >= 0 && sentence.length < 4; index--) {
    sentence.unshift(lines[index]);
    if (/^[-–•]\s|^Der |^Die |^Das |^Ein /.test(lines[index])) break;
  }
  return sentence.join(' ').replaceAll(/\s+/g, ' ').trim();
}
