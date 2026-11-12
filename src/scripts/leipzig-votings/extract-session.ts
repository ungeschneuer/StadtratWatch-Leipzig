import type { ReviewEntry } from '@srw-astro/models/leipzig-review';
import type { VoteCode } from '@srw-astro/models/session';

import { parseAgendaHeading } from './agenda-heading.ts';
import {
  type BoardCell,
  type BoardLayout,
  BoardLayoutError,
  findResultBars,
  nameCellArea,
  nameColumnArea,
  readBoard,
  type SeatState,
} from './board-reader.ts';
import { readBoardText, rereadNameCell, type TextWorkers } from './board-text.ts';
import { withDeadline } from './deadline.ts';
import type { VideoReader } from './ffmpeg.ts';
import type { OfficialResult } from './official-result.ts';
import { type AgendaItem, type FetchJson, fetchPaperReference } from './oparl-council.ts';
import { decodePngFrame, isDark, pixelAt, type RgbFrame } from './rgb-frame.ts';
import { matchBoardName, type RosterPerson } from './roster.ts';
import {
  type AnnouncedResult,
  assignAnnouncement,
  findAnnouncedResults,
  type SubtitleCue,
} from './subtitle-announcements.ts';
import type { VoteEvent } from './vote-events.ts';
import { type CheckResult, checkVoting, samePaper, type Tally, type VotingStatus } from './voting-checks.ts';

export type SeatVote = {
  column: number;
  row: number;
  boardName: string;
  personId: string | null;
  vote: VoteCode;
  attendance: 'present' | 'absent';
  boardVote?: VoteCode;
  boardAttendance?: 'present' | 'absent';
};

export type ExtractedVoting = {
  index: number;
  videoSeconds: { start: number; end: number; frames: number[] };
  heading: { raw: string; agendaItemNumber: string | null; paperReference: string | null; title: string };
  // isParentAgendaItem: OParl does not list the board's sub-item (amendments such as 18.16.1), so this is its parent.
  oparl: {
    agendaItemId: string;
    number: string | null;
    isParentAgendaItem: boolean;
    // The board's TOP number names an item with another paper; this item, a sibling, has the board's paper.
    matchedByPaper?: boolean;
    name: string;
    result: string | null;
    paperReference: string | null;
  } | null;
  board: {
    presentMembers: number | null;
    castVotes: number | null;
    resultBars: { J: number | null; N: number | null; E: number | null };
  };
  tally: Tally;
  announced: AnnouncedResult | null;
  votes: SeatVote[];
  checks: CheckResult[];
  checkStatus: VotingStatus;
  // reviewed: a human corrected or approved it; discarded: a human found it is no valid vote.
  status: VotingStatus | 'reviewed';
  review?: ReviewEntry[];
  // The official result from minutes, ALLRIS and Verlaufsprotokoll, once published.
  official?: OfficialResult;
  // A procedural motion (postponement, end of debate, order of the agenda); not reviewed.
  procedural?: boolean;
  boardAgendaItemNumber?: string | null;
};

export type SessionInputs = {
  sessionId: string;
  hdVideoUrl: string;
  events: VoteEvent[];
  roster: RosterPerson[];
  agenda: AgendaItem[];
  cues: SubtitleCue[] | null;
};

export type ExtractionTools = {
  video: VideoReader;
  workers: TextWorkers;
  fetchJson: FetchJson;
  log: { info(message: string): void; warn(message: string): void };
  // Receives the exact frame each vote was read from; seeking the stream again can land on a different picture.
  onBoardRead?(votingIndex: number, png: Uint8Array): void;
  voteDeadlineMilliseconds?: number;
  // Aborted when the whole session took too long; the extraction then stops before the next vote, writing nothing.
  signal?: AbortSignal;
};

type NameMapping = {
  mask: boolean[];
  names: Map<string, { boardName: string; person: RosterPerson | null; reason?: string }>;
};

export type ReadVoting = Omit<
  ExtractedVoting,
  'checks' | 'checkStatus' | 'status' | 'review' | 'boardAgendaItemNumber' | 'official' | 'procedural'
> & {
  readingsAgree: boolean;
  seatCount: number;
  unmatchedSeats: string[];
  seatStates: string;
  distinctFromPrevious: boolean | null;
  repeatCall: { seconds: number; quote: string } | null;
  announcementCandidates: AnnouncedResult[];
  expectedSeatCount: number;
};

// Reading a vote takes well under a minute; one that takes this long hangs and is left to the review.
const VOTE_DEADLINE_MILLISECONDS = 8 * 60 * 1000;

// The stream can show the board up to about 20 seconds after the chair read out the result.
const ANNOUNCEMENT_LEAD_SECONDS = 30;

export async function extractSessionVotings(inputs: SessionInputs, tools: ExtractionTools): Promise<ExtractedVoting[]> {
  const readVotings: ReadVoting[] = [];
  const paperReferences = new Map<string, Promise<string | null>>();
  let nameMapping: NameMapping | undefined;

  const unreadable: ExtractedVoting[] = [];

  for (const [index, event] of inputs.events.entries()) {
    if (tools.signal?.aborted) {
      throw new Error(`${inputs.sessionId}: stopped before vote #${index}, the session took too long`);
    }
    let frameSeconds = pickFrameSeconds(event);
    try {
      const voting = await withDeadline(
        (async (): Promise<ReadVoting> => {
          const [firstGrab, secondGrab] = await Promise.all(
            frameSeconds.map((seconds) => grabBoard(tools.video, inputs.hdVideoUrl, seconds)),
          );
          const settled = await settleReading(tools.video, inputs.hdVideoUrl, firstGrab, secondGrab);
          const agreement = isUsableResult(settled.grab)
            ? settled
            : await searchResultFrames(tools.video, inputs.hdVideoUrl, event);
          frameSeconds = agreement.frameSeconds;
          const { png: first, frame: firstFrame, reading: firstReading } = agreement.grab;
          tools.onBoardRead?.(index, first);
          const resultBars = findResultBars(firstFrame, firstReading.layout);
          const text = await readBoardText(tools.workers, first, firstReading.layout, resultBars, firstFrame);

          const mask = nameMask(firstFrame, firstReading.layout);
          if (!nameMapping || !masksMatch(nameMapping.mask, mask)) {
            const names = mapNames(text.namesByCell, firstReading.cells, inputs.roster);
            await rereadUnmatchedNames(names, firstReading.cells, inputs.roster, (cell) =>
              rereadNameCell(tools.workers.text, firstFrame, nameCellArea(firstReading.layout, cell.column, cell.row)),
            );
            nameMapping = { mask, names };
            tools.log.info(`${inputs.sessionId}: read seat names at ${formatSeconds(frameSeconds[0])}`);
          }

          const heading = parseAgendaHeading(text.heading);
          const { agendaItem, isParent } = findAgendaItem(inputs.agenda, heading.agendaItemNumber);
          if (agendaItem?.consultationUrl && !paperReferences.has(agendaItem.agendaItemId)) {
            paperReferences.set(
              agendaItem.agendaItemId,
              fetchPaperReference(tools.fetchJson, agendaItem.consultationUrl).catch(() => null),
            );
          }

          const previousEvent = inputs.events[index - 1];
          const nextEvent = inputs.events[index + 1];
          const repeatedAt = inputs.cues ? findRepeatCall(inputs.cues, event, nextEvent) : null;
          const announcementCandidates = inputs.cues
            ? announcementsAround(inputs.cues, event, previousEvent, nextEvent).filter(
                (candidate) => !repeatedAt || candidate.atSeconds < repeatedAt.seconds,
              )
            : [];

          const votes = toSeatVotes(firstReading.cells, nameMapping);
          return {
            index,
            videoSeconds: { start: event.startSeconds, end: event.endSeconds, frames: frameSeconds },
            heading: { raw: text.heading, ...heading },
            oparl: agendaItem
              ? {
                  agendaItemId: agendaItem.agendaItemId,
                  number: agendaItem.number,
                  isParentAgendaItem: isParent,
                  name: agendaItem.name,
                  result: agendaItem.result,
                  paperReference: (await paperReferences.get(agendaItem.agendaItemId)) ?? null,
                }
              : null,
            board: { presentMembers: text.presentMembers, castVotes: text.castVotes, resultBars: text.resultBars },
            tally: tallySeats(firstReading.cells),
            announced: null,
            announcementCandidates,
            votes,
            readingsAgree: agreement.agrees,
            seatStates: seatStates(firstReading.cells),
            distinctFromPrevious: null,
            repeatCall: repeatedAt,
            seatCount: votes.length,
            expectedSeatCount: expectedSeatCount(inputs.roster, nameMapping),
            unmatchedSeats: seatsWithoutOwnPerson([...nameMapping.names.values()]),
          };
        })(),
        tools.voteDeadlineMilliseconds ?? VOTE_DEADLINE_MILLISECONDS,
        `vote #${index}`,
      );
      readVotings.push(voting);
      tools.log.info(
        `${inputs.sessionId} #${index} ${formatSeconds(event.startSeconds)} ${voting.heading.raw.slice(0, 60)}`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      tools.log.warn(`${inputs.sessionId} #${index} ${formatSeconds(event.startSeconds)} unreadable: ${detail}`);
      unreadable.push(unreadableVoting(index, event, frameSeconds, detail));
    }
  }

  await confirmRepeatedVotings(readVotings, inputs.hdVideoUrl, tools);
  await relinkAgendaItemsByPaper(readVotings, inputs.agenda, (item) => {
    if (!item.consultationUrl) return Promise.resolve(null);
    if (!paperReferences.has(item.agendaItemId)) {
      paperReferences.set(
        item.agendaItemId,
        fetchPaperReference(tools.fetchJson, item.consultationUrl).catch(() => null),
      );
    }
    return paperReferences.get(item.agendaItemId) as Promise<string | null>;
  });
  readVotings.forEach((voting, position) => {
    const neighbours = [readVotings[position - 1], readVotings[position + 1]].filter((neighbour) => neighbour);
    voting.announced = assignAnnouncement(
      voting.announcementCandidates,
      voting.tally,
      neighbours.map((neighbour) => neighbour.tally),
    );
  });

  const checkedVotings = readVotings.map(
    ({
      readingsAgree,
      seatCount,
      unmatchedSeats,
      seatStates: _seatStates,
      distinctFromPrevious,
      announcementCandidates: _announcementCandidates,
      expectedSeatCount,
      repeatCall,
      ...voting
    }) => {
      const { checks, status } = checkVoting({
        seatCount,
        expectedSeatCount,
        tally: voting.tally,
        readingsAgree,
        resultBars: voting.board.resultBars,
        presentMembers: voting.board.presentMembers,
        castVotes: voting.board.castVotes,
        unmatchedSeats,
        agendaItemNumber: voting.heading.agendaItemNumber,
        agendaItemKnown: voting.oparl !== null,
        agendaItemIsParent: voting.oparl?.isParentAgendaItem ?? false,
        boardParentPaperReference: voting.oparl?.isParentAgendaItem
          ? paperReadForAgendaItem(readVotings, voting.oparl.number)
          : null,
        paperReference: voting.heading.paperReference,
        oparlPaperReference: voting.oparl?.paperReference ?? null,
        oparlResult: voting.oparl?.result ?? null,
        votingsOnAgendaItem: readVotings.filter((other) => agendaItemKey(other) === agendaItemKey(voting)).length,
        agendaItemMatchedByPaper: voting.oparl?.matchedByPaper ?? false,
        oparlAgendaItemNumber: voting.oparl?.number ?? null,
        announced: voting.announced,
        distinctFromPrevious,
        resultPhaseSeconds: voting.videoSeconds.end - voting.videoSeconds.start,
        repeatCall,
      });
      return { ...voting, checks, checkStatus: status, status };
    },
  );
  return [...checkedVotings, ...unreadable].sort((a, b) => a.index - b.index);
}

// OParl keeps only "bereits behandelt" placeholders without paper for items of a two-day session that were dealt with
// on the other day. The parent's paper is then taken from the board of the parent item's own vote.
function paperReadForAgendaItem(votings: ReadVoting[], agendaItemNumber: string | null): string | null {
  return (
    votings.find((voting) => voting.heading.agendaItemNumber === agendaItemNumber && voting.heading.paperReference)
      ?.heading.paperReference ?? null
  );
}

// The board and OParl sometimes number the amendments of one item differently (OParl counts one the board skips). The
// paper reference is more specific than the number, so a vote whose paper differs from its TOP's paper is linked to
// the sibling item that has the board's paper, if there is exactly one.
export async function relinkAgendaItemsByPaper(
  votings: ReadVoting[],
  agenda: AgendaItem[],
  paperOf: (item: AgendaItem) => Promise<string | null>,
): Promise<void> {
  for (const voting of votings) {
    const boardPaper = voting.heading.paperReference;
    const linked = voting.oparl;
    if (!boardPaper || !linked?.paperReference || linked.isParentAgendaItem || !linked.number) continue;
    if (samePaper(boardPaper, linked.paperReference)) continue;
    const parentNumber = linked.number.split('.').slice(0, -1).join('.');
    const siblings = agenda.filter(
      (item) => item.number !== linked.number && item.number.split('.').slice(0, -1).join('.') === parentNumber,
    );
    const matches: { item: AgendaItem; paper: string }[] = [];
    for (const item of siblings) {
      const paper = await paperOf(item);
      if (paper && samePaper(boardPaper, paper)) matches.push({ item, paper });
    }
    if (matches.length !== 1) continue;
    const [{ item, paper }] = matches;
    voting.oparl = {
      agendaItemId: item.agendaItemId,
      number: item.number,
      isParentAgendaItem: false,
      matchedByPaper: true,
      name: item.name,
      result: item.result,
      paperReference: paper,
    };
  }
}

// Votes on the same agenda item; sub-items linked to their parent count under their own number.
function agendaItemKey(voting: Pick<ReadVoting, 'heading' | 'oparl'>): string | null {
  if (!voting.oparl || voting.oparl.isParentAgendaItem) return voting.heading.agendaItemNumber;
  return voting.oparl.agendaItemId;
}

// Announcements are searched from shortly before the board to the next vote. A subtitle cue can run for half a minute,
// so a cue from before the previous board still overlaps the window; the chair reads a result out before its board
// appears, so such an announcement belongs to the previous vote.
export function announcementsAround(
  cues: SubtitleCue[],
  event: VoteEvent,
  previousEvent: VoteEvent | undefined,
  nextEvent: VoteEvent | undefined,
): AnnouncedResult[] {
  const previousEnd = previousEvent?.endSeconds ?? 0;
  const previousStart = previousEvent?.startSeconds ?? Number.NEGATIVE_INFINITY;
  return findAnnouncedResults(
    cues,
    Math.max(event.startSeconds - ANNOUNCEMENT_LEAD_SECONDS, previousEnd),
    Math.min(event.endSeconds + 60, nextEvent?.startSeconds ?? Infinity),
  ).filter((candidate) => candidate.atSeconds > previousStart);
}

// When the voting system fails, the chair has the vote repeated („Ich wiederhole noch einmal die Abstimmung“, „Lösch
// noch mal, mach neu … Noch einmal bitte“). The board before that call is no valid result.
// „noch einmal bitte“ alone also asks a person to speak again, so it counts only together with the vote.
const REPEAT_CALL =
  /wiederhole (?:noch einmal |nochmal |noch mal )?die Abstimmung|Abstimmung (?:noch einmal )?wiederholen|L[öo]sch(?:en)? noch ?mal|mach neu|noch einmal bitte\b.*(?:Votum|abstimm)/i;

export function findRepeatCall(
  cues: SubtitleCue[],
  event: VoteEvent,
  nextEvent: VoteEvent | undefined,
): { seconds: number; quote: string } | null {
  if (!nextEvent) return null;
  const cue = cues.find(
    (candidate) =>
      candidate.startSeconds >= event.startSeconds - 5 &&
      candidate.startSeconds < nextEvent.startSeconds &&
      REPEAT_CALL.test(candidate.text),
  );
  return cue ? { seconds: cue.startSeconds, quote: cue.text } : null;
}

function findAgendaItem(
  agenda: AgendaItem[],
  number: string | null,
): { agendaItem: AgendaItem | null; isParent: boolean } {
  if (number === null) return { agendaItem: null, isParent: false };
  const exact = agenda.find((item) => item.number === number);
  if (exact) return { agendaItem: exact, isParent: false };
  const parentNumber = number.split('.').slice(0, -1).join('.');
  const parent = parentNumber.includes('.') ? agenda.find((item) => item.number === parentNumber) : undefined;
  return { agendaItem: parent ?? null, isParent: parent !== undefined };
}

function unreadableVoting(index: number, event: VoteEvent, frames: number[], detail: string): ExtractedVoting {
  return {
    index,
    videoSeconds: { start: event.startSeconds, end: event.endSeconds, frames },
    heading: { raw: '', agendaItemNumber: null, paperReference: null, title: '' },
    oparl: null,
    board: { presentMembers: null, castVotes: null, resultBars: { J: null, N: null, E: null } },
    tally: { J: 0, N: 0, E: 0, present: 0, absent: 0, unknown: 0 },
    announced: null,
    votes: [],
    checks: [{ check: 'board-readable', passed: false, detail }],
    checkStatus: 'needs-review',
    status: 'needs-review',
  };
}

function showsResult(grab: BoardGrab): boolean {
  return findResultBars(grab.frame, grab.reading.layout).length > 0;
}

// A frame caught while the stream cross-fades to the room camera shows the board half transparent; most seats are then
// unreadable. Such a frame is no reading of the result.
const MINIMUM_READABLE_SEATS = 60;

function isUsableResult(grab: BoardGrab): boolean {
  const seats = grab.reading.cells.filter((cell) => cell.kind === 'seat');
  const unreadable = seats.filter((cell) => cell.kind === 'seat' && cell.state === 'unknown').length;
  return showsResult(grab) && seats.length >= MINIMUM_READABLE_SEATS && unreadable === 0;
}

// The full-HD variant can run a few seconds apart from the low-resolution one the scan used, so the picked frames may
// miss the result or catch a cross-fade. Then the result phase itself is searched second by second, and only after
// that its surroundings, where a frame may show a count still in progress.
const RESULT_SEARCH_MARGIN_SECONDS = 6;

export function resultSearchSeconds(event: VoteEvent): number[] {
  const inside: number[] = [];
  for (let seconds = Math.ceil(event.startSeconds); seconds <= Math.floor(event.endSeconds); seconds++)
    inside.push(seconds);
  const around: number[] = [];
  for (let step = 1; step <= RESULT_SEARCH_MARGIN_SECONDS; step++) {
    around.push(Math.floor(event.startSeconds) - step, Math.ceil(event.endSeconds) + step);
  }
  return [...new Set([...inside, ...around])].filter((seconds) => seconds >= 0);
}

async function searchResultFrames(
  video: VideoReader,
  url: string,
  event: VoteEvent,
): Promise<{ grab: BoardGrab; agrees: boolean; frameSeconds: number[] }> {
  const results: BoardGrab[] = [];
  for (const seconds of resultSearchSeconds(event)) {
    const grab = await grabBoard(video, url, seconds).catch(() => null);
    if (!grab || !isUsableResult(grab)) continue;
    const agreeing = results.find((other) => seatStates(other.reading.cells) === seatStates(grab.reading.cells));
    if (agreeing) {
      return { grab: agreeing, agrees: true, frameSeconds: [agreeing.seconds, grab.seconds] };
    }
    results.push(grab);
  }
  if (results.length === 0) throw new Error('no readable result frame near the scanned result phase');
  return { grab: results[0], agrees: false, frameSeconds: results.map((grab) => grab.seconds) };
}

type BoardGrab = { seconds: number; png: Uint8Array; frame: RgbFrame; reading: ReturnType<typeof readBoard> };

// Now and then the stream delivers a damaged frame although ffmpeg reports success; such a frame shows no board, so it
// is fetched again, slightly shifted, before the vote counts as unreadable.
const GRAB_OFFSETS = [0, 0.2, -0.2];

async function grabBoard(video: VideoReader, url: string, seconds: number): Promise<BoardGrab> {
  let lastError: unknown;
  for (const offset of GRAB_OFFSETS) {
    const shiftedSeconds = Math.round((seconds + offset) * 10) / 10;
    const png = await video.grabFramePng(url, shiftedSeconds);
    const frame = decodePngFrame(png);
    try {
      return { seconds: shiftedSeconds, png, frame, reading: readBoard(frame) };
    } catch (error) {
      if (!(error instanceof BoardLayoutError)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

// A vote shown again looks exactly like the previous one. A repeated vote looks the same, too, but in between the
// board was reset and filled again; a frame in between with fewer cast votes proves that.
async function confirmRepeatedVotings(votings: ReadVoting[], url: string, tools: ExtractionTools): Promise<void> {
  for (let index = 1; index < votings.length; index++) {
    const [previous, current] = [votings[index - 1], votings[index]];
    if (current.index !== previous.index + 1 || current.seatStates !== previous.seatStates) continue;
    const cast = current.tally.J + current.tally.N + current.tally.E;
    const from = previous.videoSeconds.end;
    const gap = current.videoSeconds.start - from;
    current.distinctFromPrevious = false;
    for (const share of [0.25, 0.5, 0.75]) {
      const seconds = Math.round((from + gap * share) * 10) / 10;
      const reading = await readBoardAt(tools.video, url, seconds);
      const tally = reading ? tallySeats(reading.cells) : null;
      if (tally && tally.J + tally.N + tally.E < cast) {
        current.distinctFromPrevious = true;
        break;
      }
    }
    if (!current.distinctFromPrevious) {
      tools.log.warn(`vote #${current.index} repeats #${previous.index} without a board reset in between`);
    }
  }
}

async function readBoardAt(
  video: VideoReader,
  url: string,
  seconds: number,
): Promise<ReturnType<typeof readBoard> | null> {
  try {
    return readBoard(decodePngFrame(await video.grabFramePng(url, seconds)));
  } catch (error) {
    if (error instanceof BoardLayoutError) return null;
    throw error;
  }
}

// A damaged frame can also look like a board with wrong cells. If the two frames disagree, a third frame decides: the
// reading two frames share is used. Without such a pair the vote needs review.
async function settleReading(
  video: VideoReader,
  url: string,
  first: BoardGrab,
  second: BoardGrab,
): Promise<{ grab: BoardGrab; agrees: boolean; frameSeconds: number[] }> {
  if (seatStates(first.reading.cells) === seatStates(second.reading.cells)) {
    return { grab: first, agrees: true, frameSeconds: [first.seconds, second.seconds] };
  }
  const third = await grabBoard(video, url, Math.round(((first.seconds + second.seconds) / 2) * 10) / 10);
  const frameSeconds = [first.seconds, second.seconds, third.seconds];
  const thirdStates = seatStates(third.reading.cells);
  if (thirdStates === seatStates(first.reading.cells)) return { grab: first, agrees: true, frameSeconds };
  if (thirdStates === seatStates(second.reading.cells)) return { grab: second, agrees: true, frameSeconds };
  return { grab: first, agrees: false, frameSeconds };
}

// Two frames from the result phase are read; they must agree, which rules out a frame caught mid-transition.
export function pickFrameSeconds(event: VoteEvent): number[] {
  const duration = event.endSeconds - event.startSeconds;
  if (duration < 1) {
    return [event.startSeconds + 0.1, event.startSeconds + 0.4];
  }
  return [event.startSeconds + duration * 0.35, event.startSeconds + duration * 0.75].map(
    (seconds) => Math.round(seconds * 10) / 10,
  );
}

// The board lists every council member of the day including the mayor; a vacant mandate has no seat. A successor whose
// OParl membership starts after the session counts only if the board shows them.
function expectedSeatCount(roster: RosterPerson[], mapping: NameMapping): number {
  const seatedSuccessors = [...mapping.names.values()].filter((entry) => entry.person?.joinsAfterSessionDay).length;
  return roster.filter((person) => !person.joinsAfterSessionDay).length + seatedSuccessors;
}

async function rereadUnmatchedNames(
  names: NameMapping['names'],
  cells: BoardCell[],
  roster: RosterPerson[],
  reread: (cell: BoardCell) => Promise<string>,
): Promise<void> {
  for (const cell of cells.filter((candidate) => candidate.kind === 'seat')) {
    const entry = names.get(cellKey(cell));
    if (!entry || entry.person) continue;
    const boardName = await reread(cell);
    const match = matchBoardName(boardName, roster);
    if (match.person) names.set(cellKey(cell), { boardName, person: match.person });
  }
}

// Each cell is matched to the roster on its own, so two misread names can land on the same person. The seat count then
// still fits, which is why such seats count as unmatched.
export function seatsWithoutOwnPerson(
  entries: { boardName: string; person: Pick<RosterPerson, 'personId' | 'name'> | null; reason?: string }[],
): string[] {
  const seatsPerPerson = new Map<string, number>();
  for (const entry of entries) {
    if (entry.person) seatsPerPerson.set(entry.person.personId, (seatsPerPerson.get(entry.person.personId) ?? 0) + 1);
  }
  const unmatched = entries.filter((entry) => !entry.person).map((entry) => entry.reason ?? entry.boardName);
  const shared = entries
    .filter((entry) => entry.person && (seatsPerPerson.get(entry.person.personId) ?? 0) > 1)
    .map((entry) => `"${entry.boardName}" shares ${entry.person?.name} with another seat`);
  return [...unmatched, ...shared];
}

function mapNames(
  namesByCell: { column: number; row: number; name: string }[],
  cells: BoardCell[],
  roster: RosterPerson[],
): NameMapping['names'] {
  const names: NameMapping['names'] = new Map();
  for (const cell of cells.filter((candidate) => candidate.kind === 'seat')) {
    const boardName = namesByCell
      .filter((entry) => entry.column === cell.column && entry.row === cell.row)
      .map((entry) => entry.name)
      .join(' ');
    const match = matchBoardName(boardName, roster);
    names.set(
      cellKey(cell),
      match.person ? { boardName, person: match.person } : { boardName, person: null, reason: match.reason },
    );
  }
  return names;
}

function toSeatVotes(cells: BoardCell[], mapping: NameMapping): SeatVote[] {
  return cells.flatMap((cell) => {
    if (cell.kind !== 'seat') return [];
    const entry = mapping.names.get(cellKey(cell));
    return [
      {
        column: cell.column,
        row: cell.row,
        boardName: entry?.boardName ?? '',
        personId: entry?.person?.personId ?? null,
        vote: toVoteCode(cell.state),
        attendance: cell.state === 'absent' ? 'absent' : 'present',
      },
    ];
  });
}

function toVoteCode(state: SeatState): VoteCode {
  return state === 'J' || state === 'N' || state === 'E' ? state : 'O';
}

function tallySeats(cells: BoardCell[]): Tally {
  const tally: Tally = { J: 0, N: 0, E: 0, present: 0, absent: 0, unknown: 0 };
  for (const cell of cells) {
    if (cell.kind === 'seat') tally[cell.state]++;
  }
  return tally;
}

function seatStates(cells: BoardCell[]): string {
  return cells.map((cell) => (cell.kind === 'seat' ? cell.state : cell.kind)).join(',');
}

// Seat names only change when a member joins or leaves, so they are read again only when the name columns change.
function nameMask(frame: RgbFrame, layout: BoardLayout): boolean[] {
  const mask: boolean[] = [];
  for (let column = 0; column < layout.columns.length; column++) {
    const area = nameColumnArea(layout, column);
    for (let y = area.top; y < area.top + area.height; y += 2) {
      for (let x = area.left; x < area.left + area.width; x += 2) {
        mask.push(isDark(pixelAt(frame, x, y)));
      }
    }
  }
  return mask;
}

function masksMatch(reference: boolean[], candidate: boolean[]): boolean {
  if (reference.length !== candidate.length) return false;
  let differing = 0;
  for (let index = 0; index < reference.length; index++) {
    if (reference[index] !== candidate[index]) differing++;
  }
  return differing / reference.length < 0.01;
}

function cellKey(cell: { column: number; row: number }): string {
  return `${cell.column}/${cell.row}`;
}

export function formatSeconds(seconds: number): string {
  const whole = Math.floor(seconds);
  return [Math.floor(whole / 3600), Math.floor((whole % 3600) / 60), whole % 60]
    .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, '0')))
    .join(':');
}
