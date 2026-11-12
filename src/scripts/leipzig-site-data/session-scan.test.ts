import { describe, expect, it } from 'bun:test';

import type { LeipzigMembersFile } from '@srw-astro/models/leipzig-members';

import type { ExtractedVoting } from '../leipzig-votings/extract-session.ts';
import { formatTimestamp, subjectType, toSessionScan } from './session-scan.ts';

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

  it('leaves out votes waiting for review, discarded and skipped, and counts what is pending', () => {
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

    expect(scan.map((item) => item.votingFilename)).toEqual([
      '2026-10-29-001.png',
      '2026-10-29-002.png',
      '2026-10-29-003.png',
    ]);
    expect(pending).toEqual(2);
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
