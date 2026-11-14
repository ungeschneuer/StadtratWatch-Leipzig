import type { ExtractedVoting } from '../leipzig-votings/extract-session.ts';
import { samePaper } from '../leipzig-votings/voting-checks.ts';

export type FetchJson = (url: string) => Promise<unknown>;

export type PaperOriginator = { oparlId: string; name: string };

export type LeipzigPaper = {
  oparlId: string;
  reference: string;
  name: string;
  paperType: string | null;
  date: string | null;
  // The paper's page in the council information system.
  web: string | null;
  // Who submitted it: a faction's office or a part of the administration (OParl `underDirectionOf`).
  originators: PaperOriginator[];
  // The paper it belongs to: the original of a revision, the main paper of an amendment. Missing in files written
  // before 14.11.2026; addPaperAncestors fills it in.
  superordinatedPaperIds?: string[];
};

// votings: per session day, the vote's index in the scan → the OParl paper it was about.
export type PapersFile = {
  papers: Record<string, LeipzigPaper>;
  votings: Record<string, Record<string, string>>;
};

type OparlPaper = {
  id: string;
  reference?: string;
  name?: string;
  paperType?: string;
  date?: string;
  web?: string;
  underDirectionOf?: string[];
  subordinatedPaper?: string[];
  superordinatedPaper?: string[];
  deleted?: boolean;
};

export type PaperLookup = {
  paperOfAgendaItem(agendaItemId: string): Promise<OparlPaper | null>;
  paper(paperId: string): Promise<OparlPaper>;
  organizationName(organizationId: string): Promise<string>;
};

// Each OParl object is fetched once per run, however many votes refer to it.
export function createPaperLookup(fetchJson: FetchJson): PaperLookup {
  const cache = new Map<string, Promise<unknown>>();
  const get = (url: string) => {
    if (!cache.has(url)) cache.set(url, fetchJson(url));
    return cache.get(url) as Promise<unknown>;
  };
  return {
    async paperOfAgendaItem(agendaItemId) {
      const item = (await get(agendaItemId)) as { consultation?: string };
      if (!item.consultation) return null;
      const consultation = (await get(item.consultation)) as { paper?: string };
      return consultation.paper ? ((await get(consultation.paper)) as OparlPaper) : null;
    },
    paper: async (paperId) => (await get(paperId)) as OparlPaper,
    organizationName: async (organizationId) =>
      ((await get(organizationId)) as { name?: string }).name ?? organizationId,
  };
}

// The paper a vote was about. The agenda item names the main paper; an amendment has no agenda item of its own in
// OParl, so the board's reference is looked up among the main paper's subordinate papers.
export async function findVotingPaper(voting: ExtractedVoting, lookup: PaperLookup): Promise<OparlPaper | null> {
  if (!voting.oparl?.agendaItemId) return null;
  const main = await lookup.paperOfAgendaItem(voting.oparl.agendaItemId);
  if (!main?.reference) return null;
  const boardReference = voting.heading.paperReference;
  if (!boardReference || samePaper(boardReference, main.reference)) return main;
  for (const paperId of main.subordinatedPaper ?? []) {
    const subordinate = await lookup.paper(paperId);
    if (!subordinate.deleted && subordinate.reference && samePaper(boardReference, subordinate.reference)) {
      return subordinate;
    }
  }
  return null;
}

export async function toLeipzigPaper(paper: OparlPaper, lookup: PaperLookup): Promise<LeipzigPaper> {
  const originators: PaperOriginator[] = [];
  for (const organizationId of paper.underDirectionOf ?? []) {
    originators.push({ oparlId: organizationId, name: await lookup.organizationName(organizationId) });
  }
  return {
    oparlId: paper.id,
    reference: paper.reference ?? '',
    name: paper.name ?? '',
    paperType: paper.paperType ?? null,
    date: paper.date ?? null,
    web: paper.web ?? null,
    originators,
    superordinatedPaperIds: paper.superordinatedPaper ?? [],
  };
}

// Revisions, amendments and the administration's statement belong to a main paper; the site shows them together.
// Every paper gets its relations, and every paper above a voted one is added, voted or not.
export async function addPaperAncestors(file: PapersFile, lookup: PaperLookup): Promise<number> {
  let added = 0;
  const pending = Object.keys(file.papers);
  while (pending.length > 0) {
    const paperId = pending.shift() as string;
    const known = file.papers[paperId];
    if (!known || !known.superordinatedPaperIds) {
      const paper = await lookup.paper(paperId);
      if (!known) added++;
      file.papers[paperId] = {
        ...(await toLeipzigPaper(paper, lookup)),
        ...(known ?? {}),
        superordinatedPaperIds: paper.superordinatedPaper ?? [],
      };
    }
    for (const parentId of file.papers[paperId].superordinatedPaperIds ?? []) {
      if (!file.papers[parentId]) pending.push(parentId);
    }
  }
  return added;
}

// Votes of a session that do not have a paper yet; a vote once linked keeps its paper, so a run fetches only new ones.
export async function addSessionPapers(
  file: PapersFile,
  sessionId: string,
  votings: ExtractedVoting[],
  lookup: PaperLookup,
): Promise<{ linked: number; unlinked: number }> {
  const sessionVotings = (file.votings[sessionId] ??= {});
  let linked = 0;
  let unlinked = 0;
  for (const voting of votings.filter((candidate) => candidate.status !== 'discarded')) {
    if (sessionVotings[String(voting.index)]) continue;
    const paper = await findVotingPaper(voting, lookup);
    if (!paper) {
      unlinked++;
      continue;
    }
    file.papers[paper.id] ??= await toLeipzigPaper(paper, lookup);
    sessionVotings[String(voting.index)] = paper.id;
    linked++;
  }
  return { linked, unlinked };
}
