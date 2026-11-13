import { describe, expect, it } from 'bun:test';

import type { LeipzigMembersFile } from '@srw-astro/models/leipzig-members';

import type { PapersFile } from '../leipzig-papers/voting-papers.ts';
import type { ExtractedVoting } from '../leipzig-votings/extract-session.ts';
import { authorsOf, formatTimestamp, subjectType, toSessionScan } from './session-scan.ts';

const members = {
  persons: [
    { oparlId: 'p/stange', name: 'Enrico Stange' },
    { oparlId: 'p/nagel', name: 'Juliane Nagel' },
  ],
} as unknown as LeipzigMembersFile;

function voting(
  index: number,
  status: ExtractedVoting['status'],
  changes: Partial<ExtractedVoting> = {},
): ExtractedVoting {
  return {
    index,
    videoSeconds: { start: 3725.5, end: 3730, frames: [3727] },
    heading: {
      raw: '',
      agendaItemNumber: '19.10.2',
      paperReference: 'VIII-DS-02186-ÄA-02',
      title: 'Masterplan Grün (OCR)',
    },
    oparl: null,
    board: { presentMembers: 2, castVotes: 1, resultBars: { J: 1, N: 0, E: 0 } },
    tally: { J: 1, N: 0, E: 0, present: 1, absent: 0, unknown: 0 },
    announced: null,
    votes: [
      { column: 0, row: 0, boardName: 'Stange, Enrico', personId: 'p/stange', vote: 'J', attendance: 'present' },
      { column: 0, row: 1, boardName: 'Nagel, Juliane', personId: 'p/nagel', vote: 'O', attendance: 'present' },
    ],
    checks: [],
    checkStatus: status === 'reviewed' ? 'needs-review' : status,
    status,
    ...changes,
  };
}

describe('toSessionScan', () => {
  it('writes confirmed votes in the StadtratWatch form, named as in the registry', () => {
    const { scan, problems } = toSessionScan('2026-10-29', [voting(4, 'verified')], members);

    expect(problems).toEqual([]);
    expect(scan).toEqual([
      {
        votingFilename: '2026-10-29-005.png',
        videoTimestamp: '01:02:05',
        votingSubject: {
          agendaItem: '19.10.2',
          motionId: 'VIII-DS-02186-ÄA-02',
          title: 'Masterplan Grün (OCR)',
          type: 'Änderungsantrag',
          authors: [],
        },
        votes: [
          { name: 'Enrico Stange', vote: 'J' },
          { name: 'Juliane Nagel', vote: 'O' },
        ],
        presentMembers: 2,
      },
    ]);
  });

  it('names a qualified majority the vote needs, and leaves the simple majority unnamed', () => {
    const hauptsatzung = voting(7, 'verified', {
      heading: {
        raw: '',
        agendaItemNumber: '19.10',
        paperReference: 'VIII-DS-02011-NF-01-DS-01',
        title: '5. Satzung zur Änderung der Hauptsatzung der Stadt Leipzig',
      },
    });
    const { scan } = toSessionScan('2026-03-25', [hauptsatzung, voting(8, 'verified')], members);

    expect(scan[0].majorityRequirement).toBe('majority-of-members');
    expect(scan[1]).not.toHaveProperty('majorityRequirement');
  });

  it('publishes votes with an unfinished check under their review status, and leaves out the invalid ones', () => {
    const statuses: ExtractedVoting['status'][] = [
      'corrected',
      'reviewed',
      'provisional',
      'needs-review',
      'discarded',
      'skipped',
    ];
    const { scan, pending } = toSessionScan(
      '2026-10-29',
      statuses.map((status, index) => voting(index, status)),
      members,
    );

    expect(scan.map((item) => [item.votingFilename, item.reviewStatus])).toEqual([
      ['2026-10-29-001.png', undefined],
      ['2026-10-29-002.png', undefined],
      ['2026-10-29-003.png', 'provisional'],
      ['2026-10-29-004.png', 'needs-review'],
    ]);
    expect(pending).toEqual(2);
  });

  it('links the paper in the council information system', () => {
    const papers = {
      papers: {
        'paper/1': {
          oparlId: 'paper/1',
          reference: 'VIII-DS-02186-ÄA-02',
          name: 'Masterplan Grün',
          paperType: 'Änderungsantrag',
          date: '2026-10-01',
          web: 'https://ratsinformation.leipzig.de/allris_leipzig_public/VO020?VOLFDNR=1',
          originators: [],
        },
      },
      votings: { '2026-10-29': { '0': 'paper/1' } },
    } as unknown as PapersFile;

    const [item] = toSessionScan('2026-10-29', [voting(0, 'verified')], members, papers).scan;

    expect(item.votingSubject.paperUrl).toEqual(
      'https://ratsinformation.leipzig.de/allris_leipzig_public/VO020?VOLFDNR=1',
    );
  });

  it('names agenda item and paper by their OParl keys, but not the parent item of an amendment', () => {
    const papers = {
      papers: { 'paper/1': { oparlId: 'paper/1', reference: 'VIII-DS-1', name: '', web: '', originators: [] } },
      votings: { '2026-10-29': { '0': 'paper/1', '1': 'paper/1' } },
    } as unknown as PapersFile;
    const oparl = { agendaItemId: 'item/7', number: '19.10', name: 'Masterplan', result: null, paperReference: null };
    const [own, amendment] = toSessionScan(
      '2026-10-29',
      [
        voting(0, 'verified', { oparl: { ...oparl, isParentAgendaItem: false } }),
        voting(1, 'verified', { oparl: { ...oparl, isParentAgendaItem: true } }),
      ],
      members,
      papers,
    ).scan;

    expect(own.votingSubject).toMatchObject({ oparlAgendaItemId: 'item/7', oparlPaperId: 'paper/1' });
    expect(amendment.votingSubject).not.toHaveProperty('oparlAgendaItemId');
    expect(amendment.votingSubject.oparlPaperId).toEqual('paper/1');
  });

  it('takes the title from the OParl agenda item, not from the parent of an amendment', () => {
    const oparl = {
      agendaItemId: 'a/1',
      number: '19.10',
      name: 'Masterplan Grün',
      result: null,
      paperReference: 'VIII-DS-02186',
    };
    const [own] = toSessionScan(
      'd',
      [voting(0, 'verified', { oparl: { ...oparl, isParentAgendaItem: false } })],
      members,
    ).scan;
    const [parent] = toSessionScan(
      'd',
      [voting(0, 'verified', { oparl: { ...oparl, isParentAgendaItem: true } })],
      members,
    ).scan;

    expect(own.votingSubject.title).toEqual('Masterplan Grün');
    expect(parent.votingSubject.title).toEqual('Masterplan Grün (OCR)');
  });

  it('reports a seat without member instead of inventing a name', () => {
    const unknownSeat = {
      column: 1,
      row: 0,
      boardName: 'Unbekannt, X',
      personId: null,
      vote: 'N' as const,
      attendance: 'present' as const,
    };
    const base = voting(0, 'reviewed');
    const { scan, problems } = toSessionScan('2026-10-29', [{ ...base, votes: [...base.votes, unknownSeat] }], members);

    expect(scan[0].votes).toHaveLength(2);
    expect(problems).toEqual(['2026-10-29 #0: seat "Unbekannt, X" has no member in members.json']);
  });
});

describe('subjectType', () => {
  it('derives the kind from the paper reference', () => {
    const typeOf = (paperReference: string | null, procedural = false) =>
      subjectType({ procedural, heading: { paperReference } });

    expect(typeOf('VIII-A-01234')).toEqual('Antrag');
    expect(typeOf('VIII-DS-02011-NF-01')).toEqual('Beschlussvorlage');
    expect(typeOf('VIII-A-01234-ÄA-01')).toEqual('Änderungsantrag');
    expect(typeOf('VIII-Ifo-00123')).toEqual('Sonstige');
    expect(typeOf(null, true)).toEqual('Geschäftsordnung');
    expect(typeOf(null)).toBeNull();
  });
});

describe('formatTimestamp', () => {
  it('writes hours, minutes and seconds with two digits', () => {
    expect(formatTimestamp(59.9)).toEqual('00:00:59');
    expect(formatTimestamp(36125)).toEqual('10:02:05');
  });
});

describe('authorsOf', () => {
  const factions = [
    {
      id: 'buendnis-90-die-gruenen',
      name: 'Bündnis 90/Die Grünen',
      seats: 11,
      oparlId: 'f',
      oparlName: 'Fraktion Bündnis 90/Die Grünen',
    },
    { id: 'cdu', name: 'CDU', seats: 13, oparlId: 'c', oparlName: 'CDU-Fraktion' },
    { id: 'die-linke', name: 'DIE LINKE', seats: 12, oparlId: 'l', oparlName: 'Fraktion DIE LINKE' },
    { id: 'bsw', name: 'BSW', seats: 7, oparlId: 'b', oparlName: 'Fraktion BSW' },
    { id: 'die-freie-fraktion', name: 'Die Freie Fraktion', seats: 4, oparlId: 'x', oparlName: 'Die Freie Fraktion' },
    { id: 'fraktionslos', name: 'fraktionslos', seats: 3, oparlId: null, oparlName: null },
  ];

  it('names factions as the site does and offices of the administration without their number', () => {
    const originators = [
      'Geschäftsstelle der Fraktion Bündnis 90/Die Grünen',
      'Geschäftsstelle der CDU-Fraktion',
      'Geschäftsstelle der Fraktion Die Linke',
      'Geschäftsstelle der BSW-Fraktion',
      'Geschäftsstelle der Freien Fraktion',
      '02.8 Dezernat Wirtschaft, Arbeit und Digitales',
      '01.15 Büro für Ratsangelegenheiten',
    ].map((name, index) => ({ oparlId: `org/${index}`, name }));

    expect(authorsOf({ originators }, { factions })).toEqual([
      'Bündnis 90/Die Grünen',
      'CDU',
      'DIE LINKE',
      'BSW',
      'Die Freie Fraktion',
      'Dezernat Wirtschaft, Arbeit und Digitales',
      'Büro für Ratsangelegenheiten',
    ]);
  });

  it('takes reference and authors from the linked OParl paper', () => {
    const papers = {
      papers: {
        'paper/1': {
          oparlId: 'paper/1',
          reference: 'VIII-DS-02186-ÄA-02',
          name: '',
          paperType: null,
          date: null,
          web: null,
          originators: [{ oparlId: 'org/1', name: 'Geschäftsstelle der CDU-Fraktion' }],
        },
      },
      votings: { '2026-10-29': { '0': 'paper/1' } },
    };
    const misread = voting(0, 'verified', {
      heading: { raw: '', agendaItemNumber: '19.10.2', paperReference: 'VII-DS-02186-ÄA-02', title: '' },
    });
    const [item] = toSessionScan(
      '2026-10-29',
      [misread],
      { ...members, factions } as unknown as LeipzigMembersFile,
      papers,
    ).scan;

    expect(item.votingSubject.motionId).toEqual('VIII-DS-02186-ÄA-02');
    expect(item.votingSubject.authors).toEqual(['CDU']);
  });
});
