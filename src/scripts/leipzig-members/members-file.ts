import {
  FACTIONLESS_ID,
  factionOn,
  type LeipzigFaction,
  type LeipzigMembersFile,
  type LeipzigMembersSource,
  type LeipzigParty,
  type LeipzigPartySource,
  type LeipzigPerson,
  MAYOR_FACTION_ID,
} from '@srw-astro/models/leipzig-members';
import { partyIdOn } from '@srw-astro/models/person-affiliation';

import { addDays, type CouncilMember, type OparlOrganization } from './council-members.ts';
import { type Candidate, matchCandidate } from './election-candidates.ts';
import type { MemberOverride } from './member-overrides.ts';

export type MembersInputs = {
  parliamentPeriodId: string;
  periodStart: string;
  // Seats are counted on this day.
  today: string;
  generatedAt: string;
  members: CouncilMember[];
  organizations: OparlOrganization[];
  candidates: Candidate[];
  overrides: MemberOverride[];
  sources: LeipzigMembersSource[];
  // Session days on which each OParl person was read from the voting board.
  boardSessionDays: Map<string, string[]>;
};

// OParl starts a successor's membership on the day after the session that swore them in, where they already vote.
const SWEARING_IN_GRACE_DAYS = 7;

// 70 councillors and the mayor.
export const COUNCIL_SEATS = 71;

// The candidates list writes „GRÜNE“; the registry names parties as the parties do.
const PARTY_DISPLAY_NAMES: Record<string, string> = { GRÜNE: 'Bündnis 90/Die Grünen' };

export function buildMembersFile(inputs: MembersInputs): { file: LeipzigMembersFile; problems: string[] } {
  const problems: string[] = [];
  const overridesByPerson = new Map<string, MemberOverride[]>();
  for (const override of inputs.overrides) {
    if (!inputs.members.some((member) => member.person.id === override.personOparlId)) {
      problems.push(`override for ${override.personOparlId}: no council member of the period has this OParl ID`);
    }
    overridesByPerson.set(override.personOparlId, [...(overridesByPerson.get(override.personOparlId) ?? []), override]);
  }
  // Name corrections and exclusion: the last override wins. Party changes are collected, one period each.
  const overrideOf = (member: CouncilMember) =>
    Object.assign(
      {},
      ...(overridesByPerson.get(member.person.id) ?? []).filter((override) => override.since === undefined),
    );
  const partyChangesOf = (member: CouncilMember) =>
    (overridesByPerson.get(member.person.id) ?? [])
      .filter((override) => override.since !== undefined && override.party !== undefined)
      .toSorted((a, b) => (a.since ?? '').localeCompare(b.since ?? ''));

  const organizationsById = new Map(inputs.organizations.map((organization) => [organization.id, organization]));
  const factions = new Map<string, LeipzigFaction>();
  const parties = new Map<string, LeipzigParty>();
  const usedIds = new Set<string>();

  const persons: LeipzigPerson[] = [];
  for (const member of inputs.members) {
    const override: Partial<MemberOverride> = overrideOf(member);
    if (override.exclude) continue;

    const givenName = override.givenName ?? member.person.givenName ?? '';
    const familyName = override.familyName ?? member.person.familyName ?? member.person.name;
    const name = override.name ?? displayName(member, givenName, familyName);

    const party = partyOf(override, givenName, familyName, inputs.candidates);
    if ('problem' in party) {
      problems.push(`${name}: ${party.problem}`);
      continue;
    }

    const start = startSeenOnBoard(member, inputs.boardSessionDays.get(member.person.id) ?? [], name, problems);
    const partyMemberships = partyPeriods(party, partyChangesOf(member), start, member.end, name, problems);
    for (const membership of partyMemberships) parties.set(membership.record.id, membership.record);
    const latestParty = partyMemberships.at(-1) ?? partyMemberships[0];
    const factionMemberships = member.factionPeriods.map((period, index) => {
      const faction = factionRecordOf(period.organizationId, member.isMayor, organizationsById);
      factions.set(faction.id, faction);
      return { factionId: faction.id, start: index === 0 ? start : period.start, end: period.end };
    });

    const id = uniqueId(slug(`${givenName} ${familyName}`), usedIds, problems, name);
    persons.push({
      id,
      name,
      factionId: factionMemberships.at(-1)?.factionId ?? FACTIONLESS_ID,
      partyId: latestParty.record.id,
      start: start <= inputs.periodStart ? null : start,
      end: member.end,
      oparlId: member.person.id,
      familyName,
      givenName,
      factionMemberships,
      partyMemberships: partyMemberships.map(({ record, start: from, end, source }) => ({
        partyId: record.id,
        start: from,
        end,
        source,
      })),
      partySource: latestParty.source,
    });
  }

  const sitting = persons.filter((person) => isSitting(person, inputs.today));
  if (sitting.length !== COUNCIL_SEATS) {
    problems.push(`${sitting.length} members sit in the council on ${inputs.today}, expected ${COUNCIL_SEATS}`);
  }
  for (const person of sitting) {
    if (factionOn(person, inputs.today) === null) problems.push(`${person.name}: no faction on ${inputs.today}`);
  }
  const seatsOf = (matches: (person: LeipzigPerson) => boolean) => sitting.filter(matches).length;

  return {
    file: {
      parliamentPeriodId: inputs.parliamentPeriodId,
      generatedAt: inputs.generatedAt,
      sources: inputs.sources,
      factions: [...factions.values()]
        .map((faction) => ({ ...faction, seats: seatsOf((person) => factionOn(person, inputs.today) === faction.id) }))
        .sort(bySeatsThenName),
      parties: [...parties.values()]
        .map((party) => ({ ...party, seats: seatsOf((person) => partyIdOn(person, inputs.today) === party.id) }))
        .sort(bySeatsThenName),
      persons,
    },
    problems,
  };
}

// The board shows who actually sat in a session. A first vote shortly before the OParl start moves the start to that
// session; a vote outside the membership otherwise means OParl or the board reading is wrong.
function startSeenOnBoard(member: CouncilMember, sessionDays: string[], name: string, problems: string[]): string {
  const sorted = [...sessionDays].sort();
  const first = sorted[0];
  const start =
    first !== undefined && first < member.start && addDays(first, SWEARING_IN_GRACE_DAYS) >= member.start
      ? first
      : member.start;
  for (const day of sorted.filter(
    (candidate) => candidate < start || (member.end !== null && candidate > member.end),
  )) {
    problems.push(
      `${name}: on the voting board on ${day}, outside the council membership ${start} to ${member.end ?? 'open'}`,
    );
  }
  return start;
}

function isSitting(person: LeipzigPerson, date: string): boolean {
  return (person.start === null || person.start <= date) && (person.end === null || person.end >= date);
}

// Academic titles belong to the name („Dr. med. Nicole Schreyer-Krieg“); an office („Oberbürgermeister“) does not.
function displayName(member: CouncilMember, givenName: string, familyName: string): string {
  if (!givenName) return member.person.name;
  const academic = (member.person.title ?? []).filter((title) => /\b(?:Dr|Prof)\b/.test(title));
  return [...academic, givenName, familyName].join(' ');
}

type PartyChoice = { shortName: string; listName: string; source: LeipzigPartySource } | { problem: string };

function partyOf(
  override: Partial<MemberOverride>,
  givenName: string,
  familyName: string,
  candidates: Candidate[],
): PartyChoice {
  if (override.party) {
    return {
      shortName: override.party,
      listName: override.party,
      source: { method: 'override', reason: override.reason ?? '', source: override.source ?? '' },
    };
  }
  const found = matchCandidate({ givenName, familyName }, candidates);
  if (!found.candidate) {
    return {
      problem: `no party: ${found.reason} in the candidates list; add an override with party, reason and source`,
    };
  }
  const { listShortName, listName } = found.candidate;
  return {
    shortName: listShortName || listName,
    listName,
    source: { method: 'election-list', match: found.match, listName },
  };
}

type PartyPeriod = { record: LeipzigParty; start: string; end: string | null; source: LeipzigPartySource };

// The party of the list (or of an override without date) from the start; each dated change ends the period before it.
function partyPeriods(
  initial: Extract<PartyChoice, { shortName: string }>,
  changes: Partial<MemberOverride>[],
  start: string,
  end: string | null,
  name: string,
  problems: string[],
): PartyPeriod[] {
  const periods: PartyPeriod[] = [
    { record: partyRecordOf(initial.shortName, initial.listName), start, end, source: initial.source },
  ];
  for (const change of changes) {
    const since = change.since ?? start;
    const previous = periods.at(-1) as PartyPeriod;
    if (since <= previous.start || (end !== null && since > end)) {
      problems.push(`${name}: party change on ${since} lies outside the membership or before the previous change`);
      continue;
    }
    previous.end = addDays(since, -1);
    periods.push({
      record: partyRecordOf(change.party ?? '', change.party ?? ''),
      start: since,
      end,
      source: { method: 'override', reason: change.reason ?? '', source: change.source ?? '' },
    });
  }
  return periods;
}

function partyRecordOf(shortName: string, listName: string): LeipzigParty {
  const name = PARTY_DISPLAY_NAMES[shortName] ?? (shortName || listName);
  return { id: slug(name), name, seats: 0 };
}

function factionRecordOf(
  organizationId: string | null,
  isMayor: boolean,
  organizationsById: Map<string, OparlOrganization>,
): LeipzigFaction {
  if (organizationId === null) {
    return isMayor
      ? { id: MAYOR_FACTION_ID, name: 'Oberbürgermeister', seats: 0, oparlId: null, oparlName: null }
      : { id: FACTIONLESS_ID, name: 'fraktionslos', seats: 0, oparlId: null, oparlName: null };
  }
  const oparlName = organizationsById.get(organizationId)?.name ?? organizationId;
  const name = shortFactionName(oparlName);
  return { id: slug(name), name, seats: 0, oparlId: organizationId, oparlName };
}

// OParl names factions „Fraktion DIE LINKE“ or „CDU-Fraktion“; the name of the group is what the site shows.
export function shortFactionName(oparlName: string): string {
  return oparlName.replace(/^Fraktion\s+/, '').replace(/-Fraktion$/, '');
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFKD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

function uniqueId(base: string, used: Set<string>, problems: string[], name: string): string {
  let id = base;
  for (let suffix = 2; used.has(id); suffix++) id = `${base}-${suffix}`;
  if (id !== base) problems.push(`${name}: ID ${base} is taken, using ${id}`);
  used.add(id);
  return id;
}

function bySeatsThenName(a: { seats: number; name: string }, b: { seats: number; name: string }): number {
  return b.seats - a.seats || a.name.localeCompare(b.name, 'de');
}

// Long format, one row per person, and one per faction membership, for spreadsheets and data analysis. Persons and
// factions are keyed by their OParl ID, which stays when a name is corrected; the slug is the address of the person's
// page on the site.
export function personsToCsv(file: LeipzigMembersFile): string {
  const factionKey = factionKeyOf(file.factions);
  return toCsv(
    ['personId', 'slug', 'name', 'familyName', 'givenName', 'start', 'end', 'factionId', 'partyId', 'partySource'],
    file.persons.map((person) => [
      person.oparlId,
      person.id,
      person.name,
      person.familyName,
      person.givenName,
      person.start ?? '',
      person.end ?? '',
      factionKey(person.factionId),
      person.partyId,
      person.partySource.method === 'election-list' ? `election-list:${person.partySource.match}` : 'override',
    ]),
  );
}

export function factionMembershipsToCsv(file: LeipzigMembersFile): string {
  const factionKey = factionKeyOf(file.factions);
  return toCsv(
    ['personId', 'factionId', 'start', 'end'],
    file.persons.flatMap((person) =>
      person.factionMemberships.map((membership) => [
        person.oparlId,
        factionKey(membership.factionId),
        membership.start,
        membership.end ?? '',
      ]),
    ),
  );
}

// The pseudo-factions of members without faction and of the mayor have no OParl ID; their code is stable as it is.
export function factionKeyOf(factions: { id: string; oparlId?: string | null }[]): (factionId: string) => string {
  const oparlIds = new Map(factions.map((faction) => [faction.id, faction.oparlId]));
  return (factionId) => oparlIds.get(factionId) || factionId;
}

function toCsv(header: string[], rows: string[][]): string {
  const field = (value: string) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
  return [header, ...rows].map((row) => row.map(field).join(',')).join('\n') + '\n';
}
