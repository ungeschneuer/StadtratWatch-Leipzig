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
  name?: string;
  result?: string;
  consultation?: string;
  meeting?: string;
  deleted?: boolean;
};

export type FetchText = (url: string) => Promise<string>;

// Leipzig's OParl embeds at most 131 agenda items in a meeting, and its filtered agendaItems list times out. The public
// ALLRIS agenda page that the meeting links as `web` lists every item by the same id, so it serves as the index of the
// missing items, which are then read from OParl one by one.
export async function fetchMeetingAgenda(
  fetchJson: FetchJson,
  fetchText: FetchText,
  meetingId: string,
): Promise<AgendaItem[]> {
  const meeting = (await fetchJson(meetingId)) as { agendaItem?: OparlAgendaItem[]; web?: string };
  const embedded = meeting.agendaItem ?? [];
  const missing: OparlAgendaItem[] = [];
  if (meeting.web) {
    const embeddedIds = new Set(embedded.map((item) => agendaItemNumericId(item.id)));
    const listedIds = listAgendaItemIdsOfAgendaPage(await fetchText(meeting.web));
    for (const id of listedIds.filter((candidate) => !embeddedIds.has(candidate))) {
      const item = (await fetchJson(`${OPARL_AGENDA_ITEMS_URL}/${id}`)) as OparlAgendaItem;
      // ALLRIS still links items that OParl has deleted since; those are left out without a warning.
      if (item.deleted) continue;
      if (item.meeting === meetingId && item.number) missing.push(item);
      else console.warn(`${meetingId}: agenda item ${id} from the agenda page is not usable (meeting ${item.meeting})`);
    }
  }
  return [...embedded, ...missing]
    .filter((item) => item.number)
    .map((item) => ({
      agendaItemId: item.id,
      number: item.number as string,
      name: item.name ?? '',
      result: item.result ?? null,
      consultationUrl: item.consultation ?? null,
    }));
}

const OPARL_AGENDA_ITEMS_URL = 'https://www.leipzig.sitzung-online.de/oparl/agendaItems';

export function listAgendaItemIdsOfAgendaPage(html: string): string[] {
  return [...new Set([...html.matchAll(/TOLFDNR=(\d+)/g)].map((match) => match[1]))];
}

function agendaItemNumericId(agendaItemUrl: string): string {
  return agendaItemUrl.slice(agendaItemUrl.lastIndexOf('/') + 1);
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
