import type { LeipzigMembersFile } from '@srw-astro/models/leipzig-members';
import type { Registry, RegistrySession } from '@srw-astro/models/registry';

import type { Recording } from '../leipzig-recordings/recordings-manifest.ts';

export type RegistrySessionInput = {
  recording: Recording;
  // Votes still waiting for a human or for the official result.
  pendingVotings: number;
  meetingMinutesUrl: string | null;
};

// The StadtratWatch registry of a Leipzig parliament period: the members from leipzig-members, the sessions with
// a votings file. A session is approved once no vote waits for review or for its official result.
export function buildRegistry(
  parliamentPeriod: { id: string; name: string },
  members: LeipzigMembersFile,
  sessions: RegistrySessionInput[],
): Registry {
  const sortedSessions = [...sessions].sort((a, b) => a.recording.date.localeCompare(b.recording.date));
  const latestSession = sortedSessions.at(-1)?.recording.date ?? '';
  const membersDay = members.generatedAt.slice(0, 10);
  return {
    id: parliamentPeriod.id,
    name: parliamentPeriod.name,
    lastUpdate: `${latestSession > membersDay ? latestSession : membersDay}T00:00:00Z`,
    sessions: sortedSessions.map(toRegistrySession),
    factions: members.factions.map(({ id, name, seats }) => ({ id, name, seats })),
    parties: members.parties.map(({ id, name, seats }) => ({ id, name, seats })),
    persons: members.persons.map(({ id, name, factionId, partyId, start, end }) => ({
      id,
      name,
      factionId,
      partyId,
      start,
      end,
    })),
  };
}

function toRegistrySession({ recording, pendingVotings, meetingMinutesUrl }: RegistrySessionInput): RegistrySession {
  return {
    id: recording.sessionId,
    date: recording.date,
    title: recording.meetingName ?? 'Ratsversammlung',
    youtubeUrl: '',
    // The city keeps recordings for about a year; a link to a page that is gone would only lead nowhere.
    ...(recording.goneSince === null ? { video: { url: recording.mediathekUrl, label: 'Mediathek' } } : {}),
    meetingMinutesUrl,
    approved: pendingVotings === 0,
  };
}
