import type { LeipzigMembersFile } from '@srw-astro/models/leipzig-members';
import type { Registry, RegistryParty, RegistrySession, RegistrySessionVideo } from '@srw-astro/models/registry';

import type { Recording } from '../leipzig-recordings/recordings-manifest.ts';

export type RegistrySessionInput = {
  recording: Recording;
  // Votes still waiting for a human or for the official result.
  pendingVotings: number;
  meetingMinutesUrl: string | null;
  // The ALLRIS page of the Verlaufsprotokoll the speeches are taken from.
  speechesSourceUrl: string | null;
};

// An editorial entry of data/<period>/party-classifications.json: a party a Verfassungsschutz authority classifies as
// extremist, in its words and with its source. The site shows it on the party page and on the pages of its members.
export type PartyClassification = {
  partyId: string;
  classification: string;
  reason: string;
  source: string;
  sourceUrl: string;
};

// The StadtratWatch registry of a Leipzig parliament period: the members from leipzig-members, the sessions with
// a votings file. A session is approved once no vote waits for review or for its official result.
export function buildRegistry(
  parliamentPeriod: { id: string; name: string },
  members: LeipzigMembersFile,
  sessions: RegistrySessionInput[],
  classifications: PartyClassification[] = [],
): Registry {
  const unknownParty = classifications.find(({ partyId }) => !members.parties.some((party) => party.id === partyId));
  if (unknownParty) throw new Error(`party-classifications.json: no party "${unknownParty.partyId}"`);
  const sortedSessions = [...sessions].sort((a, b) => a.recording.date.localeCompare(b.recording.date));
  const latestSession = sortedSessions.at(-1)?.recording.date ?? '';
  const membersDay = members.generatedAt.slice(0, 10);
  return {
    id: parliamentPeriod.id,
    name: parliamentPeriod.name,
    lastUpdate: `${latestSession > membersDay ? latestSession : membersDay}T00:00:00Z`,
    sessions: sortedSessions.map(toRegistrySession),
    factions: members.factions.map(({ id, name, seats, oparlId }) => ({
      id,
      name,
      seats,
      ...(oparlId ? { oparlId } : {}),
    })),
    parties: members.parties.map(({ id, name, seats }) =>
      withClassification(
        { id, name, seats },
        classifications.find((entry) => entry.partyId === id),
      ),
    ),
    // The history lets the site count each vote for the faction and party of its session day.
    persons: members.persons.map(
      ({ id, oparlId, name, factionId, partyId, start, end, factionMemberships, partyMemberships, bodies }) => ({
        id,
        oparlId,
        name,
        factionId,
        partyId,
        start,
        end,
        factionMemberships,
        partyMemberships: partyMemberships.map(({ partyId: party, start: from, end: until }) => ({
          partyId: party,
          start: from,
          end: until,
        })),
        ...(bodies?.length
          ? { bodies: bodies.map(({ name, kind, role, start, end }) => ({ name, kind, role, start, end })) }
          : {}),
      }),
    ),
  };
}

function withClassification(party: RegistryParty, classification: PartyClassification | undefined): RegistryParty {
  if (!classification) return party;
  return {
    ...party,
    additionalInformation: [
      { key: 'EXTREMIST_CLASSIFICATION', value: classification.classification },
      { key: 'EXTREMIST_CLASSIFICATION_REASON', value: classification.reason },
      { key: 'EXTREMIST_CLASSIFICATION_SOURCE', value: classification.source },
      { key: 'EXTREMIST_CLASSIFICATION_SOURCE_URL', value: classification.sourceUrl },
    ],
  };
}

function toRegistrySession({
  recording,
  pendingVotings,
  meetingMinutesUrl,
  speechesSourceUrl,
}: RegistrySessionInput): RegistrySession {
  return {
    id: recording.sessionId,
    date: recording.date,
    title: recording.meetingName ?? 'Ratsversammlung',
    youtubeUrl: '',
    // The city keeps recordings for about a year; a link to a page that is gone would only lead nowhere.
    ...(recording.goneSince === null ? { video: sessionVideo(recording) } : {}),
    meetingMinutesUrl,
    approved: pendingVotings === 0,
    ...(recording.oparlMeetingId ? { oparlMeetingId: recording.oparlMeetingId } : {}),
    ...(speechesSourceUrl
      ? { speechesSource: { label: 'Verlaufsprotokoll der Ratsversammlung, Stadt Leipzig', url: speechesSourceUrl } }
      : {}),
  };
}

function sessionVideo(recording: Recording): RegistrySessionVideo {
  return {
    url: recording.mediathekUrl,
    label: 'Mediathek',
    ...(recording.playerUrl ? { playerUrl: recording.playerUrl } : {}),
  };
}
