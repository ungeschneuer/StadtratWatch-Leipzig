import type { RegistryPerson } from './registry.ts';
import { compareNamesForSorting } from './person-name.ts';

type Period = { start: string; end: string | null };

function covers(period: Period, date: string): boolean {
  return period.start <= date && (period.end === null || period.end >= date);
}

// The faction a person belonged to on a day. Analyses count votes for the faction of the session day, so a member who
// changed faction is not credited to the later faction for earlier votes.
export function factionIdOn(person: RegistryPerson, date: string): string {
  return (
    person.factionMemberships?.find((membership) => covers(membership, date))
      ?.factionId ?? person.factionId
  );
}

export function partyIdOn(person: RegistryPerson, date: string): string {
  return (
    person.partyMemberships?.find((membership) => covers(membership, date))
      ?.partyId ?? person.partyId
  );
}

export type AffiliationPeriod = {
  id: string;
  start: string | null;
  end: string | null;
};

// Every faction of a person in order, for the person page and the members of a faction; one period without dates when
// the faction never changed.
export function factionHistory(person: RegistryPerson): AffiliationPeriod[] {
  return (
    person.factionMemberships?.map(({ factionId, start, end }) => ({
      id: factionId,
      start,
      end,
    })) ?? [{ id: person.factionId, start: person.start, end: person.end }]
  );
}

export function partyHistory(person: RegistryPerson): AffiliationPeriod[] {
  return (
    person.partyMemberships?.map(({ partyId, start, end }) => ({
      id: partyId,
      start,
      end,
    })) ?? [{ id: person.partyId, start: person.start, end: person.end }]
  );
}

export type AffiliationMember = {
  person: RegistryPerson;
  // The periods the person belonged to the faction or party.
  periods: AffiliationPeriod[];
  // Still a member today: the last of these periods is open.
  isCurrent: boolean;
  // Belonged to another faction or party in the period as well.
  changed: boolean;
};

// Everyone who belonged to a faction or party at some point of the period, current members first.
export function affiliationMembers(
  persons: RegistryPerson[],
  history: (person: RegistryPerson) => AffiliationPeriod[],
  id: string,
): AffiliationMember[] {
  return persons
    .flatMap((person) => {
      const all = history(person);
      const periods = all.filter((period) => period.id === id);
      if (periods.length === 0) return [];
      return [
        {
          person,
          periods,
          isCurrent: periods.at(-1)?.end === null,
          changed: all.some((period) => period.id !== id),
        },
      ];
    })
    .toSorted(
      (a, b) =>
        Number(b.isCurrent) - Number(a.isCurrent) ||
        compareNamesForSorting(a.person.name, b.person.name),
    );
}
