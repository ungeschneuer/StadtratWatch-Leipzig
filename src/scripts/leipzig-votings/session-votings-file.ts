import { factionOn, type LeipzigMembersFile } from '@srw-astro/models/leipzig-members';

import type { Recording } from '../leipzig-recordings/recordings-manifest.ts';
import type { ExtractedVoting } from './extract-session.ts';

export const EXTRACTOR_VERSION = 1;

export function serializeSessionVotings(recording: Recording, votings: ExtractedVoting[]): string {
  const file = {
    sessionId: recording.sessionId,
    oparlMeetingId: recording.oparlMeetingId,
    source: {
      mediathekUrl: recording.mediathekUrl,
      hlsUrl: recording.hlsUrl,
      subtitleFile: recording.subtitleFile,
      method: 'video-board',
      extractorVersion: EXTRACTOR_VERSION,
    },
    summary: summarizeStatuses(votings),
    votings,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export type SessionVotingsFile = { votings: ExtractedVoting[] };

export function summarizeStatuses(votings: ExtractedVoting[]): Record<string, number> {
  const summary: Record<string, number> = {
    votings: votings.length,
    verified: 0,
    corrected: 0,
    provisional: 0,
    reviewed: 0,
    'needs-review': 0,
    skipped: 0,
    discarded: 0,
  };
  for (const voting of votings) summary[voting.status]++;
  return summary;
}

const CSV_COLUMNS = [
  'sessionId',
  'votingIndex',
  'videoSeconds',
  'agendaItemNumber',
  'paperReference',
  'personId',
  'boardName',
  'vote',
  'attendance',
  'boardVote',
  'status',
  'procedural',
  'factionId',
  'partyId',
] as const;

// factionId is the faction on the session day, so a member who changed faction is counted where they sat; both stay
// empty without members file (leipzig-members) or for a seat matched to no one.
export function sessionVotesToCsv(
  sessionId: string,
  votings: ExtractedVoting[],
  members: LeipzigMembersFile | null = null,
): string {
  const personsByOparlId = new Map((members?.persons ?? []).map((person) => [person.oparlId, person]));
  // Discarded votings stay in the JSON as evidence but are no votes.
  const rows = votings
    .filter((voting) => voting.status !== 'discarded')
    .flatMap((voting) =>
      voting.votes.map((vote) => [
        sessionId,
        String(voting.index),
        String(voting.videoSeconds.frames[0]),
        voting.heading.agendaItemNumber ?? voting.official?.agendaItemNumber ?? '',
        voting.heading.paperReference ??
          (voting.heading.agendaItemNumber ? '' : (voting.official?.paperReference ?? '')),
        vote.personId ?? '',
        vote.boardName,
        vote.vote,
        vote.attendance,
        vote.boardVote ?? vote.vote,
        voting.status,
        voting.procedural ? 'true' : 'false',
        ...factionAndParty(vote.personId ? personsByOparlId.get(vote.personId) : undefined, sessionId),
      ]),
    );
  return [CSV_COLUMNS.join(','), ...rows.map((row) => row.map(toCsvField).join(','))].join('\n') + '\n';
}

function factionAndParty(person: LeipzigMembersFile['persons'][number] | undefined, sessionDay: string): string[] {
  if (!person) return ['', ''];
  return [factionOn(person, sessionDay) ?? '', person.partyId];
}

function toCsvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
