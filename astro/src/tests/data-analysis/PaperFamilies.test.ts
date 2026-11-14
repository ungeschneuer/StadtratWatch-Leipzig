import { expect, test } from 'vitest';
import {
  buildPaperFamilies,
  familyBranchOf,
  familyVotingCount,
} from '@data-analysis/PaperFamilies.ts';
import type { Registry } from '@models/registry.ts';
import type { SessionInput } from '@models/SessionInput.ts';
import type { SessionScanItem } from '@models/session-scan.ts';

const parliamentPeriod = {
  id: 'leipzig-8',
  persons: [],
  factions: [],
} as unknown as Registry;
const main = {
  oparlPaperId: 'https://oparl/papers/1',
  reference: 'VIII-DS-1',
  name: 'Masterplan',
  paperType: 'Beschlussvorlage',
};

function voting(
  file: string,
  oparlPaperId: string,
  motionId: string,
  type: string,
  yes: number,
  paperAncestors?: SessionScanItem['votingSubject']['paperAncestors'],
): SessionScanItem {
  return {
    votingFilename: file,
    videoTimestamp: '00:00:00',
    votingSubject: {
      agendaItem: '19.10',
      motionId,
      title: 'Masterplan',
      type,
      authors: [],
      oparlPaperId,
      ...(paperAncestors ? { paperAncestors } : {}),
    },
    votes: [
      ...Array.from({ length: yes }, (_, index) => ({
        name: `J${index}`,
        vote: 'J' as const,
      })),
      { name: 'N', vote: 'N' as const },
      { name: 'N2', vote: 'N' as const },
    ],
  };
}

const sessionInputs: SessionInput[] = [
  {
    session: {
      id: '2026-10-29',
      date: '2026-10-29',
      title: '',
      youtubeUrl: '',
      meetingMinutesUrl: null,
      approved: true,
    },
    votings: [
      voting(
        'a.png',
        'https://oparl/papers/2',
        'VIII-DS-1-ÄA-01',
        'Änderungsantrag',
        1,
        [main],
      ),
      voting(
        'b.png',
        'https://oparl/papers/1',
        'VIII-DS-1',
        'Beschlussvorlage',
        5,
      ),
    ],
    speeches: [],
  },
];

test('puts amendments under their main paper with the votes on each', () => {
  const families = buildPaperFamilies(parliamentPeriod, sessionInputs);
  const family = families.get('https://oparl/papers/2');

  expect(family?.reference).toEqual('VIII-DS-1');
  expect(families.get('https://oparl/papers/1')).toBe(family);
  expect(family?.votings.map((voting) => voting.accepted)).toEqual([true]);
  expect(
    family?.children.map((child) => [
      child.reference,
      child.votings[0].accepted,
    ]),
  ).toEqual([['VIII-DS-1-ÄA-01', false]]);
  expect(familyVotingCount(family!)).toEqual(2);
});

test('shows the branch of the paper the voted one belongs to, with the papers above as a path', () => {
  const leaf = (id: string) => ({
    oparlPaperId: id,
    reference: id,
    name: id,
    paperType: null,
    votings: [],
    children: [],
  });
  const amendment = leaf('ÄA');
  const plan = { ...leaf('DS-04'), children: [amendment, leaf('DS-06')] };
  const root = { ...leaf('Auftakt'), children: [plan, leaf('Pilot')] };

  expect(familyBranchOf(root, 'ÄA')).toEqual({ branch: plan, path: [root] });
  expect(familyBranchOf(root, 'DS-04')).toEqual({ branch: root, path: [] });
  expect(familyBranchOf(root, 'Auftakt')).toEqual({ branch: root, path: [] });
});
