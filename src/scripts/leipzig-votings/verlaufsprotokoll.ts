import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// The Verlaufsprotokoll is the edited record of what was said in a session, published about two months later. It
// states every electronic result in order („Abstimmung: 33 - 33 - 0. Damit abgelehnt.“) together with what the chair
// said before it, including who was added by hand („Frau Nagel noch nicht. Es kommt einmal Rot dazu.“).

export type VerlaufResult = {
  // Position among the results, which follow the course of the session.
  order: number;
  // The agenda items whose headings precede the result. Items debated together are headed together (19.12 to 19.18).
  agendaItemNumbers: string[];
  J: number;
  N: number;
  E: number;
  line: string;
  // What was said between the previous result and this one, hyphenation removed.
  context: string;
};

// One turn of a speaker as the protocol prints it: a speaker heading starts it; the next heading, an agenda heading, a
// result or a break ends it. What the chair says after an agenda heading or a result has no heading of its own.
export type VerlaufContribution = {
  order: number;
  speaker: VerlaufSpeaker;
  // The speaker chairs the session at this point: the mayor or the deputy the chair was handed to.
  isChair: boolean;
  agendaItemNumbers: string[];
  // Order of the last result before the contribution, null before the first.
  afterResult: number | null;
  // Paragraphs separated by a blank line, hyphenation removed.
  text: string;
};

export type VerlaufSpeaker = {
  // „Stadträtin“, „Oberbürgermeister“, „Herr“.
  title: string;
  // As printed, with academic titles: „Dr. Schreyer-Krieg“.
  name: string;
  // In brackets after the name: the faction of a councillor, the role of a guest („Einwohnerin“); null for the mayors.
  group: string | null;
};

export type VerlaufFile = {
  sessionId: string;
  source: string;
  fetchedAt: string;
  parserVersion: number;
  results: VerlaufResult[];
  contributions: VerlaufContribution[];
};

export const VERLAUF_PARSER_VERSION = 2;

export async function extractPdfLines(pdf: Uint8Array): Promise<string[]> {
  const loadingTask = getDocument({ data: pdf, verbosity: 0 });
  const document = await loadingTask.promise;
  const lines: string[] = [];
  for (let page = 1; page <= document.numPages; page++) {
    let line = '';
    for (const item of (await (await document.getPage(page)).getTextContent()).items) {
      if (!('str' in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line.trim());
        line = '';
      }
    }
    if (line.trim()) lines.push(line.trim());
  }
  await loadingTask.destroy();
  return lines.map(normalizeSpaces).filter((line) => line !== '');
}

// Some PDFs set a Tamil length mark (U+0BD7) where a space belongs („Herr\u0BD7Malok“).
function normalizeSpaces(line: string): string {
  return line.replaceAll('\u0BD7', ' ');
}

const PAGE_HEADER = /^V e r l a u f s p r o t o k o l l|^RATSVERSAMMLUNG (?:VOM|LEIPZIG)/;
const AGENDA_HEADING = /^(\d{1,2}(?:\.\d{1,2}){0,3}) [A-ZÄÖÜ„"(]/;
const RESULT_LINE = /^Abstimmung:\s*(\d{1,2})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})\b/;
const CONTEXT_LINES = 12;
// The first speaker after a run of headings ends it („Oberbürgermeister Jung:“, „Stadträtin Riekewald (DIE LINKE):“).
const SPEAKER =
  /^(?:Oberbürgermeister|Bürgermeister(?:in)?|Erste Bürgermeister(?:in)?|Stadträtin|Stadtrat|Beigeordnete[r]?|Herr|Frau)\b[^:]{0,80}:/;

// A line that starts with a number is an agenda heading only if the agenda has that number; text lines also start with
// numbers („99 Prozent …“).
export function parseVerlaufsprotokoll(lines: string[], agendaNumbers: Set<string>): VerlaufResult[] {
  const results: VerlaufResult[] = [];
  let agendaItemNumbers: string[] = [];
  let headingsClosed = false;
  let since: string[] = [];
  for (const line of lines) {
    if (PAGE_HEADER.test(line)) continue;
    const heading = line.match(AGENDA_HEADING);
    if (heading && agendaNumbers.has(heading[1])) {
      agendaItemNumbers = headingsClosed ? [heading[1]] : [...agendaItemNumbers, heading[1]];
      headingsClosed = false;
    } else if (SPEAKER.test(line)) {
      headingsClosed = true;
    }
    const result = line.match(RESULT_LINE);
    if (result) {
      results.push({
        order: results.length,
        agendaItemNumbers,
        J: Number(result[1]),
        N: Number(result[2]),
        E: Number(result[3]),
        line,
        context: joinLines(since.slice(-CONTEXT_LINES)),
      });
      since = [];
      continue;
    }
    since.push(line);
  }
  return results;
}

// --- Contributions ---

const NAME_PART = String.raw`(?:Dr\.|Prof\.|von|van|de|[A-ZÄÖÜ](?:[\p{L}'’-]*\p{L})?\.?)`;
// „Stadträtin Dr. Schreyer-Krieg (Bündnis 90/Die Grünen):“, „Oberbürgermeister Jung:“. Guests are printed with their
// role („Herr K. (Einwohner):“); „Herr Weickert sagt immer:“ in a speech is no heading. One typo is in the record.
const SPEAKER_HEADING = new RegExp(
  String.raw`^(Oberbürgermeister(?:in)?|Erste[rn]? Bürgermeister(?:in)?|Bürgermeister(?:in)?|Stadträtin|Stadtrat|Starträtin|Beigeordnete[r]?|Ortsvorsteher(?:in)?|Herr|Frau) ((?:${NAME_PART} ){0,3}?${NAME_PART})(?: \(([^()]{1,80})\))?: ?(.*)$`,
  'u',
);
const GUEST_TITLES = new Set(['Herr', 'Frau']);
const CHAIR_TITLES = /^(?:Oberbürgermeister|Erste[rn]? Bürgermeister|Bürgermeister)/;
const SUBMITTER = /^Eingereicht von:/;
// Notes of the record that interrupt the speaker; other brackets at a line start belong to the text.
const PROCEEDINGS_NOTE = /^\((?:Sitzungsunterbrechung|Übergabe|Gratulation|Unterbrechung|folgt|Fortsetzung)/;
const HANDOVER = /^\(Übergabe der Sitzungsleitung an (?:Herrn |Frau )?(.*)\)$/;
// The signatures close the record („Oberbürgermeister: ______“).
const SIGNATURE = /_{5,}/;
const PAPER_REFERENCE_END = /\((?:VIII|VII)-[^()]*\)$/;
// Lines of a column are about 50 characters; a shorter one ending a sentence ends a paragraph.
const PARAGRAPH_END_LENGTH = 40;
const SUBMITTER_CONTINUATION_LENGTH = 30;

type Turn = { speaker: VerlaufSpeaker; isChair: boolean; agendaItemNumbers: string[]; afterResult: number | null };

// A speaker heading may wrap in its brackets („(Bündnis 90/Die Grü-“ / „nen): …“), a heading over several lines, a
// note in brackets too. They are joined before they are read.
export function parseContributions(lines: string[], agendaNumbers: Set<string>): VerlaufContribution[] {
  const contributions: VerlaufContribution[] = [];
  let chairName = 'Jung';
  let pendingChair: string | null = null;
  let agendaItemNumbers: string[] = [];
  let headingsClosed = true;
  let resultsSeen = 0;
  let turn: Turn | null = null;
  let text: string[] = [];

  const close = () => {
    if (turn && text.length > 0) {
      const joined = joinParagraphs(text);
      if (joined) contributions.push({ order: contributions.length, ...turn, text: joined });
    }
    text = [];
  };
  const chairTurn = (): Turn => ({
    speaker: { title: chairTitleOf(chairName, contributions, turn), name: chairName, group: null },
    isChair: true,
    agendaItemNumbers,
    afterResult: resultsSeen > 0 ? resultsSeen - 1 : null,
  });

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (PAGE_HEADER.test(line)) continue;
    if (SIGNATURE.test(line)) break;

    const heading = line.match(AGENDA_HEADING);
    if (heading && agendaNumbers.has(heading[1])) {
      close();
      agendaItemNumbers = headingsClosed ? [heading[1]] : [...agendaItemNumbers, heading[1]];
      headingsClosed = false;
      index = endOfHeading(lines, index);
      turn = null;
      continue;
    }
    if (SUBMITTER.test(line)) {
      index = endOfSubmitter(lines, index);
      continue;
    }
    if (PROCEEDINGS_NOTE.test(line)) {
      const { note, end } = joinNote(lines, index);
      index = end;
      const handover = note.match(HANDOVER);
      if (handover) pendingChair = familyNameOf(handover[1]);
      close();
      turn = null;
      continue;
    }

    const speakerLine = joinSpeakerHeading(lines, index);
    const speaker = speakerLine?.line.match(SPEAKER_HEADING);
    if (speakerLine && speaker && isSpeakerHeading(speaker)) {
      close();
      index = speakerLine.end;
      headingsClosed = true;
      const [, title, name, group] = speaker;
      const normalizedTitle = title === 'Starträtin' ? 'Stadträtin' : title;
      if (pendingChair && CHAIR_TITLES.test(normalizedTitle) && familyNameOf(name) === pendingChair) {
        chairName = pendingChair;
        pendingChair = null;
      }
      turn = {
        speaker: { title: normalizedTitle, name, group: group ?? null },
        isChair: CHAIR_TITLES.test(normalizedTitle) && familyNameOf(name) === chairName,
        agendaItemNumbers,
        afterResult: resultsSeen > 0 ? resultsSeen - 1 : null,
      };
      if (speaker[4]) text.push(speaker[4]);
      continue;
    }

    if (RESULT_LINE.test(line) || /^Abstimmung:/.test(line)) {
      turn ??= chairTurn();
      text.push(line);
      while (text.at(-1)?.endsWith('-') && index + 1 < lines.length && !PAGE_HEADER.test(lines[index + 1])) {
        text.push(lines[++index]);
      }
      close();
      if (RESULT_LINE.test(line)) resultsSeen++;
      turn = null;
      continue;
    }

    turn ??= chairTurn();
    text.push(line);
  }
  close();
  return contributions;
}

function isSpeakerHeading(match: RegExpMatchArray): boolean {
  const [, title, , group] = match;
  return !GUEST_TITLES.has(title) || group !== undefined;
}

// The chair's title is the one its last heading had („Bürgermeister Bonew“ after a handover).
function chairTitleOf(chairName: string, contributions: VerlaufContribution[], current: Turn | null): string {
  if (current?.isChair) return current.speaker.title;
  const last = contributions.findLast(
    (contribution) => contribution.isChair && contribution.speaker.name === chairName,
  );
  return last?.speaker.title ?? 'Oberbürgermeister';
}

function familyNameOf(name: string): string {
  return name.split(' ').at(-1) ?? name;
}

function joinSpeakerHeading(lines: string[], index: number): { line: string; end: number } | null {
  const line = lines[index];
  if (!/^[A-ZÄÖÜ]/.test(line)) return null;
  const opened = line.lastIndexOf('(');
  if (opened < 0 || line.indexOf(')', opened) >= 0 || index + 1 >= lines.length) return { line, end: index };
  const next = lines[index + 1];
  if (!/^[^()]{0,40}\):/.test(next)) return { line, end: index };
  return { line: joinLines([line, next]), end: index + 1 };
}

// A heading runs on while its brackets are open or its line ends with a hyphen, and the heading of a paper up to its
// reference („9.1 Wahl … für“ / „Richter/-innen … (VIII-DS-02100)“). The sub-items („13.20.1 dazu …“) are headings of
// their own.
const HEADING_LOOKAHEAD_LINES = 3;

function endOfHeading(lines: string[], index: number): number {
  const reference = endOfPaperReference(lines, index);
  if (reference !== null) return reference;
  let joined = lines[index];
  let end = index;
  while (end + 1 < lines.length && (opensBracket(joined) || joined.endsWith('-'))) {
    const next = lines[end + 1];
    if (SUBMITTER.test(next) || SPEAKER_HEADING.test(next) || RESULT_LINE.test(next)) break;
    end++;
    joined += next;
  }
  return end;
}

function endOfPaperReference(lines: string[], index: number): number | null {
  let joined = '';
  for (let end = index; end < lines.length && end <= index + HEADING_LOOKAHEAD_LINES; end++) {
    const line = lines[end];
    if (end > index && (SUBMITTER.test(line) || SPEAKER_HEADING.test(line) || RESULT_LINE.test(line))) return null;
    if (end > index && AGENDA_HEADING.test(line)) return null;
    joined += line;
    if (PAPER_REFERENCE_END.test(joined)) return end;
  }
  return null;
}

// „Eingereicht von: Fraktion Bündnis 90/Die“ / „Grünen“: the submitter's name runs on in short lines without a full
// stop.
function endOfSubmitter(lines: string[], index: number): number {
  let end = index;
  while (end + 1 < lines.length) {
    const next = lines[end + 1];
    const continues =
      lines[end].endsWith('-') ||
      (next.length < SUBMITTER_CONTINUATION_LENGTH && !/[.!?:]$/.test(next) && !SPEAKER_HEADING.test(next));
    if (!continues || AGENDA_HEADING.test(next) || SUBMITTER.test(next) || RESULT_LINE.test(next)) break;
    end++;
  }
  return end;
}

function joinNote(lines: string[], index: number): { note: string; end: number } {
  let end = index;
  let joined = lines[index];
  while (opensBracket(joined) && end + 1 < lines.length && end - index < 3) {
    end++;
    joined = joinLines([joined, lines[end]]);
  }
  return { note: joined, end };
}

function opensBracket(text: string): boolean {
  return (text.match(/\(/g)?.length ?? 0) > (text.match(/\)/g)?.length ?? 0);
}

function joinParagraphs(lines: string[]): string {
  const paragraphs: string[][] = [[]];
  for (const line of lines) {
    paragraphs.at(-1)?.push(line);
    if (line.length < PARAGRAPH_END_LENGTH && /[.!?:“"]$/.test(line)) paragraphs.push([]);
  }
  return paragraphs
    .map(joinLines)
    .filter((paragraph) => paragraph !== '')
    .join('\n\n');
}

function joinLines(lines: string[]): string {
  return lines
    .join('\n')
    .replaceAll(/-\n(?=[a-zäöüß])/g, '')
    .replaceAll('\n', ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}
