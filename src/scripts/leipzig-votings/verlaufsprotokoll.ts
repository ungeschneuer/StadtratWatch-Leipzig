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

export type VerlaufFile = {
  sessionId: string;
  source: string;
  fetchedAt: string;
  parserVersion: number;
  results: VerlaufResult[];
};

export const VERLAUF_PARSER_VERSION = 1;

export async function extractPdfLines(pdf: Uint8Array): Promise<string[]> {
  const document = await getDocument({ data: pdf, verbosity: 0, isEvalSupported: false }).promise;
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
  await document.destroy();
  return lines.filter((line) => line !== '');
}

const PAGE_HEADER = /^V e r l a u f s p r o t o k o l l|^RATSVERSAMMLUNG VOM/;
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

function joinLines(lines: string[]): string {
  return lines
    .join('\n')
    .replaceAll(/-\n(?=[a-zäöüß])/g, '')
    .replaceAll('\n', ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}
