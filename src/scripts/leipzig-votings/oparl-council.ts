import { followOparlPages } from '../leipzig-recordings/oparl-pages.ts';
import type { RosterPerson } from './roster.ts';

export const LEIPZIG_OPARL_BODY_URL = 'https://www.leipzig.sitzung-online.de/oparl/bodies/2387';
export const COUNCIL_ORGANIZATION_ID = 'https://www.leipzig.sitzung-online.de/oparl/organizations/gr/2387';

export type FetchJson = (url: string) => Promise<unknown>;

export type AgendaItem = {
  agendaItemId: string;
  number: string;
  name: string;
  result: string | null;
  consultationUrl: string | null;
};

type OparlMembership = {
  person: string;
  organization: string;
  startDate?: string;
  endDate?: string;
  deleted?: boolean;
};
type OparlPerson = { id: string; name: string; familyName?: string; givenName?: string };

export async function fetchCouncilRoster(fetchJson: FetchJson): Promise<CouncilRoster> {
  const [memberships, persons] = await Promise.all([
    fetchAll<OparlMembership>(fetchJson, `${LEIPZIG_OPARL_BODY_URL}/memberships?size=100`),
    fetchAll<OparlPerson>(fetchJson, `${LEIPZIG_OPARL_BODY_URL}/persons?size=100`),
  ]);
  const personsById = new Map(persons.map((person) => [person.id, person]));
  const councilMemberships = memberships.filter(
    (membership) => membership.organization === COUNCIL_ORGANIZATION_ID && !membership.deleted,
  );
  const toRosterPerson = (person: OparlPerson): RosterPerson => ({
    personId: person.id,
    name: person.name,
    familyName: person.familyName ?? person.name.split(' ').at(-1) ?? '',
    givenName: person.givenName ?? '',
  });
  const personsOf = (selected: OparlMembership[]) =>
    selected
      .map((membership) => personsById.get(membership.person))
      .filter((person): person is OparlPerson => person !== undefined)
      .map(toRosterPerson);
  const membersOn = (date: string) =>
    personsOf(
      councilMemberships.filter(
        (membership) => (membership.startDate ?? '') <= date && (!membership.endDate || membership.endDate >= date),
      ),
    );
  return {
    membersOn,
    sessionRoster(date: string): RosterPerson[] {
      const latestStart = addDays(date, SWEARING_IN_GRACE_DAYS);
      const joining = personsOf(
        councilMemberships.filter(
          (membership) =>
            membership.startDate !== undefined && membership.startDate > date && membership.startDate <= latestStart,
        ),
      );
      return [...membersOn(date), ...joining.map((person) => ({ ...person, joinsAfterSessionDay: true }))];
    },
  };
}

const SWEARING_IN_GRACE_DAYS = 7;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// sessionRoster: the members of the day plus successors whose OParl membership starts within a week after it.
export type CouncilRoster = { membersOn(date: string): RosterPerson[]; sessionRoster(date: string): RosterPerson[] };

type OparlAgendaItem = {
  id: string;
  number?: string;
  order?: number;
  name?: string;
  result?: string;
  consultation?: string;
  meeting?: string;
  deleted?: boolean;
};

type OparlAgendaItemListPage = { data: OparlAgendaItem[]; pagination?: { totalPages?: number } };

// Leipzig's OParl embeds at most 131 agenda items in a meeting. The body's agendaItems list holds all of them; it cannot
// be filtered by meeting, only by modification time, and an item is modified no earlier than it is created, which is
// when the agenda is drawn up a few weeks before the session.
const OPARL_EMBEDDED_AGENDA_ITEM_LIMIT = 131;
const AGENDA_DRAWN_UP_DAYS_BEFORE_SESSION = 45;
const OPARL_BODY_AGENDA_ITEMS_URL = `${LEIPZIG_OPARL_BODY_URL}/agendaItems`;
const MAXIMUM_AGENDA_ITEM_LIST_PAGES = 200;

export async function fetchMeetingAgenda(
  fetchJson: FetchJson,
  meetingId: string,
  now: Date = new Date(),
): Promise<AgendaItem[]> {
  const meeting = (await fetchJson(meetingId)) as { agendaItem?: OparlAgendaItem[]; start?: string };
  const embedded = meeting.agendaItem ?? [];
  const listed =
    embedded.length < OPARL_EMBEDDED_AGENDA_ITEM_LIMIT
      ? []
      : (await fetchAgendaItemsModifiedBetween(fetchJson, agendaDrawnUpBefore(meeting.start, now), now)).filter(
          (item) => item.meeting === meetingId && !item.deleted,
        );
  const embeddedIds = new Set(embedded.map((item) => item.id));
  const items = [...embedded, ...listed.filter((item) => !embeddedIds.has(item.id))].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  warnAboutOrderGaps(meetingId, items);
  return toAgendaItems(items);
}

// An item added to an agenda is modified no earlier than it is added, so the items of these meetings modified since a
// moment include every item added since.
export async function fetchMeetingsAgendaItemsModifiedSince(
  fetchJson: FetchJson,
  meetingIds: string[],
  since: Date,
  now: Date = new Date(),
): Promise<AgendaItem[]> {
  const modified = await fetchAgendaItemsModifiedBetween(fetchJson, since, now);
  return toAgendaItems(modified.filter((item) => item.meeting && meetingIds.includes(item.meeting) && !item.deleted));
}

function toAgendaItems(items: OparlAgendaItem[]): AgendaItem[] {
  return items
    .filter((item) => item.number)
    .map((item) => ({
      agendaItemId: item.id,
      number: item.number as string,
      name: item.name ?? '',
      result: item.result ?? null,
      consultationUrl: item.consultation ?? null,
    }));
}

function agendaDrawnUpBefore(meetingStart: string | undefined, now: Date): Date {
  const sessionTime = meetingStart ? Date.parse(meetingStart) : now.getTime();
  return new Date(sessionTime - AGENDA_DRAWN_UP_DAYS_BEFORE_SESSION * 24 * 60 * 60 * 1000);
}

// The list's `next` links lose the filter, so the pages are asked for by number. The upper bound keeps items modified
// while the pages are read from shifting the list under the reader.
async function fetchAgendaItemsModifiedBetween(fetchJson: FetchJson, since: Date, until: Date) {
  const filter = `modified_since=${encodeURIComponent(oparlDateTime(since))}&modified_until=${encodeURIComponent(oparlDateTime(until))}`;
  const items: OparlAgendaItem[] = [];
  for (let page = 1, totalPages = 1; page <= totalPages; page++) {
    if (page > MAXIMUM_AGENDA_ITEM_LIST_PAGES) {
      throw new Error(`OParl agenda item list has more than ${MAXIMUM_AGENDA_ITEM_LIST_PAGES} pages`);
    }
    const listPage = (await fetchJson(
      `${OPARL_BODY_AGENDA_ITEMS_URL}?${filter}&size=100&page=${page}`,
    )) as OparlAgendaItemListPage;
    items.push(...listPage.data);
    totalPages = listPage.pagination?.totalPages ?? page;
  }
  return items;
}

function oparlDateTime(time: Date): string {
  return time.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

// OParl numbers the public items from 100001 and the non-public ones from 200001 without gaps; a gap means the agenda
// is incomplete, and votes on the missing items go to review.
function warnAboutOrderGaps(meetingId: string, items: OparlAgendaItem[]) {
  const ordersByBlock = Map.groupBy(
    items.map((item) => item.order).filter((order): order is number => order !== undefined),
    (order) => Math.floor(order / 100_000),
  );
  for (const [block, orders] of ordersByBlock) {
    const expected = orders.length;
    const highest = Math.max(...orders) - block * 100_000;
    if (highest !== expected) {
      console.warn(`${meetingId}: agenda incomplete, ${expected} of ${highest} items in block ${block}`);
    }
  }
}

export async function fetchPaperReference(fetchJson: FetchJson, consultationUrl: string): Promise<string | null> {
  const consultation = (await fetchJson(consultationUrl)) as { paper?: string };
  if (!consultation.paper) return null;
  const paper = (await fetchJson(consultation.paper)) as { reference?: string };
  return paper.reference ?? null;
}

async function fetchAll<T>(fetchJson: FetchJson, firstPageUrl: string): Promise<T[]> {
  const items: T[] = [];
  for await (const page of followOparlPages<T>(fetchJson, firstPageUrl)) items.push(...page.data);
  return items;
}
