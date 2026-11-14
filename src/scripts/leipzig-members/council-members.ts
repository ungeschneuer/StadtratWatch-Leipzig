import { compareNamesForSorting } from '@srw-astro/models/person-name';

export type OparlMembership = {
  id: string;
  person: string;
  organization: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  deleted?: boolean;
};

export type OparlPerson = {
  id: string;
  name: string;
  familyName?: string;
  givenName?: string;
  title?: string[];
  deleted?: boolean;
};

export type OparlOrganization = {
  id: string;
  name?: string;
  classification?: string;
  deleted?: boolean;
};

// organizationId null: no faction (fraktionslos), or the mayor, who belongs to none.
export type FactionPeriod = { organizationId: string | null; start: string; end: string | null };

// A committee, supervisory board or other body of the council the member sat in during the period.
export type BodyMembership = { organizationId: string; role: string | null; start: string; end: string | null };

export type CouncilMember = {
  person: OparlPerson;
  isMayor: boolean;
  start: string;
  end: string | null;
  factionPeriods: FactionPeriod[];
  bodyMemberships: BodyMembership[];
};

export type CouncilMembersResult = { members: CouncilMember[]; problems: string[] };

const MAYOR_ROLE = /Oberbürgermeister/i;

export function deriveCouncilMembers(
  oparl: { memberships: OparlMembership[]; persons: OparlPerson[]; organizations: OparlOrganization[] },
  councilOrganizationId: string,
  periodStart: string,
): CouncilMembersResult {
  const problems: string[] = [];
  const personsById = new Map(oparl.persons.map((person) => [person.id, person]));
  const factionIds = new Set(
    oparl.organizations
      .filter((organization) => organization.classification === 'Fraktion' && !organization.deleted)
      .map((organization) => organization.id),
  );
  const active = oparl.memberships.filter(
    (membership) => !membership.deleted && (membership.endDate ?? '9999-12-31') >= periodStart,
  );

  const members: CouncilMember[] = [];
  for (const [personId, councilMemberships] of groupBy(
    active.filter((membership) => membership.organization === councilOrganizationId),
    (membership) => membership.person,
  )) {
    const person = personsById.get(personId);
    if (!person) {
      problems.push(`${personId}: council membership of a person OParl does not list`);
      continue;
    }
    const spans = mergeSpans(councilMemberships.map((membership) => clip(spanOf(membership), periodStart, null)));
    if (spans.length > 1) {
      problems.push(
        `${person.name}: ${spans.length} separate council memberships; the first start and last end are used`,
      );
    }
    const council = { start: spans[0].start, end: spans.at(-1)?.end ?? null };
    const isMayor = councilMemberships.some((membership) => MAYOR_ROLE.test(membership.role ?? ''));
    const factionSpans = groupBy(
      active.filter((membership) => membership.person === personId && factionIds.has(membership.organization)),
      (membership) => membership.organization,
    ).flatMap(([organizationId, memberships]) =>
      mergeSpans(memberships.map((membership) => clip(spanOf(membership), council.start, council.end)))
        .filter((span) => span.end === null || span.start <= span.end)
        .map((span) => ({ organizationId, ...span })),
    );
    for (const overlap of overlappingPairs(factionSpans)) {
      problems.push(`${person.name}: faction memberships overlap (${overlap})`);
    }
    const bodyMemberships = active
      .filter(
        (membership) =>
          membership.person === personId &&
          membership.organization !== councilOrganizationId &&
          !factionIds.has(membership.organization),
      )
      .map((membership) => ({
        organizationId: membership.organization,
        role: membership.role ?? null,
        ...clip(spanOf(membership), council.start, council.end),
      }))
      .filter((span) => span.end === null || span.start <= span.end)
      .sort((a, b) => a.start.localeCompare(b.start) || a.organizationId.localeCompare(b.organizationId));
    members.push({
      person,
      isMayor,
      ...council,
      factionPeriods: withGapsFilled(factionSpans, council),
      bodyMemberships,
    });
  }
  return { members: members.sort((a, b) => compareNamesForSorting(a.person.name, b.person.name)), problems };
}

type Span = { start: string; end: string | null };

function spanOf(membership: OparlMembership): Span {
  return { start: membership.startDate ?? '0000-01-01', end: membership.endDate ?? null };
}

function clip(span: Span, start: string, end: string | null): Span {
  return {
    start: span.start < start ? start : span.start,
    end: end !== null && (span.end === null || span.end > end) ? end : span.end,
  };
}

// A new role in the same organization (a faction's chair) starts a new membership the day after the old one ends.
export function mergeSpans(spans: Span[]): Span[] {
  const merged: Span[] = [];
  for (const span of [...spans].sort((a, b) => a.start.localeCompare(b.start))) {
    const last = merged.at(-1);
    if (last && (last.end === null || addDays(last.end, 1) >= span.start)) {
      last.end = last.end === null || span.end === null ? null : last.end > span.end ? last.end : span.end;
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

function withGapsFilled(spans: (Span & { organizationId: string })[], council: Span): FactionPeriod[] {
  const periods: FactionPeriod[] = [];
  let cursor: string | null = council.start;
  for (const span of [...spans].sort((a, b) => a.start.localeCompare(b.start))) {
    if (cursor === null) break;
    if (span.start > cursor) periods.push({ organizationId: null, start: cursor, end: addDays(span.start, -1) });
    periods.push({ organizationId: span.organizationId, start: span.start, end: span.end });
    cursor = span.end === null ? null : addDays(span.end, 1);
  }
  if (cursor !== null && (council.end === null || cursor <= council.end)) {
    periods.push({ organizationId: null, start: cursor, end: council.end });
  }
  return periods;
}

function overlappingPairs(spans: (Span & { organizationId: string })[]): string[] {
  const sorted = [...spans].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.slice(1).flatMap((span, index) => {
    const previous = sorted[index];
    return previous.end === null || previous.end >= span.start
      ? [`${previous.organizationId} until ${previous.end ?? 'open'}, ${span.organizationId} from ${span.start}`]
      : [];
  });
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return [...groups];
}
