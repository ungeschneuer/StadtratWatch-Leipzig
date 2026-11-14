import type {
  RegistryBodyMembership,
  RegistryFaction,
  RegistryFactionMembership,
  RegistryParty,
  RegistryPartyMembership,
  RegistryPerson,
} from './registry.ts';

// The members of the Leipzig council in one parliament period, in the shape of the StadtratWatch registry and with what
// the registry cannot hold: the OParl IDs, the faction history and where each party comes from. The registry keeps one
// faction per person, the latest; `factionMemberships` says which faction a person belonged to on a given day.

export type LeipzigMembersFile = {
  parliamentPeriodId: string;
  generatedAt: string;
  sources: LeipzigMembersSource[];
  factions: LeipzigFaction[];
  parties: LeipzigParty[];
  persons: LeipzigPerson[];
};

export type LeipzigMembersSource = {
  name: string;
  url: string;
  license: string;
};

// seats: members of the faction on the day the file was generated.
export type LeipzigFaction = RegistryFaction & {
  oparlId: string | null;
  oparlName: string | null;
};

export type LeipzigParty = RegistryParty;

export const FACTIONLESS_ID = 'fraktionslos';
export const MAYOR_FACTION_ID = 'oberbuergermeister';

// The candidates list says on which list someone stood in 2024, not whether they are a party member. A member who
// stood on no list, or whose party is known otherwise, has an override with its reason and source.
export type LeipzigPartySource =
  | { method: 'election-list'; match: 'name' | 'former-name'; listName: string }
  | { method: 'override'; reason: string; source: string };

export type LeipzigFactionMembership = RegistryFactionMembership;

export type LeipzigBodyMembership = RegistryBodyMembership & {
  oparlId: string;
};

// The party from the election list holds from the start of the membership; a documented change starts a new period.
export type LeipzigPartyMembership = RegistryPartyMembership & {
  source: LeipzigPartySource;
};

// start and end: membership in the council within the period; null at the beginning of the period or while it lasts.
export type LeipzigPerson = RegistryPerson & {
  oparlId: string;
  familyName: string;
  givenName: string;
  factionMemberships: LeipzigFactionMembership[];
  partyMemberships: LeipzigPartyMembership[];
  // Where the latest party comes from.
  partySource: LeipzigPartySource;
  // Missing in files written before 14.11.2026 and for members without any.
  bodies?: LeipzigBodyMembership[];
};

export function factionOn(person: LeipzigPerson, date: string): string | null {
  return (
    person.factionMemberships.find(
      (membership) =>
        membership.start <= date &&
        (membership.end === null || membership.end >= date),
    )?.factionId ?? null
  );
}
