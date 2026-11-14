import { describe, expect, it } from 'bun:test';

import type { ExtractedVoting } from '../leipzig-votings/extract-session.ts';
import {
  addPaperAncestors,
  addSessionPapers,
  createPaperLookup,
  findVotingPaper,
  type PapersFile,
} from './voting-papers.ts';

const OPARL: Record<string, unknown> = {
  'item/19.10': { consultation: 'consultation/1' },
  'consultation/1': { paper: 'paper/main' },
  'paper/main': {
    id: 'paper/main',
    reference: 'VIII-DS-02186',
    name: 'Masterplan Grün',
    paperType: 'Beschlussvorlage',
    underDirectionOf: ['org/at/2076'],
    subordinatedPaper: ['paper/old', 'paper/amendment'],
    web: 'https://ratsinformation.leipzig.de/allris_leipzig_public/VO020?VOLFDNR=1',
  },
  'paper/old': { id: 'paper/old', reference: 'VIII-DS-02186-ÄA-01', deleted: true },
  'paper/amendment': {
    id: 'paper/amendment',
    reference: 'VIII-DS-02186-ÄA-01',
    name: 'Änderungsantrag',
    paperType: 'Änderungsantrag',
    underDirectionOf: ['org/at/2241'],
    superordinatedPaper: ['paper/main'],
  },
  'paper/revision': {
    id: 'paper/revision',
    reference: 'VIII-A-01631-NF-01',
    name: 'Neufassung',
    paperType: 'Neufassung Antrag',
    superordinatedPaper: ['paper/original'],
  },
  'paper/original': { id: 'paper/original', reference: 'VIII-A-01631', name: 'Antrag', paperType: 'Antrag' },
  'org/at/2076': { name: '02.6 Dezernat Stadtentwicklung und Bau' },
  'org/at/2241': { name: 'Geschäftsstelle der Fraktion Bündnis 90/Die Grünen' },
};

function fakeOparl() {
  const requested: string[] = [];
  const fetchJson = (url: string) => {
    requested.push(url);
    return url in OPARL ? Promise.resolve(OPARL[url]) : Promise.reject(new Error(`404 ${url}`));
  };
  return { requested, lookup: createPaperLookup(fetchJson) };
}

function voting(index: number, paperReference: string | null, status: ExtractedVoting['status'] = 'verified') {
  return {
    index,
    status,
    heading: { raw: '', agendaItemNumber: '19.10', paperReference, title: '' },
    oparl: { agendaItemId: 'item/19.10', number: '19.10', isParentAgendaItem: paperReference?.includes('ÄA') ?? false },
  } as ExtractedVoting;
}

describe('findVotingPaper', () => {
  it('takes the paper of the agenda item when the board names it', async () => {
    expect((await findVotingPaper(voting(0, 'VIII-DS-02186'), fakeOparl().lookup))?.id).toEqual('paper/main');
  });

  it('finds an amendment among the subordinate papers, skipping deleted ones', async () => {
    expect((await findVotingPaper(voting(0, 'VIII-DS-02186-ÄA-01'), fakeOparl().lookup))?.id).toEqual(
      'paper/amendment',
    );
  });

  it('ignores the period numeral that OCR confuses', async () => {
    expect(
      (await findVotingPaper(voting(0, 'VIII-DS-02186-ÄA-01'.replace('VIII', 'VII')), fakeOparl().lookup))?.id,
    ).toEqual('paper/amendment');
  });

  it('gives no paper for a reference the agenda item does not know', async () => {
    expect(await findVotingPaper(voting(0, 'VIII-A-09999'), fakeOparl().lookup)).toBeNull();
  });
});

describe('addSessionPapers', () => {
  it('links the votes of a session and keeps the submitters', async () => {
    const file: PapersFile = { papers: {}, votings: {} };
    const result = await addSessionPapers(
      file,
      '2026-10-29',
      [voting(3, 'VIII-DS-02186'), voting(4, 'VIII-DS-02186-ÄA-01'), voting(5, 'VIII-DS-02186', 'discarded')],
      fakeOparl().lookup,
    );

    expect(result).toEqual({ linked: 2, unlinked: 0 });
    expect(file.votings).toEqual({ '2026-10-29': { '3': 'paper/main', '4': 'paper/amendment' } });
    expect(file.papers['paper/amendment']).toEqual({
      oparlId: 'paper/amendment',
      reference: 'VIII-DS-02186-ÄA-01',
      name: 'Änderungsantrag',
      paperType: 'Änderungsantrag',
      date: null,
      web: null,
      originators: [{ oparlId: 'org/at/2241', name: 'Geschäftsstelle der Fraktion Bündnis 90/Die Grünen' }],
      superordinatedPaperIds: ['paper/main'],
    });
  });

  it('fetches nothing for votes linked before', async () => {
    const file: PapersFile = { papers: {}, votings: { '2026-10-29': { '3': 'paper/main' } } };
    const { requested, lookup } = fakeOparl();

    await addSessionPapers(file, '2026-10-29', [voting(3, 'VIII-DS-02186')], lookup);

    expect(requested).toEqual([]);
  });
});

describe('addPaperAncestors', () => {
  // A revision (Neufassung) points to the original paper, which the council may never have voted on.
  it('adds the papers a voted paper belongs to, also those without a vote of their own', async () => {
    const file: PapersFile = {
      papers: {
        'paper/revision': {
          oparlId: 'paper/revision',
          reference: 'VIII-A-01631-NF-01',
          name: 'Neufassung',
          paperType: 'Neufassung Antrag',
          date: null,
          web: null,
          originators: [],
        },
      },
      votings: { '2026-09-30': { '3': 'paper/revision' } },
    };

    await addPaperAncestors(file, fakeOparl().lookup);

    expect(file.papers['paper/revision'].superordinatedPaperIds).toEqual(['paper/original']);
    expect(file.papers['paper/original']).toMatchObject({ reference: 'VIII-A-01631', superordinatedPaperIds: [] });
  });

  it('fetches nothing for papers whose relations are known', async () => {
    const { requested, lookup } = fakeOparl();
    const file: PapersFile = {
      papers: {
        'paper/main': {
          oparlId: 'paper/main',
          reference: 'VIII-DS-02186',
          name: 'Masterplan Grün',
          paperType: 'Beschlussvorlage',
          date: null,
          web: null,
          originators: [],
          superordinatedPaperIds: [],
        },
      },
      votings: {},
    };

    await addPaperAncestors(file, lookup);

    expect(requested).toEqual([]);
  });
});
