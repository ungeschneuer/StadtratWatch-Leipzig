import type { Registry } from '@models/registry.ts';
import type { SessionInput } from '@models/SessionInput.ts';
import type { SessionScanItem } from '@models/session-scan.ts';
import { votingAccepted } from '@models/voting-breakdown.ts';
import { siteRoutes, votingSlugs } from '@utils/routes.ts';

export type FamilyVoting = {
  votingFilename: string;
  sessionDate: string;
  agendaItem: string;
  itemNumber?: string;
  accepted: boolean;
  url: string;
};

export type FamilyPaper = {
  oparlPaperId: string;
  reference: string;
  name: string;
  paperType: string | null;
  paperUrl?: string;
  votings: FamilyVoting[];
  children: FamilyPaper[];
};

// A main paper with its revisions, amendments and the administration's statement, each with the votes on it in the
// order of the sessions. Built from all votes of the period, so a vote shows the votes on the rest of its family.
export function buildPaperFamilies(
  parliamentPeriod: Registry,
  sessionInputs: SessionInput[],
): Map<string, FamilyPaper> {
  const routes = siteRoutes(parliamentPeriod.id);
  const papers = new Map<string, FamilyPaper & { parentId: string | null }>();
  const ensure = (
    paper: Omit<FamilyPaper, 'votings' | 'children'>,
    parentId: string | null,
  ): FamilyPaper & { parentId: string | null } => {
    const existing = papers.get(paper.oparlPaperId);
    if (existing) {
      existing.parentId ??= parentId;
      return existing;
    }
    const created = { ...paper, votings: [], children: [], parentId };
    papers.set(paper.oparlPaperId, created);
    return created;
  };

  for (const sessionInput of sessionInputs) {
    const slugs = votingSlugs(sessionInput.votings);
    for (const voting of sessionInput.votings) {
      const subject = voting.votingSubject;
      if (!subject.oparlPaperId) continue;
      let parentId: string | null = null;
      for (const ancestor of subject.paperAncestors ?? []) {
        ensure({ ...ancestor }, parentId);
        parentId = ancestor.oparlPaperId;
      }
      const paper = ensure(
        {
          oparlPaperId: subject.oparlPaperId,
          reference: subject.motionId,
          name: subject.title,
          paperType: subject.type,
          ...(subject.paperUrl ? { paperUrl: subject.paperUrl } : {}),
        },
        parentId,
      );
      paper.votings.push(
        familyVotingOf(
          parliamentPeriod,
          sessionInput,
          voting,
          routes.voting(
            sessionInput.session.id,
            slugs.get(voting.votingFilename) as string,
          ),
        ),
      );
    }
  }

  const roots = new Map<string, FamilyPaper>();
  for (const paper of papers.values()) {
    const parent = paper.parentId ? papers.get(paper.parentId) : undefined;
    if (parent) parent.children.push(paper);
  }
  for (const paper of papers.values()) {
    paper.children.sort((a, b) =>
      a.reference.localeCompare(b.reference, 'de', { numeric: true }),
    );
  }
  const rootOf = (
    paper: FamilyPaper & { parentId: string | null },
  ): FamilyPaper & { parentId: string | null } =>
    paper.parentId && papers.get(paper.parentId)
      ? rootOf(papers.get(paper.parentId)!)
      : paper;
  for (const paper of papers.values()) {
    if (paper.votings.length > 0) roots.set(paper.oparlPaperId, rootOf(paper));
  }
  return roots;
}

// A family is worth showing when it has more than the one vote on the page.
export function familyVotingCount(paper: FamilyPaper): number {
  return (
    paper.votings.length +
    paper.children.reduce((sum, child) => sum + familyVotingCount(child), 0)
  );
}

function familyVotingOf(
  parliamentPeriod: Registry,
  sessionInput: SessionInput,
  voting: SessionScanItem,
  url: string,
): FamilyVoting {
  return {
    votingFilename: voting.votingFilename,
    sessionDate: sessionInput.session.date,
    agendaItem: voting.votingSubject.agendaItem,
    ...(voting.votingSubject.itemNumber
      ? { itemNumber: voting.votingSubject.itemNumber }
      : {}),
    accepted: votingAccepted(parliamentPeriod, voting),
    url,
  };
}

// The part of a family a vote's page shows: the paper the voted one belongs to (or the voted paper itself if nothing is
// above it) with everything below it, and the papers above that as a path. Whole families can span years of a
// programme (the heat plan since 2022); the branch keeps the page to the matter at hand.
export function familyBranchOf(
  root: FamilyPaper,
  oparlPaperId: string,
): { branch: FamilyPaper; path: FamilyPaper[] } | null {
  const chain = chainTo(root, oparlPaperId);
  if (!chain) return null;
  const branchIndex = Math.max(chain.length - 2, 0);
  return { branch: chain[branchIndex], path: chain.slice(0, branchIndex) };
}

function chainTo(
  paper: FamilyPaper,
  oparlPaperId: string,
): FamilyPaper[] | null {
  if (paper.oparlPaperId === oparlPaperId) return [paper];
  for (const child of paper.children) {
    const chain = chainTo(child, oparlPaperId);
    if (chain) return [paper, ...chain];
  }
  return null;
}
