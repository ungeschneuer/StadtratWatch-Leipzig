import type { VoteCode } from './Session.ts';

// Review cases of the Leipzig voting extraction: the votes whose cross-checks failed, with everything a reviewer needs
// to decide, and the corrections file entries the review writes back.

export type VotingCorrection = {
  voting: { videoSeconds: number; agendaItemNumber?: string };
  seats?: { personId: string; vote: VoteCode }[];
  approve?: boolean;
  // Not a valid vote: a count in progress, a stale board, or a vote the chair had repeated.
  discard?: boolean;
  // A valid vote that cannot be settled: the official result differs from the board, and neither minutes nor video say
  // who was counted differently. The board's votes stand for each person, the official result decides the outcome.
  unresolved?: boolean;
  agendaItemNumber?: string;
  reason: string;
  source?: string;
  // GitHub login of the person who decided, and when; written by the review UI.
  reviewer?: string;
  reviewedAt?: string;
};

export type ReviewPriority = 'hoch' | 'mittel' | 'niedrig';

export type ReviewSeat = {
  column: number;
  row: number;
  boardName: string;
  personId: string | null;
  vote: VoteCode;
  attendance: 'present' | 'absent';
};

export type ReviewEntry = {
  reason: string;
  source: string | null;
  reviewer?: string | null;
  reviewedAt?: string | null;
};

export type ReviewNeighbour = {
  votingIndex: number;
  agendaItemNumber: string | null;
  title: string;
  result: string;
  timecode: string;
};

export type ReviewCase = {
  votingIndex: number;
  open: boolean;
  priority: ReviewPriority;
  videoSeconds: number;
  timecode: string;
  agendaItemNumber: string | null;
  paperReference: string | null;
  title: string;
  problems: { check: string; message: string; detail: string }[];
  board: {
    J: number;
    N: number;
    E: number;
    castVotes: number | null;
    presentMembers: number | null;
  };
  announced: {
    J: number;
    N: number;
    // null when the chair named only Ja and Nein.
    E: number | null;
    timecode: string;
    quote: string;
  } | null;
  // The official result: minutes (Beschlussprotokoll), the ALLRIS agenda item page, or the Verlaufsprotokoll.
  official: {
    J: number;
    N: number;
    E: number;
    agendaItemNumber: string | null;
    paperReference: string | null;
    procedural: boolean;
    sources: {
      kind: 'beschlussprotokoll' | 'agenda-item-pages' | 'verlaufsprotokoll';
      agendaItemNumbers: string[];
      paperReference: string | null;
      label: string;
      J: number;
      N: number;
      E: number;
    }[];
    correction: {
      seats: { personId: string; boardName: string; vote: VoteCode }[];
      quote: string;
      basis: 'named' | 'only-non-voters';
    } | null;
  } | null;
  transcript: {
    seconds: number;
    timecode: string;
    text: string;
    highlight: boolean;
  }[];
  neighbours: {
    previous: ReviewNeighbour | null;
    next: ReviewNeighbour | null;
  };
  links: { label: string; url: string }[];
  images: { label: string; url: string }[];
  seats: ReviewSeat[];
  candidates: { personId: string; boardName: string; reason: string }[];
  suggestions: { label: string; correction: VotingCorrection }[];
  reviews: ReviewEntry[];
};

export type ReviewCasesFile = {
  sessionId: string;
  generatedAt: string;
  video: { hlsUrl: string; mediathekUrl: string; available: boolean };
  summary: { cases: number; open: number; reviewed: number };
  cases: ReviewCase[];
};

export type ReviewIndex = {
  sessions: {
    sessionId: string;
    videoAvailable: boolean;
    cases: number;
    open: number;
    reviewed: number;
  }[];
};
