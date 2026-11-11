export type VoteCounts = { J: number; N: number; E: number };

export type SubtitleCue = { startSeconds: number; endSeconds: number; text: string };

export type AnnouncedResult = {
  J: number;
  N: number;
  // null when the chair named only Ja and Nein („22 zu 31 abgelehnt“).
  E: number | null;
  atSeconds: number;
  quote: string;
  mentionsCorrection: boolean;
};

export function parseVtt(vtt: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const block of vtt.replaceAll('\r', '').split(/\n\n+/)) {
    const lines = block.split('\n');
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0) continue;
    const [start, end] = lines[timingIndex].split('-->').map((part) => parseTimestamp(part.trim().split(' ')[0]));
    const text = lines
      .slice(timingIndex + 1)
      .join(' ')
      .trim();
    if (text) cues.push({ startSeconds: start, endSeconds: end, text });
  }
  return cues;
}

// The chair announces results as "21 zu 36 zu 0", sometimes as "23 dafür, 28 dagegen bei zwei Enthaltungen". The AI
// subtitles split announcements across cues and render some as "13.33.13" or "44.0", so the window's cues are joined
// and separators are matched loosely. A "zu" match counts only next to a result word; the "dafür … dagegen" form is a
// result by itself. Either needs a plausible number of votes.
const RESULT_WORDS = /Ergebnis|angenommen|abgelehnt|beschlossen|zugestimmt|bestätigt|Mehrheit/i;
// Point, comma and colon separate counts only without spaces („13.33.13“); with a space they end a sentence or an item
// number („Beschlusspunkt 1. 18 zu 44 zu 2“). A comma before „zu“ is a pause in the subtitles („6 zu 42, zu 18“).
const NUMBER_WORDS: Record<string, number> = {
  keine: 0,
  einer: 1,
  eine: 1,
  einen: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
};
const NUMBER_TOKEN = `(\\d{1,2}|${Object.keys(NUMBER_WORDS).join('|')})`;
// A count is digits or a number word; a word must stand alone („eine“, not the end of „seine“).
const ZU_COUNT = `(\\d{1,2}|(?<![A-Za-zÄÖÜäöüß])(?:${Object.keys(NUMBER_WORDS).join('|')})(?![A-Za-zÄÖÜäöüß]))`;
const ZU_PATTERN = new RegExp(
  `(?<![\\d.,:])${ZU_COUNT}(,?\\s*zu\\s*|[:.,])${ZU_COUNT}(?:(,?\\s*zu\\s*|[:.,])${ZU_COUNT})?(?![\\d]|[.,:]\\d)`,
  'gi',
);
const DAFUER_PATTERN = new RegExp(
  `${NUMBER_TOKEN} dafür,? ${NUMBER_TOKEN} (?:dagegen|Nein|Gegenstimmen?)(?:,? (?:bei |und )?${NUMBER_TOKEN} Enthaltung(?:en)?)?`,
  'gi',
);
const CORRECTION_WORDS =
  /(?:hinzu|dazu|zu)gez[äa]hlt|nachgetragen|korrigier|mit (?:Ja|Nein) gestimmt|Enthaltung gez[äa]hlt|(?:ein|eine|einmal) (?:noch )?(?:Ja|Nein|Enthaltung|rot|grün|gelb) (?:noch )?dazu|nicht elektronisch abstimmen|(?:Ja|Jahr|Nein)-?stimme mehr/i;
const MINIMUM_PLAUSIBLE_VOTES = 30;
// 70 councillors and the mayor.
const MAXIMUM_PLAUSIBLE_VOTES = 71;
const CONTEXT_CHARACTERS = 90;

type Candidate = { J: number; N: number; E: number | null; offset: number; needsResultWord: boolean };

export function findAnnouncedResult(
  cues: SubtitleCue[],
  fromSeconds: number,
  toSeconds: number,
): AnnouncedResult | null {
  return findAnnouncedResults(cues, fromSeconds, toSeconds)[0] ?? null;
}

export function findAnnouncedResults(cues: SubtitleCue[], fromSeconds: number, toSeconds: number): AnnouncedResult[] {
  const windowCues = cues.filter((cue) => cue.endSeconds >= fromSeconds && cue.startSeconds <= toSeconds);
  const offsets: number[] = [];
  let text = '';
  for (const cue of windowCues) {
    offsets.push(text.length);
    text += `${cue.text} `;
  }
  return [...findZuCandidates(text), ...findDafuerCandidates(text)]
    .sort((a, b) => a.offset - b.offset)
    .filter(
      (found) => isPlausible(found) && (!found.needsResultWord || RESULT_WORDS.test(contextAround(text, found.offset))),
    )
    .filter((found, position, all) => !isRetracted(text, found, all[position + 1]))
    .map((candidate) => {
      const cueIndex = offsets.findLastIndex((offset) => offset <= candidate.offset);
      return {
        J: candidate.J,
        N: candidate.N,
        E: candidate.E,
        atSeconds: windowCues[cueIndex].startSeconds,
        quote: windowCues
          .slice(cueIndex, cueIndex + 2)
          .map((cue) => cue.text)
          .join(' '),
        mentionsCorrection: CORRECTION_WORDS.test(contextAround(text, candidate.offset)),
      };
    });
}

// The stream shows the board up to about 20 seconds after the chair has read out the result, so an announcement can
// fall before its board and inside the window of the neighbouring vote. An announcement that equals a neighbour's board
// belongs to that neighbour; one that equals this vote's board is taken first.
export function assignAnnouncement(
  candidates: AnnouncedResult[],
  tally: VoteCounts,
  neighbourTallies: VoteCounts[],
): AnnouncedResult | null {
  const equals = (announcement: AnnouncedResult, counts: VoteCounts) =>
    announcement.J === counts.J && announcement.N === counts.N && (announcement.E ?? counts.E) === counts.E;
  return (
    candidates.find((candidate) => equals(candidate, tally)) ??
    candidates.find((candidate) => !neighbourTallies.some((neighbour) => equals(candidate, neighbour))) ??
    null
  );
}

// The chair sometimes corrects a figure right away: „11 zu 49 zu 3, damit abgelehnt, 12, Entschuldigung, 12 zu 49 zu 3“.
// The first result then does not count.
const SELF_CORRECTION = /Entschuldigung|Verzeihung|Korrektur|Moment|nein,|falsch/i;
const SELF_CORRECTION_DISTANCE = 80;

function isRetracted(text: string, candidate: Candidate, next: Candidate | undefined): boolean {
  if (!next || next.offset - candidate.offset > SELF_CORRECTION_DISTANCE) return false;
  return SELF_CORRECTION.test(text.slice(candidate.offset, next.offset));
}

// German says the units first („einunddreißig“), and the AI subtitles sometimes write such a count as two numbers:
// „30 zu 1 und 30 zu 0“ for 30 zu 31 zu 0, „40 zu 1, 20 zu 1“ for 40 zu 21 zu 1. Between two „zu“ they are joined
// again; the text keeps its length, so offsets into it still point at the right subtitle cue.
const SPLIT_COMPOUND = /(zu\s*)([1-9])(\s*und\s*|,\s*)([2-9])0?(?=\s*zu)/gi;

export function joinSplitCompounds(text: string): string {
  return text.replaceAll(SPLIT_COMPOUND, (whole, before: string, units: string, _joint: string, tens: string) => {
    const joined = `${before}${Number(tens) * 10 + Number(units)}`;
    return joined.padEnd(whole.length, ' ');
  });
}

function findZuCandidates(rawText: string): Candidate[] {
  const text = joinSplitCompounds(rawText);
  return [...text.matchAll(ZU_PATTERN)].flatMap((match) => {
    const [, yes, firstSeparator, no, secondSeparator, abstentions] = match;
    const usesZu = /zu/.test(firstSeparator) || /zu/.test(secondSeparator ?? '');
    if (!usesZu && abstentions === undefined) return [];
    if (abstentions === undefined) {
      return [{ ...ranTogether(toNumber(yes), no), offset: match.index, needsResultWord: true }];
    }
    return [
      { J: toNumber(yes), N: toNumber(no), E: toNumber(abstentions), offset: match.index, needsResultWord: true },
    ];
  });
}

// The subtitles sometimes run the last two counts together („48 zu 92“ for 48 zu 9 zu 2). More votes than the council
// has seats give that away; the two digits are then read as Nein and Enthaltung.
function ranTogether(yes: number, no: string): Pick<Candidate, 'J' | 'N' | 'E'> {
  if (/^\d{2}$/.test(no) && yes + Number(no) > MAXIMUM_PLAUSIBLE_VOTES) {
    return { J: yes, N: Number(no[0]), E: Number(no[1]) };
  }
  return { J: yes, N: toNumber(no), E: null };
}

function findDafuerCandidates(text: string): Candidate[] {
  return [...text.matchAll(DAFUER_PATTERN)].map((match) => ({
    J: toNumber(match[1]),
    N: toNumber(match[2]),
    E: match[3] === undefined ? null : toNumber(match[3]),
    offset: match.index,
    needsResultWord: false,
  }));
}

function toNumber(token: string): number {
  return /^\d+$/.test(token) ? Number(token) : NUMBER_WORDS[token.toLowerCase()];
}

function isPlausible(candidate: Candidate): boolean {
  const total = candidate.J + candidate.N + (candidate.E ?? 0);
  return total >= MINIMUM_PLAUSIBLE_VOTES && total <= MAXIMUM_PLAUSIBLE_VOTES;
}

function contextAround(text: string, offset: number): string {
  return text.slice(Math.max(0, offset - CONTEXT_CHARACTERS), offset + CONTEXT_CHARACTERS);
}

function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}
