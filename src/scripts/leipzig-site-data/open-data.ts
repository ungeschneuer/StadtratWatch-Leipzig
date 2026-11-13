import { factionIdOn, partyIdOn } from '@srw-astro/models/person-affiliation';
import type { Registry, RegistryPerson } from '@srw-astro/models/registry';
import type { SessionScanItem } from '@srw-astro/models/session-scan';
import { decidedByMayor, getVoteCounts, votingAccepted } from '@srw-astro/models/voting-breakdown';

import { factionKeyOf } from '../leipzig-members/members-file.ts';

// The bulk downloads hold exactly what the site and the API publish: the session scans and the registry. A vote that
// is not on the site (discarded, procedural with failed checks) is not in them either.
export type SessionScans = Map<string, SessionScanItem[]>;

type FieldType = 'string' | 'integer' | 'boolean' | 'date';
type Field = { name: string; type: FieldType; description: string };

const VOTING_FIELDS: Field[] = [
  { name: 'sessionId', type: 'date', description: 'Sitzungstag (YYYY-MM-DD)' },
  { name: 'votingId', type: 'string', description: 'Abstimmung, eindeutig: Sitzungstag und laufende Nummer' },
  { name: 'agendaItem', type: 'string', description: 'Nummer des Tagesordnungspunkts' },
  {
    name: 'oparlAgendaItemId',
    type: 'string',
    description: 'Tagesordnungspunkt in OParl; leer bei Unterpunkten wie Änderungsanträgen, die OParl nicht führt',
  },
  { name: 'paperReference', type: 'string', description: 'Drucksachennummer (VIII-DS-…, VIII-A-…, …-ÄA-…)' },
  { name: 'oparlPaperId', type: 'string', description: 'Drucksache in OParl' },
  {
    name: 'itemNumber',
    type: 'string',
    description: 'Punkt der Drucksache bei punktweiser Abstimmung („4“, „1 und 2“), sonst leer',
  },
  { name: 'title', type: 'string', description: 'Titel des Tagesordnungspunkts laut OParl' },
  { name: 'type', type: 'string', description: 'Art: Beschlussvorlage, Antrag, Änderungsantrag, Geschäftsordnung' },
  { name: 'paperUrl', type: 'string', description: 'Drucksache im Ratsinformationssystem' },
  { name: 'videoTimestamp', type: 'string', description: 'Zeit der Tafel in der Aufzeichnung (HH:MM:SS)' },
  { name: 'yes', type: 'integer', description: 'Ja-Stimmen' },
  { name: 'no', type: 'integer', description: 'Nein-Stimmen' },
  { name: 'abstentions', type: 'integer', description: 'Enthaltungen' },
  {
    name: 'notVoted',
    type: 'integer',
    description: 'Mitglieder ohne Stimme (anwesend ohne Stimmabgabe oder abwesend)',
  },
  { name: 'presentMembers', type: 'integer', description: 'Anwesende laut Tafel' },
  { name: 'majorityRequirement', type: 'string', description: 'Erforderliche Mehrheit, siehe DATA.md' },
  { name: 'result', type: 'string', description: 'accepted oder rejected, berechnet aus Stimmen und Mehrheit' },
  {
    name: 'reviewStatus',
    type: 'string',
    description: 'final, provisional (amtliches Ergebnis fehlt) oder needs-review',
  },
  {
    name: 'decidedByMayor',
    type: 'boolean',
    description: 'Ohne das Ja oder Nein des Oberbürgermeisters wäre das Ergebnis umgekehrt',
  },
  {
    name: 'recusedPersonIds',
    type: 'string',
    description: 'Wegen Befangenheit (§ 20 SächsGemO) nicht beteiligt: OParl-IDs, durch Leerzeichen getrennt',
  },
];

const VOTE_FIELDS: Field[] = [
  { name: 'sessionId', type: 'date', description: 'Sitzungstag (YYYY-MM-DD)' },
  { name: 'votingId', type: 'string', description: 'Abstimmung, verweist auf votings.csv' },
  { name: 'personId', type: 'string', description: 'Person: OParl-ID, verweist auf persons.csv' },
  { name: 'name', type: 'string', description: 'Name' },
  { name: 'vote', type: 'string', description: 'J (Ja), N (Nein), E (Enthaltung), O (keine Stimme)' },
  {
    name: 'factionId',
    type: 'string',
    description: 'Fraktion am Sitzungstag: OParl-ID, oder fraktionslos bzw. oberbuergermeister',
  },
  { name: 'partyId', type: 'string', description: 'Partei bzw. Wahlliste 2024 am Sitzungstag' },
];

const SESSION_FIELDS: Field[] = [
  { name: 'sessionId', type: 'date', description: 'Sitzungstag (YYYY-MM-DD)' },
  { name: 'oparlMeetingId', type: 'string', description: 'Sitzung in OParl' },
  { name: 'date', type: 'date', description: 'Datum' },
  { name: 'title', type: 'string', description: 'Gremium' },
  {
    name: 'approved',
    type: 'boolean',
    description: 'Alle Abstimmungen geprüft und mit amtlichem Ergebnis abgeglichen',
  },
  { name: 'publishedVotings', type: 'integer', description: 'Veröffentlichte Abstimmungen' },
  { name: 'videoUrl', type: 'string', description: 'Aufzeichnung in der Mediathek der Stadt' },
  { name: 'meetingMinutesUrl', type: 'string', description: 'Beschlussprotokoll' },
  { name: 'speechesSourceUrl', type: 'string', description: 'Verlaufsprotokoll, Quelle der Reden' },
];

// Written by leipzig-members (personsToCsv, factionMembershipsToCsv).
const PERSON_FIELDS: Field[] = [
  { name: 'personId', type: 'string', description: 'Person: OParl-ID' },
  {
    name: 'slug',
    type: 'string',
    description: 'Lesbarer Schlüssel der Seite (Adresse der Personenseite), ändert sich mit dem Namen',
  },
  { name: 'name', type: 'string', description: 'Name' },
  { name: 'familyName', type: 'string', description: 'Nachname' },
  { name: 'givenName', type: 'string', description: 'Vorname' },
  { name: 'start', type: 'date', description: 'Beginn der Mitgliedschaft in der Ratsversammlung' },
  { name: 'end', type: 'date', description: 'Ende der Mitgliedschaft' },
  {
    name: 'factionId',
    type: 'string',
    description: 'Fraktion heute: OParl-ID, oder fraktionslos bzw. oberbuergermeister',
  },
  { name: 'partyId', type: 'string', description: 'Partei bzw. Wahlliste 2024 heute' },
  { name: 'partySource', type: 'string', description: 'Herkunft der Partei: election-list:<Abgleich> oder override' },
];

const FACTION_MEMBERSHIP_FIELDS: Field[] = [
  { name: 'personId', type: 'string', description: 'Person: OParl-ID, verweist auf persons.csv' },
  {
    name: 'factionId',
    type: 'string',
    description: 'Fraktion: OParl-ID, oder fraktionslos bzw. oberbuergermeister',
  },
  { name: 'start', type: 'date', description: 'Beginn' },
  { name: 'end', type: 'date', description: 'Ende, leer = andauernd' },
];

export function votingsToCsv(registry: Registry, scans: SessionScans): string {
  const oparlIdByName = new Map(registry.persons.map((person) => [person.name, person.oparlId ?? '']));
  const rows = [...scans].flatMap(([sessionId, scan]) =>
    scan.map((voting) => {
      const { J, N, E } = getVoteCounts(voting);
      return [
        sessionId,
        votingIdOf(voting),
        voting.votingSubject.agendaItem,
        voting.votingSubject.oparlAgendaItemId ?? '',
        voting.votingSubject.motionId,
        voting.votingSubject.oparlPaperId ?? '',
        voting.votingSubject.itemNumber ?? '',
        voting.votingSubject.title,
        voting.votingSubject.type ?? '',
        voting.votingSubject.paperUrl ?? '',
        voting.videoTimestamp,
        String(J),
        String(N),
        String(E),
        String(voting.votes.filter((vote) => vote.vote === 'O').length),
        voting.presentMembers === undefined ? '' : String(voting.presentMembers),
        voting.majorityRequirement ?? 'simple',
        votingAccepted(registry, voting) ? 'accepted' : 'rejected',
        voting.reviewStatus ?? 'final',
        String(decidedByMayor(registry, voting, sessionId)),
        (voting.recusedPersons ?? []).map((name) => oparlIdByName.get(name) ?? '').join(' '),
      ];
    }),
  );
  return toCsv(VOTING_FIELDS, rows);
}

export function votesToCsv(registry: Registry, scans: SessionScans): string {
  const personsByName = new Map(registry.persons.map((person) => [person.name, person]));
  const rows = [...scans].flatMap(([sessionId, scan]) =>
    scan.flatMap((voting) =>
      voting.votes.map((vote) => {
        const person = personsByName.get(vote.name);
        return [
          sessionId,
          votingIdOf(voting),
          person?.oparlId ?? '',
          vote.name,
          vote.vote,
          ...affiliationOn(person, sessionId, factionKeyOf(registry.factions)),
        ];
      }),
    ),
  );
  return toCsv(VOTE_FIELDS, rows);
}

export function sessionsToCsv(registry: Registry, scans: SessionScans): string {
  const rows = registry.sessions.map((session) => [
    session.id,
    session.oparlMeetingId ?? '',
    session.date,
    session.title,
    String(session.approved),
    String(scans.get(session.id)?.length ?? 0),
    session.video?.url ?? session.youtubeUrl,
    session.meetingMinutesUrl ?? '',
    session.speechesSource?.url ?? '',
  ]);
  return toCsv(SESSION_FIELDS, rows);
}

// A Frictionless data package (https://datapackage.org). The votes read from the recordings are StadtratWatch's own
// work; names, titles, memberships and agenda items come from the city's OParl (CC BY 4.0) and the election list from
// its open data portal (dl-de/by-2-0), whose licences require naming the city.
export function dataPackage(registry: Registry, created: string) {
  return {
    name: `stadtratwatch-${registry.id}`,
    title: `StadtratWatch Leipzig: Abstimmungen der Ratsversammlung, ${registry.name}`,
    description:
      'Stimmen je Person, aus der Abstimmungstafel der Aufzeichnungen gelesen und mit den Protokollen der Stadt ' +
      'abgeglichen. Methodik, Codes und Grenzen: DATA.md im Repository.',
    homepage: 'https://ungeschneuer.github.io/StadtratWatch-Leipzig/',
    created,
    licenses: [
      {
        name: 'CC0-1.0',
        path: 'https://creativecommons.org/publicdomain/zero/1.0/',
        title: 'Stimmen, Ergebnisse und Zuordnungen von StadtratWatch Leipzig',
      },
      {
        name: 'CC-BY-4.0',
        path: 'https://creativecommons.org/licenses/by/4.0/',
        title: 'Angaben aus OParl (Personen, Mitgliedschaften, Tagesordnung, Drucksachen): Stadt Leipzig',
      },
      {
        name: 'dl-de-by-2.0',
        path: 'https://www.govdata.de/dl-de/by-2-0',
        title: 'Wahlliste 2024 (Partei): Stadt Leipzig, Open-Data-Portal',
      },
    ],
    sources: [
      {
        title: 'Stadt Leipzig, OParl-Schnittstelle des Ratsinformationssystems',
        path: 'https://www.leipzig.sitzung-online.de/oparl/system',
      },
      {
        title: 'Stadt Leipzig, Aufzeichnungen der Ratsversammlung (Mediathek)',
        path: 'https://www.leipzig.de/mediathek/video',
      },
      {
        title: 'Stadt Leipzig, Stadtratswahl 2024: Bewerberinnen und Bewerber (Open-Data-Portal)',
        path: 'https://opendata.leipzig.de/dataset/stadtratswahl-2024-bewerberinnen-und-bewerber',
      },
      {
        title: 'Stadt Leipzig, Ratsinformationssystem (Beschluss- und Verlaufsprotokolle)',
        path: 'https://ratsinformation.leipzig.de/allris_leipzig_public/',
      },
    ],
    resources: [
      csvResource('votings', 'votings.csv', 'Eine Zeile je veröffentlichter Abstimmung', VOTING_FIELDS, ['votingId']),
      csvResource(
        'votes',
        'votes.csv',
        'Eine Zeile je Person und Abstimmung',
        VOTE_FIELDS,
        ['votingId', 'personId'],
        [
          { fields: 'votingId', reference: { resource: 'votings', fields: 'votingId' } },
          { fields: 'personId', reference: { resource: 'persons', fields: 'personId' } },
        ],
      ),
      csvResource('sessions', 'sessions.csv', 'Eine Zeile je Sitzungstag mit Aufzeichnung', SESSION_FIELDS, [
        'sessionId',
      ]),
      csvResource('persons', 'persons.csv', 'Mitglieder der Ratsversammlung in der Wahlperiode', PERSON_FIELDS, [
        'personId',
      ]),
      csvResource(
        'faction-memberships',
        'faction-memberships.csv',
        'Fraktionszugehörigkeit mit Zeiträumen',
        FACTION_MEMBERSHIP_FIELDS,
        ['personId', 'factionId', 'start'],
        [{ fields: 'personId', reference: { resource: 'persons', fields: 'personId' } }],
      ),
    ],
  };
}

type ForeignKey = { fields: string; reference: { resource: string; fields: string } };

function csvResource(
  name: string,
  path: string,
  description: string,
  fields: Field[],
  primaryKey: string[],
  foreignKeys: ForeignKey[] = [],
) {
  return {
    name,
    path,
    description,
    format: 'csv',
    mediatype: 'text/csv',
    encoding: 'utf-8',
    schema: { fields, primaryKey, ...(foreignKeys.length > 0 ? { foreignKeys } : {}) },
  };
}

function votingIdOf(voting: SessionScanItem): string {
  return voting.votingFilename.replace(/\.png$/, '');
}

function affiliationOn(
  person: RegistryPerson | undefined,
  date: string,
  factionKey: (factionId: string) => string,
): [string, string] {
  return person ? [factionKey(factionIdOn(person, date)), partyIdOn(person, date)] : ['', ''];
}

function toCsv(fields: Field[], rows: string[][]): string {
  const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
  return [fields.map((field) => field.name), ...rows].map((row) => row.map(cell).join(',')).join('\n') + '\n';
}
