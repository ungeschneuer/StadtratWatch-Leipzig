import {
  factionOn,
  type LeipzigMembersFile,
  type LeipzigPerson,
  MAYOR_FACTION_ID,
} from '@srw-astro/models/leipzig-members';
import { partyIdOn } from '@srw-astro/models/person-affiliation';
import type { SessionSpeech } from '@srw-astro/models/session-speech';

import type { SubtitleCue } from '../leipzig-votings/subtitle-announcements.ts';
import type { VerlaufContribution } from '../leipzig-votings/verlaufsprotokoll.ts';
import { factionKey } from './session-scan.ts';

// The Verlaufsprotokoll gives speaker and text of every contribution, the subtitles give the times. Word sequences that
// occur once in the protocol and once in the subtitles tie the two together; of these, the longest run in the same
// order is kept, so a phrase repeated elsewhere cannot pull a contribution out of place.

export type SpeechAlignmentStats = {
  contributions: number;
  // Contributions with at least one tie inside; the others are placed between their neighbours.
  tied: number;
  ties: number;
  secondsPerWord: number;
};

export type SessionSpeechesResult = {
  speeches: SessionSpeech[];
  stats: SpeechAlignmentStats;
  // Speakers the protocol calls councillors who are none in members.json; they keep the protocol's name.
  warnings: string[];
};

const TIE_WORDS = 5;
// Speakers are quoted by role, not by name, when they are residents; they are private persons and not shown.
const RESIDENT_GROUPS = /^Einwohner(?:in)?$/;
const COUNCILLOR_TITLES = new Set(['Stadtrat', 'Stadträtin']);
const MAYOR_TITLES = /^Oberbürgermeister/;
const FALLBACK_SECONDS_PER_WORD = 0.45;
// Speakers slow down and pause; a gap counts as holding extra time only beyond this factor of the usual pace.
const SLACK = 2;

type TimedWord = { word: string; seconds: number };
type Tie = { protocolIndex: number; seconds: number };

export function toSessionSpeeches(
  sessionDate: string,
  contributions: VerlaufContribution[],
  cues: SubtitleCue[],
  members: LeipzigMembersFile,
): SessionSpeechesResult {
  const warnings: string[] = [];
  const protocolWords: string[] = [];
  const firstWordOf: number[] = [];
  for (const contribution of contributions) {
    firstWordOf.push(protocolWords.length);
    protocolWords.push(...wordsOf(contribution.text));
  }
  firstWordOf.push(protocolWords.length);

  const ties = tiesBetween(protocolWords, timedWordsOf(cues));
  const secondsPerWord = speakingRate(ties);
  const clock = new ProtocolClock(ties, secondsPerWord);

  const speeches: SessionSpeech[] = [];
  let tied = 0;
  contributions.forEach((contribution, index) => {
    const first = firstWordOf[index];
    const last = firstWordOf[index + 1] - 1;
    if (last < first) return;
    if (clock.hasTieBetween(first, last)) tied++;
    const speaker = speakerOf(contribution, members, sessionDate);
    if (speaker.warning) warnings.push(`${sessionDate}: contribution ${contribution.order}: ${speaker.warning}`);
    if (speaker.hidden) return;
    const start = Math.round(clock.startOf(first));
    const end = Math.round(clock.endOf(last));
    speeches.push({
      speaker: speaker.name,
      start,
      duration: Math.max(1, end - start),
      ...(contribution.isChair ? { isChairPerson: true } : {}),
      ...(speaker.onBehalfOf ? { onBehalfOf: speaker.onBehalfOf } : {}),
      transcription: contribution.text,
    });
  });

  return {
    speeches,
    stats: { contributions: contributions.length, tied, ties: ties.length, secondsPerWord },
    warnings,
  };
}

// --- Speakers ---

type Speaker = { name: string; onBehalfOf: string | null; hidden: boolean; warning?: string };

// Councillors and the mayor are named as members.json names them, which is how the site finds them; the deputy mayors,
// heads of offices and local councillors are no members of the council and keep the name the protocol gives them.
export function speakerOf(contribution: VerlaufContribution, members: LeipzigMembersFile, date: string): Speaker {
  const { title, name, group } = contribution.speaker;
  const asPrinted = { name: `${title} ${name}`, onBehalfOf: group, hidden: false };
  if (group !== null && RESIDENT_GROUPS.test(group)) return { ...asPrinted, hidden: true };
  if (MAYOR_TITLES.test(title)) {
    const mayor = members.persons.find(
      (person) => isSitting(person, date) && factionOn(person, date) === MAYOR_FACTION_ID,
    );
    if (mayor) return { name: mayor.name, onBehalfOf: null, hidden: false };
    return { ...asPrinted, warning: `no mayor in members.json on ${date}` };
  }
  if (!COUNCILLOR_TITLES.has(title)) return asPrinted;

  const familyName = name.replaceAll(/\b(?:Dr|Prof)\.\s*/g, '').trim();
  const candidates = members.persons.filter(
    (person) => isSitting(person, date) && isFamilyName(person.familyName, familyName),
  );
  const inGroup = candidates.filter((person) => group !== null && belongsTo(person, group, members, date));
  const found = inGroup.length === 1 ? inGroup[0] : candidates.length === 1 ? candidates[0] : null;
  if (found) return { name: found.name, onBehalfOf: null, hidden: false };
  const reason = candidates.length === 0 ? 'no councillor of this name' : 'several councillors of this name';
  return { ...asPrinted, warning: `${title} ${name} (${group ?? 'no faction'}): ${reason} on ${date}` };
}

function isSitting(person: LeipzigPerson, date: string): boolean {
  return (person.start === null || person.start <= date) && (person.end === null || person.end >= date);
}

// The protocol shortens some double names („Dr. Schreyer“ for Schreyer-Krieg).
function isFamilyName(familyName: string, printed: string): boolean {
  return [familyName, ...familyName.split('-')].some(
    (candidate) => candidate.localeCompare(printed, 'de', { sensitivity: 'base' }) === 0,
  );
}

// The protocol names the faction, for members of a joint faction sometimes their party („Stadtrat … (FDP)“).
function belongsTo(person: LeipzigPerson, group: string, members: LeipzigMembersFile, date: string): boolean {
  const key = factionKey(group);
  const faction = members.factions.find((candidate) => candidate.id === factionOn(person, date));
  const party = members.parties.find((candidate) => candidate.id === partyIdOn(person, date));
  return [faction?.name, faction?.oparlName, party?.name, party?.id].some(
    (name) => name !== undefined && name !== null && factionKey(name) === key,
  );
}

// --- Ties between protocol and subtitles ---

export function wordsOf(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replaceAll('ß', 'ss')
      .match(/[\p{L}\d]+/gu) ?? []
  );
}

export function timedWordsOf(cues: SubtitleCue[]): TimedWord[] {
  return cues.flatMap((cue) => {
    const words = wordsOf(cue.text);
    const step = (cue.endSeconds - cue.startSeconds) / Math.max(1, words.length);
    return words.map((word, index) => ({ word, seconds: cue.startSeconds + index * step }));
  });
}

export function tiesBetween(protocolWords: string[], spoken: TimedWord[]): Tie[] {
  const protocolPositions = uniquePositions(protocolWords);
  const spokenPositions = uniquePositions(spoken.map(({ word }) => word));
  const candidates: { protocolIndex: number; spokenIndex: number }[] = [];
  for (const [key, protocolIndex] of protocolPositions) {
    const spokenIndex = spokenPositions.get(key);
    if (spokenIndex !== undefined) candidates.push({ protocolIndex, spokenIndex });
  }
  candidates.sort((a, b) => a.protocolIndex - b.protocolIndex);
  return longestIncreasingRun(candidates).map(({ protocolIndex, spokenIndex }) => ({
    protocolIndex,
    seconds: spoken[spokenIndex].seconds,
  }));
}

// Position of each word sequence that occurs exactly once.
function uniquePositions(words: string[]): Map<string, number> {
  const positions = new Map<string, number>();
  const repeated = new Set<string>();
  for (let index = 0; index + TIE_WORDS <= words.length; index++) {
    const key = words.slice(index, index + TIE_WORDS).join(' ');
    if (positions.has(key)) repeated.add(key);
    else positions.set(key, index);
  }
  for (const key of repeated) positions.delete(key);
  return positions;
}

// Patience sorting over the subtitle positions, in protocol order.
function longestIncreasingRun<T extends { spokenIndex: number }>(items: T[]): T[] {
  const tails: number[] = [];
  const previous: number[] = new Array(items.length).fill(-1);
  items.forEach((item, index) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (items[tails[middle]].spokenIndex < item.spokenIndex) low = middle + 1;
      else high = middle;
    }
    if (low > 0) previous[index] = tails[low - 1];
    tails[low] = index;
  });
  const run: T[] = [];
  for (let index = tails.at(-1) ?? -1; index >= 0; index = previous[index]) run.push(items[index]);
  return run.reverse();
}

function speakingRate(ties: Tie[]): number {
  const rates: number[] = [];
  for (let index = 1; index < ties.length; index++) {
    const words = ties[index].protocolIndex - ties[index - 1].protocolIndex;
    const seconds = ties[index].seconds - ties[index - 1].seconds;
    if (words > 0 && words <= 50 && seconds > 0) rates.push(seconds / words);
  }
  if (rates.length === 0) return FALLBACK_SECONDS_PER_WORD;
  rates.sort((a, b) => a - b);
  return rates[Math.floor(rates.length / 2)];
}

// The time of a protocol word between two ties. Where the gap holds much more time than its words take to say (a break,
// a vote, a passage the protocol leaves out), a contribution starts right before its first tied words and ends right
// after its last.
class ProtocolClock {
  constructor(
    private readonly ties: Tie[],
    private readonly secondsPerWord: number,
  ) {}

  hasTieBetween(first: number, last: number): boolean {
    const index = this.firstTieFrom(first);
    return index < this.ties.length && this.ties[index].protocolIndex <= last;
  }

  startOf(wordIndex: number): number {
    const { before, after } = this.around(wordIndex);
    if (!after) return before ? before.seconds + (wordIndex - before.protocolIndex) * this.secondsPerWord : 0;
    const fromAfter = after.seconds - (after.protocolIndex - wordIndex) * this.secondsPerWord;
    if (!before) return Math.max(0, fromAfter);
    return this.between(before, after, wordIndex) ?? Math.max(before.seconds, fromAfter);
  }

  endOf(wordIndex: number): number {
    const end = wordIndex + 1;
    const { before, after } = this.around(end);
    if (!before) return after ? Math.max(0, after.seconds - (after.protocolIndex - end) * this.secondsPerWord) : 0;
    const fromBefore = before.seconds + (end - before.protocolIndex) * this.secondsPerWord;
    if (!after) return fromBefore;
    return this.between(before, after, end) ?? Math.min(after.seconds, fromBefore);
  }

  // Linear between the ties, unless the gap is longer than its words take; then the gap's extra time is left out.
  private between(before: Tie, after: Tie, wordIndex: number): number | null {
    const words = after.protocolIndex - before.protocolIndex;
    const seconds = after.seconds - before.seconds;
    if (seconds > words * this.secondsPerWord * SLACK) return null;
    return before.seconds + (seconds * (wordIndex - before.protocolIndex)) / words;
  }

  private around(wordIndex: number): { before: Tie | null; after: Tie | null } {
    const index = this.firstTieFrom(wordIndex);
    return {
      before: index > 0 ? this.ties[index - 1] : null,
      after: index < this.ties.length ? this.ties[index] : null,
    };
  }

  private firstTieFrom(wordIndex: number): number {
    let low = 0;
    let high = this.ties.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (this.ties[middle].protocolIndex < wordIndex) low = middle + 1;
      else high = middle;
    }
    return low;
  }
}
