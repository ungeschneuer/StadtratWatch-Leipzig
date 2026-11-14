import { describe, expect, it } from 'bun:test';

import type { LeipzigMembersFile } from '@srw-astro/models/leipzig-members';

import type { PapersFile } from '../leipzig-papers/voting-papers.ts';
import type { ExtractedVoting } from '../leipzig-votings/extract-session.ts';
import { authorsOf, formatTimestamp, subjectType, toSessionScan } from './session-scan.ts';
import type { MajorityOverride } from './special-cases.ts';

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
    checkStatus: status === 'reviewed' || status === 'unresolved' ? 'needs-review' : status,
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

  it('names the papers a voted paper belongs to, from the main paper down', () => {
    const paper = (oparlId: string, reference: string, paperType: string, parent?: string) => ({
      oparlId,
      reference,
      name: `Name ${reference}`,
      paperType,
      date: null,
      web: `https://allris/${reference}`,
      originators: [],
      superordinatedPaperIds: parent ? [parent] : [],
    });
    const papers = {
      papers: {
        'paper/main': paper('paper/main', 'VII-DS-07720', 'Beschlussvorlage'),
        'paper/ds04': paper('paper/ds04', 'VII-DS-07720-DS-04', 'Beschlussvorlage', 'paper/main'),
        'paper/aa': paper('paper/aa', 'VII-DS-07720-DS-04-ÄA-04', 'Änderungsantrag', 'paper/ds04'),
      },
      votings: { '2026-10-29': { '0': 'paper/aa' } },
    } as unknown as PapersFile;

    const [item] = toSessionScan('2026-10-29', [voting(0, 'verified')], members, papers).scan;

    expect(item.votingSubject.paperAncestors).toEqual([
      {
        oparlPaperId: 'paper/main',
        reference: 'VII-DS-07720',
        name: 'Name VII-DS-07720',
        paperType: 'Beschlussvorlage',
        paperUrl: 'https://allris/VII-DS-07720',
      },
      {
        oparlPaperId: 'paper/ds04',
        reference: 'VII-DS-07720-DS-04',
        name: 'Name VII-DS-07720-DS-04',
        paperType: 'Beschlussvorlage',
        paperUrl: 'https://allris/VII-DS-07720-DS-04',
      },
    ]);
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

  it('names members who declared a conflict of interest, and reports one who voted all the same', () => {
    const recusal = {
      sessionId: '2026-10-29',
      agendaItemNumbers: ['19.10'],
      personOparlId: 'p/nagel',
      quote: 'Frau Nagel hat sich für befangen erklärt.',
      sourceUrl: 'https://ratsinformation.leipzig.de/',
    };
    const fine = toSessionScan('2026-10-29', [voting(4, 'verified')], members, null, [recusal]);
    expect(fine.scan[0].recusedPersons).toEqual(['Juliane Nagel']);
    expect(fine.problems).toEqual([]);

    const wrong = toSessionScan('2026-10-29', [voting(4, 'verified')], members, null, [
      { ...recusal, personOparlId: 'p/stange' },
    ]);
    expect(wrong.problems).toEqual(['2026-10-29 #4: Enrico Stange is recused at 19.10.2 but voted J']);
  });

  it('publishes a vote that cannot be settled with the official result and the reason', () => {
    const unresolved = voting(4, 'unresolved', {
      official: {
        J: 1,
        N: 1,
        E: 0,
        agendaItemNumber: '19.10.2',
        paperReference: null,
        procedural: false,
        sources: [],
        correction: null,
      },
      review: [{ reason: 'Nachgezählte Person nicht belegt', source: null, reviewer: 'm', reviewedAt: null }],
    });
    const [item] = toSessionScan('2026-10-29', [unresolved], members).scan;

    expect(item.unresolved).toEqual({
      reason: 'Nachgezählte Person nicht belegt',
      officialCounts: { J: 1, N: 1, E: 0 },
      unassignedCounts: { J: 0, N: 1, E: 0 },
      possibleVoters: ['Juliane Nagel'],
    });
    expect(item.votes).toEqual([
      { name: 'Enrico Stange', vote: 'J' },
      { name: 'Juliane Nagel', vote: 'O' },
    ]);
  });

  it('names the hand-counted votes nobody was named for and who could have cast them', () => {
    const unresolved = voting(4, 'unresolved', {
      official: {
        J: 2,
        N: 0,
        E: 0,
        agendaItemNumber: '19.10.2',
        paperReference: null,
        procedural: false,
        sources: [],
        correction: null,
      },
      review: [{ reason: 'Ein Ja ohne Namen', source: null, reviewer: 'm', reviewedAt: null }],
    });
    const [item] = toSessionScan('2026-10-29', [unresolved], members).scan;

    expect(item.unresolved).toEqual({
      reason: 'Ein Ja ohne Namen',
      officialCounts: { J: 2, N: 0, E: 0 },
      unassignedCounts: { J: 1, N: 0, E: 0 },
      possibleVoters: ['Juliane Nagel'],
    });
  });

  it('names no possible voters when the board counted more than the official result', () => {
    const unresolved = voting(4, 'unresolved', {
      official: {
        J: 0,
        N: 0,
        E: 0,
        agendaItemNumber: '19.10.2',
        paperReference: null,
        procedural: false,
        sources: [],
        correction: null,
      },
      review: [{ reason: 'Ein Ja zu viel', source: null, reviewer: 'm', reviewedAt: null }],
    });
    const [item] = toSessionScan('2026-10-29', [unresolved], members).scan;

    expect(item.unresolved?.unassignedCounts).toEqual({ J: -1, N: 0, E: 0 });
    expect(item.unresolved?.possibleVoters).toBeUndefined();
  });

  it('marks the votes that are cases of the review UI, so their page can link there', () => {
    const { scan } = toSessionScan(
      '2026-10-29',
      [voting(3, 'verified'), voting(4, 'reviewed')],
      members,
      null,
      [],
      new Set([4]),
    );

    expect(scan.map((item) => item.reviewCase)).toEqual([undefined, true]);
  });

  it('takes the majority of a point from the editorial overrides', () => {
    const point3 = voting(4, 'verified', {
      official: {
        J: 1,
        N: 0,
        E: 0,
        agendaItemNumber: '19.10.2',
        paperReference: null,
        procedural: false,
        sources: [
          {
            kind: 'beschlussprotokoll',
            agendaItemNumbers: ['19.10.2'],
            paperReference: null,
            label: 'Abstimmungsergebnis: Beschlusspunkt 3:',
            J: 1,
            N: 0,
            E: 0,
          },
        ],
        correction: null,
      },
    });
    const override: MajorityOverride = {
      sessionId: '2026-10-29',
      agendaItemNumber: '19.10.2',
      itemNumber: '3',
      majorityRequirement: 'majority-of-members',
      quote: 'Punkt 3 ist die Satzung.',
      sourceUrl: 'https://example.org',
    };

    const [item] = toSessionScan('2026-10-29', [point3], members, null, [], new Set(), [override]).scan;

    expect(item.majorityRequirement).toEqual('majority-of-members');
    expect(item.votingSubject.itemNumber).toEqual('3');
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
