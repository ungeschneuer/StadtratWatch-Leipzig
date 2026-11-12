import type { SessionInput } from '@models/SessionInput.ts';
import type {
  Registry,
  RegistryFaction,
  RegistryParty,
} from '@models/registry.ts';
import {
  getPersonsOfSessionAndFaction,
  getPersonsOfSessionAndParty,
} from '@utils/session-utils.ts';
import type { HistoryDataPoint } from './ParticipationRate.ts';

// The registry's seats are those of today. Members who joined, left or changed faction or party make the seats differ
// between sessions; this gives the seats on each session day where they changed.
export function calcSeatsHistoryOfFaction(
  parliamentPeriod: Registry,
  faction: RegistryFaction,
  sessions: SessionInput[],
): HistoryDataPoint[] {
  return changesOnly(
    sessions.map(({ session }) => ({
      date: session.date,
      value: getPersonsOfSessionAndFaction(parliamentPeriod, session, faction)
        .length,
    })),
  );
}

export function calcSeatsHistoryOfParty(
  parliamentPeriod: Registry,
  party: RegistryParty,
  sessions: SessionInput[],
): HistoryDataPoint[] {
  return changesOnly(
    sessions.map(({ session }) => ({
      date: session.date,
      value: getPersonsOfSessionAndParty(parliamentPeriod, session, party)
        .length,
    })),
  );
}

function changesOnly(points: HistoryDataPoint[]): HistoryDataPoint[] {
  return points
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .filter(
      (point, index, all) =>
        index === 0 || point.value !== all[index - 1].value,
    );
}
