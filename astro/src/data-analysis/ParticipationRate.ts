import type { SessionInput } from '@models/SessionInput.ts';
import type {
  Registry,
  RegistryFaction,
  RegistryParty,
  RegistryPerson,
} from '@models/registry.ts';
import { isPossibleVoter, type SessionScanItem } from '@models/session-scan.ts';
import {
  getPersonsOfSessionAndFaction,
  getPersonsOfSessionAndParty,
  isPersonInSession,
} from '@utils/session-utils.ts';

export type HistoryDataPoint = {
  date: string;
  value: number;
};

export function calcParticipationRateOfFaction(
  parliamentPeriod: Registry,
  faction: RegistryFaction,
  sessions: SessionInput[],
): number | null {
  const participationRates = sessions
    .flatMap((session) => {
      const persons = getPersonsOfSessionAndFaction(
        parliamentPeriod,
        session.session,
        faction,
      ).map((person) => person.name);
      return session.votings.map((voting) =>
        calcParticipationRate(persons, voting),
      );
    })
    .filter((rate) => rate !== null)
    .map((rate) => rate!);

  return participationRates.length === 0
    ? null
    : participationRates.reduce((a, b) => a + b, 0) / participationRates.length;
}

export function calcParticipationRateHistoryOfFaction(
  parliamentPeriod: Registry,
  faction: RegistryFaction,
  sessions: SessionInput[],
): HistoryDataPoint[] {
  return sessions
    .map((session) => {
      const pastSessions = sessions.filter(
        (s) => s.session.date <= session.session.date,
      );
      const value = calcParticipationRateOfFaction(
        parliamentPeriod,
        faction,
        pastSessions,
      );
      return { date: session.session.date, value };
    })
    .filter((obj): obj is HistoryDataPoint => obj.value !== null)
    .toSorted((a, b) => a.date.localeCompare(b.date));
}

export function calcParticipationRateOfParty(
  parliamentPeriod: Registry,
  party: RegistryParty,
  sessions: SessionInput[],
): number | null {
  const participationRates = sessions
    .flatMap((session) => {
      const persons = getPersonsOfSessionAndParty(
        parliamentPeriod,
        session.session,
        party,
      ).map((person) => person.name);
      return session.votings.map((voting) =>
        calcParticipationRate(persons, voting),
      );
    })
    .filter((rate) => rate !== null)
    .map((rate) => rate!);

  return participationRates.length === 0
    ? null
    : participationRates.reduce((a, b) => a + b, 0) / participationRates.length;
}

export function calcParticipationRateHistoryOfParty(
  parliamentPeriod: Registry,
  party: RegistryParty,
  sessions: SessionInput[],
): HistoryDataPoint[] {
  return sessions
    .map((session) => {
      const pastSessions = sessions.filter(
        (s) => s.session.date <= session.session.date,
      );
      const value = calcParticipationRateOfParty(
        parliamentPeriod,
        party,
        pastSessions,
      );
      return { date: session.session.date, value };
    })
    .filter((obj): obj is HistoryDataPoint => obj.value !== null)
    .toSorted((a, b) => a.date.localeCompare(b.date));
}

export function calcParticipationRateOfPerson(
  person: RegistryPerson,
  sessions: SessionInput[],
): number | null {
  const participationRates = sessions
    .filter((session) => isPersonInSession(person, session.session))
    .flatMap((session) => session.votings)
    .map((voting) => calcParticipationRate([person.name], voting))
    .filter((rate) => rate !== null)
    .map((rate) => rate!);

  return participationRates.length === 0
    ? null
    : participationRates.reduce((a, b) => a + b, 0) / participationRates.length;
}

export function calcParticipationRateHistoryOfPerson(
  person: RegistryPerson,
  sessions: SessionInput[],
): HistoryDataPoint[] {
  return sessions
    .map((session) => {
      const pastSessions = sessions.filter(
        (s) => s.session.date <= session.session.date,
      );
      const value = calcParticipationRateOfPerson(person, pastSessions);
      return { date: session.session.date, value };
    })
    .filter((obj): obj is HistoryDataPoint => obj.value !== null)
    .toSorted((a, b) => a.date.localeCompare(b.date));
}

// A member who may have cast one of the votes counted by hand without a name is left out of that vote: the board
// shows no vote for them, but that does not show they did not vote.
function calcParticipationRate(
  persons: string[],
  voting: SessionScanItem,
): number | null {
  const counted = persons.filter((name) => !isPossibleVoter(voting, name));
  const votes = voting.votes
    .filter((vote) => counted.includes(vote.name))
    .filter((vote) => vote.vote !== 'O');
  return counted.length === 0 ? null : votes.length / counted.length;
}
