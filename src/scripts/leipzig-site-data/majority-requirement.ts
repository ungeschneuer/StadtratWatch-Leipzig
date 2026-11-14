import type { MajorityRequirement } from '@srw-astro/models/session-scan';

// Leipzig decides by a majority of yes over no; the exceptions below are the ones a vote of the Ratsversammlung can
// meet (docs/research/2026-11-12-mehrheitserfordernisse-leipzig.md). Appointments and delegations („Bestellung“,
// „Entsendung“) are resolutions, not elections: the city declares them passed with fewer yes votes than half of those
// present (02.09.2026 TOP 9.4, 31:29:0 with 66 present). An amendment to a change of the Hauptsatzung needs the simple
// majority; the majority of all members is required for the resolution on the statute (assessment of 14.11.2026, see
// the research note). A paper that changes the Hauptsatzung only in one of its points („Grundsatzbeschluss … und
// Satzungsbeschluss zur verbundenen Änderung der Hauptsatzung“, voted on point by point) does not say which vote is that
// point; only a title that starts with the change counts here, the point is entered in majority-overrides.json. Petitions
// („VIII-P-…“) are ordinary resolutions even when they ask for an honorary citizenship.
type QualifiedMajorityRule = { requirement: MajorityRequirement; title: RegExp };

const QUALIFIED_MAJORITY_RULES: QualifiedMajorityRule[] = [
  // § 4 Abs. 2 SächsGemO
  {
    requirement: 'majority-of-members',
    title: /^(\d+\.\s*)?(Satzung zur\s+)?(Änderung|Neufassung|Erlass) der Hauptsatzung|^Hauptsatzung\b/i,
  },
  // § 5 Abs. 1, § 6 Abs. 3 Ehrenbürgersatzung
  { requirement: 'two-thirds-of-members', title: /(Verleihung|Aberkennung)\b.*\b(Ehrenbürger|Ehrenmedaille)/i },
  // § 24 Abs. 1 SächsGemO
  { requirement: 'two-thirds-of-members', title: /Ratsbürgerentscheid|Durchführung eines Bürgerentscheid/i },
  // § 39 Abs. 7 SächsGemO
  { requirement: 'majority-of-present', title: /^Wahl\b|\bwählt\b/i },
];

export type MajorityRequirementInput = { title: string; paperReference: string | null; procedural: boolean };

export function majorityRequirementOf(voting: MajorityRequirementInput): MajorityRequirement | undefined {
  if (voting.procedural || isAmendment(voting.paperReference) || isPetition(voting.paperReference)) return undefined;
  return QUALIFIED_MAJORITY_RULES.find((rule) => rule.title.test(voting.title))?.requirement;
}

function isPetition(paperReference: string | null): boolean {
  return paperReference !== null && /^[IVX]+-P-/.test(paperReference);
}

function isAmendment(paperReference: string | null): boolean {
  return paperReference !== null && /-ÄA-\d+/.test(paperReference);
}
