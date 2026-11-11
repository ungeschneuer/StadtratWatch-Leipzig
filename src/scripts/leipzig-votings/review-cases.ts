import type { ReviewCase, ReviewCasesFile, ReviewNeighbour, ReviewPriority } from '@srw-astro/models/leipzig-review';
import type { VoteCode } from '@srw-astro/models/session';

import { type ExtractedVoting, formatSeconds, type SeatVote } from './extract-session.ts';
import { seatChangesForAnnouncement, seatsNamedIn } from './seat-changes.ts';
import type { SubtitleCue } from './subtitle-announcements.ts';

export type ReviewInputs = {
  sessionId: string;
  oparlMeetingId: string | null;
  hlsUrl: string;
  mediathekUrl: string;
  videoAvailable: boolean;
  votings: ExtractedVoting[];
  cues: SubtitleCue[] | null;
  // File names of the cropped evidence images that exist for this session, e.g. "2026-02-25-009-board.png".
  imageNames: Set<string>;
  imageBaseUrl: string;
  // Where the official results come from: minutes PDF, ALLRIS meeting page, Verlaufsprotokoll.
  officialLinks?: { label: string; url: string }[];
  now: Date;
};

const ALLRIS_BASE_URL = 'https://ratsinformation.leipzig.de/allris_leipzig_public';
const TRANSCRIPT_LEAD_SECONDS = 30;
const TRANSCRIPT_TRAIL_SECONDS = 60;
const AGENDA_MENTION_LEAD_SECONDS = 180;
const CORRECTION_HINT =
  /hinzugez[äa]hlt|dazugez[äa]hlt|zugez[äa]hlt|nachgetragen|korrigier|dazu,|gegen Rot|enth[äa]lt sich|nicht elektronisch/i;

export function buildReviewCases(inputs: ReviewInputs): ReviewCasesFile {
  const cases = inputs.votings
    .filter((voting) => voting.checkStatus === 'needs-review')
    .map((voting) => buildCase(voting, inputs));
  return {
    sessionId: inputs.sessionId,
    generatedAt: inputs.now.toISOString(),
    video: { hlsUrl: inputs.hlsUrl, mediathekUrl: inputs.mediathekUrl, available: inputs.videoAvailable },
    summary: {
      cases: cases.length,
      open: cases.filter((reviewCase) => reviewCase.open).length,
      reviewed: cases.filter((reviewCase) => !reviewCase.open).length,
    },
    cases,
  };
}

function buildCase(voting: ExtractedVoting, inputs: ReviewInputs): ReviewCase {
  const position = inputs.votings.indexOf(voting);
  const seconds = voting.videoSeconds.frames[0] ?? voting.videoSeconds.start;
  const failed = voting.checks.filter((check) => !check.passed);
  const transcript = transcriptAround(inputs.cues, voting);
  const namedSeats = seatsNamedIn(transcript.map((line) => line.text).join(' '), voting.votes);
  const candidates = [
    ...namedSeats.map((seat) => ({ ...seat, reason: 'in der Ansage genannt' })),
    ...voting.votes
      .filter((seat) => seat.vote === 'O' && seat.attendance === 'present' && !namedSeats.includes(seat))
      .map((seat) => ({ ...seat, reason: 'anwesend, ohne Stimme' })),
  ]
    .filter((seat): seat is SeatVote & { personId: string; reason: string } => seat.personId !== null)
    .map(({ personId, boardName, reason }) => ({ personId, boardName, reason }));

  return {
    votingIndex: voting.index,
    open: voting.status === 'needs-review',
    priority: priorityOf(failed.map((check) => check.check)),
    videoSeconds: seconds,
    timecode: formatSeconds(seconds),
    agendaItemNumber: voting.heading.agendaItemNumber,
    paperReference: voting.heading.paperReference,
    title: voting.heading.title || voting.heading.raw,
    problems: failed.map((check) => ({
      check: check.check,
      message: describeProblem(check.check, voting),
      detail: check.detail,
    })),
    board: {
      J: voting.tally.J,
      N: voting.tally.N,
      E: voting.tally.E,
      castVotes: voting.board.castVotes,
      presentMembers: voting.board.presentMembers,
    },
    official: voting.official ?? null,
    announced: voting.announced
      ? {
          J: voting.announced.J,
          N: voting.announced.N,
          E: voting.announced.E,
          timecode: formatSeconds(voting.announced.atSeconds),
          quote: voting.announced.quote,
        }
      : null,
    transcript,
    neighbours: {
      previous: toNeighbour(inputs.votings[position - 1]),
      next: toNeighbour(inputs.votings[position + 1]),
    },
    links: linksOf(voting, inputs),
    images: imagesOf(voting, inputs),
    seats: voting.votes.map(({ column, row, boardName, personId, vote, attendance }) => ({
      column,
      row,
      boardName,
      personId,
      vote: vote,
      attendance,
    })),
    candidates,
    suggestions: suggest(
      voting,
      failed.map((check) => check.check),
      namedSeats,
      inputs.cues ?? [],
      inputs.votings,
    ),
    reviews: voting.review ?? [],
  };
}

function describeProblem(check: string, voting: ExtractedVoting): string {
  const board = `${voting.tally.J}/${voting.tally.N}/${voting.tally.E}`;
  switch (check) {
    case 'seats-complete':
      return 'Nicht alle Sitze der Tafel konnten gelesen werden.';
    case 'second-frame-agrees':
      return 'Zwei Bilder derselben Tafel zeigen unterschiedliche Stimmen.';
    case 'colours-match-result-bars':
      return `Die Farben der Sitze (${board}) passen nicht zu den Zahlen an den Balken.`;
    case 'colours-match-cast-votes':
      return 'Die Farben der Sitze passen nicht zu „Abgegebene Stimmen“.';
    case 'seat-numbers-match-present-members':
      return 'Die Sitznummern passen nicht zu „Anwesende“.';
    case 'names-match-roster':
      return 'Nicht jeder Name auf der Tafel passt zu einem Ratsmitglied des Tages.';
    case 'agenda-item-in-oparl':
      return voting.heading.agendaItemNumber
        ? `TOP ${voting.heading.agendaItemNumber} steht nicht in der OParl-Tagesordnung.`
        : 'Die Tafel nennt keinen TOP (Überschrift „ABSTIMMUNG“). Bitte TOP zuordnen.';
    case 'paper-matches-oparl':
      return `Die Vorlage auf der Tafel (${voting.heading.paperReference}) weicht von OParl (${voting.oparl?.paperReference}) ab.`;
    case 'outcome-matches-oparl':
      return `Das Ergebnis der Tafel passt nicht zum OParl-Ergebnis „${voting.oparl?.result}“.`;
    case 'announcement-matches':
      return voting.announced?.mentionsCorrection
        ? 'Die Sitzungsleitung korrigiert das Ergebnis mündlich.'
        : `Die gesprochene Ansage (${voting.announced?.J}/${voting.announced?.N}/${voting.announced?.E ?? '–'}) weicht von der Tafel (${board}) ab.`;
    case 'matches-official':
      return voting.official
        ? `Das amtliche Ergebnis ist ${voting.official.J}/${voting.official.N}/${voting.official.E}, die Tafel zeigt ${board}; jemand wurde von Hand gezählt, aber das Verlaufsprotokoll nennt nicht eindeutig, wer.`
        : 'Das amtliche Ergebnis weicht von der Tafel ab.';
    case 'official-sources-agree':
      return 'Niederschrift und Verlaufsprotokoll nennen unterschiedliche Ergebnisse.';
    case 'not-repeated':
      return 'Die Sitzungsleitung hat die Abstimmung wiederholen lassen; diese Tafel ist vermutlich ungültig.';
    case 'result-shown-long-enough':
      return 'Die Ergebnisbalken waren nur kurz zu sehen; das kann ein Zwischenstand während der Abstimmung sein.';
    case 'most-present-members-voted':
      return 'Nur wenige Anwesende haben abgestimmt; das kann ein Zwischenstand während der Abstimmung sein.';
    case 'distinct-from-previous':
      return 'Die Tafel gleicht der vorherigen Abstimmung, ohne dass sie dazwischen zurückgesetzt wurde.';
    default:
      return check;
  }
}

// hoch: the votes themselves are in doubt; mittel: the vote is read right, but its link to OParl differs; niedrig: only
// the agenda item has to be assigned.
function priorityOf(failedChecks: string[]): ReviewPriority {
  const affectsVotes = failedChecks.some((check) =>
    [
      'announcement-matches',
      'seats-complete',
      'second-frame-agrees',
      'colours-match-result-bars',
      'colours-match-cast-votes',
      'seat-numbers-match-present-members',
      'distinct-from-previous',
      'result-shown-long-enough',
      'most-present-members-voted',
      'not-repeated',
      'matches-official',
      'official-sources-agree',
    ].includes(check),
  );
  if (affectsVotes) return 'hoch';
  if (failedChecks.every((check) => check === 'agenda-item-in-oparl')) return 'niedrig';
  return 'mittel';
}

function transcriptAround(cues: SubtitleCue[] | null, voting: ExtractedVoting): ReviewCase['transcript'] {
  if (!cues) return [];
  const from = voting.videoSeconds.start - TRANSCRIPT_LEAD_SECONDS;
  const to = voting.videoSeconds.end + TRANSCRIPT_TRAIL_SECONDS;
  return cues
    .filter((cue) => cue.endSeconds >= from && cue.startSeconds <= to)
    .map((cue) => ({
      seconds: cue.startSeconds,
      timecode: formatSeconds(cue.startSeconds),
      text: cue.text,
      highlight: /\d{1,2}\s*zu\s*\d{1,2}|dafür|dagegen|Enthaltung/i.test(cue.text) || CORRECTION_HINT.test(cue.text),
    }));
}

function suggest(
  voting: ExtractedVoting,
  failedChecks: string[],
  namedSeats: SeatVote[],
  cues: SubtitleCue[],
  votings: ExtractedVoting[],
): ReviewCase['suggestions'] {
  const at = {
    videoSeconds: voting.videoSeconds.start,
    agendaItemNumber: voting.heading.agendaItemNumber ?? undefined,
  };
  const voteAddress = at.agendaItemNumber ? at : { videoSeconds: at.videoSeconds };
  const suggestions: ReviewCase['suggestions'] = [];
  const announced = voting.announced;

  if (failedChecks.includes('matches-official') && voting.official) {
    const official = voting.official;
    const seats = seatChangesForAnnouncement(voting, official, namedSeats);
    if (seats.complete && seats.changes.length > 0) {
      suggestions.push({
        label: `Stimmen auf das amtliche Ergebnis ändern: ${seats.changes.map((change) => `${change.boardName} → ${voteLabel(change.vote)}`).join(', ')}`,
        correction: {
          voting: voteAddress,
          seats: seats.changes.map(({ personId, vote }) => ({ personId, vote })),
          reason: `Amtliches Ergebnis ${official.J}/${official.N}/${official.E}`,
          source: official.sources.map((source) => `${source.kind}: ${source.label}`).join('; '),
        },
      });
    }
  }

  // Nobody named, but exactly as many members are present without a vote as were added: they are the likely ones.
  if (failedChecks.includes('matches-official') && voting.official && suggestions.length === 0) {
    const official = voting.official;
    const nonVoters = voting.votes.filter((seat) => seat.vote === 'O' && seat.attendance === 'present');
    const seats = seatChangesForAnnouncement(voting, official, nonVoters);
    const added =
      Math.max(0, official.J - voting.tally.J) +
      Math.max(0, official.N - voting.tally.N) +
      Math.max(0, official.E - voting.tally.E);
    if (seats.complete && nonVoters.length === added && added > 0) {
      suggestions.push({
        label: `Einzige anwesende Mitglieder ohne Stimme zählen: ${seats.changes.map((change) => `${change.boardName} → ${voteLabel(change.vote)}`).join(', ')}`,
        correction: {
          voting: voteAddress,
          seats: seats.changes.map(({ personId, vote }) => ({ personId, vote })),
          reason: `Amtliches Ergebnis ${official.J}/${official.N}/${official.E}; nur ${nonVoters.map((seat) => seat.boardName).join(', ')} anwesend ohne Stimme`,
          source: 'Belegbild und amtliches Ergebnis',
        },
      });
    }
  }

  if (failedChecks.includes('announcement-matches') && announced) {
    const seats = seatChangesForAnnouncement(voting, announced, namedSeats);
    const matchesBoard =
      announced.J === voting.tally.J &&
      announced.N === voting.tally.N &&
      (announced.E ?? voting.tally.E) === voting.tally.E;
    if (seats.complete && seats.changes.length > 0) {
      suggestions.push({
        label: `Stimmen laut Ansage ändern: ${seats.changes.map((change) => `${change.boardName} → ${voteLabel(change.vote)}`).join(', ')}`,
        correction: {
          voting: voteAddress,
          seats: seats.changes.map(({ personId, vote }) => ({ personId, vote })),
          reason: `Mündlich korrigiert, Ansage ${announced.J}/${announced.N}/${announced.E ?? '–'}`,
          source: `Untertitel ${formatSeconds(announced.atSeconds)}: „${announced.quote}“`,
        },
      });
    } else if (matchesBoard) {
      suggestions.push({
        label: 'Zahlen der Ansage stimmen mit der Tafel überein – bestätigen',
        correction: {
          voting: voteAddress,
          approve: true,
          reason: 'Ansage nennt eine Korrektur, das Ergebnis entspricht aber der Tafel',
          source: `Untertitel ${formatSeconds(announced.atSeconds)}: „${announced.quote}“`,
        },
      });
    }
  }

  if (failedChecks.includes('agenda-item-in-oparl') && !voting.heading.agendaItemNumber) {
    for (const candidate of agendaItemCandidates(voting, cues, votings)) {
      suggestions.push({
        label: `TOP ${candidate.number} zuordnen (${candidate.reason})`,
        correction: {
          voting: { videoSeconds: voting.videoSeconds.start },
          agendaItemNumber: candidate.number,
          reason: `Tafel ohne TOP; ${candidate.reason}`,
          source: candidate.source,
        },
      });
    }
  }

  if (failedChecks.includes('not-repeated')) {
    suggestions.push({
      label: 'Abstimmung wurde wiederholt – diese Tafel verwerfen',
      correction: {
        voting: voteAddress,
        discard: true,
        reason: 'Abstimmung auf Bitte der Sitzungsleitung wiederholt',
        source: `Video ${formatSeconds(voting.videoSeconds.start)}`,
      },
    });
  } else if (failedChecks.includes('result-shown-long-enough') || failedChecks.includes('most-present-members-voted')) {
    suggestions.push({
      label: 'Keine gültige Abstimmung (Zwischenstand) – verwerfen',
      correction: {
        voting: voteAddress,
        discard: true,
        reason: 'Zwischenstand oder alte Tafel, nicht das Ergebnis der Abstimmung',
        source: `Video ${formatSeconds(voting.videoSeconds.start)}`,
      },
    });
  }

  const approvals: Record<string, string> = {
    'paper-matches-oparl': `Vorlage geprüft: Tafel ${voting.heading.paperReference}, OParl ${voting.oparl?.paperReference}`,
    'outcome-matches-oparl': `Ergebnis geprüft, OParl „${voting.oparl?.result}“`,
    'colours-match-result-bars': 'Balkenzahlen am Belegbild geprüft',
    'colours-match-cast-votes': '„Abgegebene Stimmen“ am Belegbild geprüft',
    'names-match-roster': 'Namen am Belegbild geprüft',
  };
  const onlyApprovable = failedChecks.every((check) => check in approvals);
  if (onlyApprovable && failedChecks.length > 0) {
    suggestions.push({
      label: 'Tafel-Lesung ist richtig – bestätigen',
      correction: {
        voting: voteAddress,
        approve: true,
        reason: failedChecks.map((check) => approvals[check]).join('; '),
        source: `Belegbild ${formatSeconds(voting.videoSeconds.frames[0] ?? voting.videoSeconds.start)}`,
      },
    });
  }
  return suggestions;
}

function agendaItemCandidates(
  voting: ExtractedVoting,
  cues: SubtitleCue[],
  votings: ExtractedVoting[],
): { number: string; reason: string; source: string }[] {
  const candidates: { number: string; reason: string; source: string }[] = [];
  const add = (number: string, reason: string, source: string) => {
    if (!candidates.some((candidate) => candidate.number === number)) candidates.push({ number, reason, source });
  };
  const mentionWindowStart = voting.videoSeconds.start - AGENDA_MENTION_LEAD_SECONDS;
  const lines = cues
    .filter((cue) => cue.startSeconds >= mentionWindowStart && cue.startSeconds <= voting.videoSeconds.end)
    .map((cue) => ({ timecode: formatSeconds(cue.startSeconds), text: cue.text }))
    .reverse();
  for (const line of lines) {
    for (const match of [
      ...line.text.matchAll(/(?<![\d.,])(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)(?![\d,]|\.\d)/g),
    ].reverse()) {
      add(match[1], `in der Sitzung bei ${line.timecode} genannt`, `Untertitel ${line.timecode}: „${line.text}“`);
    }
  }
  const position = votings.indexOf(voting);
  const previous = votings.slice(0, position).findLast((other) => other.heading.agendaItemNumber);
  const next = votings.slice(position + 1).find((other) => other.heading.agendaItemNumber);
  if (previous?.heading.agendaItemNumber) {
    add(previous.heading.agendaItemNumber, 'TOP der vorherigen Abstimmung', `Abstimmung #${previous.index}`);
  }
  if (next?.heading.agendaItemNumber) {
    add(next.heading.agendaItemNumber, 'TOP der folgenden Abstimmung', `Abstimmung #${next.index}`);
  }
  return candidates;
}

function toNeighbour(voting: ExtractedVoting | undefined): ReviewNeighbour | null {
  if (!voting) return null;
  return {
    votingIndex: voting.index,
    agendaItemNumber: voting.heading.agendaItemNumber,
    title: voting.heading.title || voting.heading.raw,
    result: `${voting.tally.J}/${voting.tally.N}/${voting.tally.E}`,
    timecode: formatSeconds(voting.videoSeconds.start),
  };
}

function linksOf(voting: ExtractedVoting, inputs: ReviewInputs): ReviewCase['links'] {
  const links: ReviewCase['links'] = [{ label: 'Aufzeichnung in der Mediathek', url: inputs.mediathekUrl }];
  for (const link of inputs.officialLinks ?? []) links.push(link);
  if (voting.oparl) {
    links.push({
      label: `TOP ${voting.oparl.number ?? ''} in ALLRIS`,
      url: `${ALLRIS_BASE_URL}/to020?TOLFDNR=${numericId(voting.oparl.agendaItemId)}`,
    });
    links.push({ label: 'TOP in OParl', url: voting.oparl.agendaItemId });
  }
  if (inputs.oparlMeetingId) {
    links.push({
      label: 'Tagesordnung der Sitzung in ALLRIS',
      url: `${ALLRIS_BASE_URL}/to010?SILFDNR=${numericId(inputs.oparlMeetingId)}`,
    });
  }
  return links;
}

export function evidenceImageNames(sessionId: string, votingIndex: number) {
  const prefix = `${sessionId}-${String(votingIndex).padStart(3, '0')}`;
  return { board: `${prefix}-board.png`, heading: `${prefix}-heading.png`, bars: `${prefix}-bars.png` };
}

function imagesOf(voting: ExtractedVoting, inputs: ReviewInputs): ReviewCase['images'] {
  const names = evidenceImageNames(inputs.sessionId, voting.index);
  const labelled = [
    { label: 'Überschrift', name: names.heading },
    { label: 'Ergebnis', name: names.bars },
    { label: 'Ganze Tafel', name: names.board },
  ];
  return labelled
    .filter((image) => inputs.imageNames.has(image.name))
    .map((image) => ({ label: image.label, url: `${inputs.imageBaseUrl.replace(/\/$/, '')}/${image.name}` }));
}

function voteLabel(vote: VoteCode): string {
  return { J: 'Ja', N: 'Nein', E: 'Enthaltung', O: 'keine Stimme' }[vote];
}

function numericId(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1);
}
