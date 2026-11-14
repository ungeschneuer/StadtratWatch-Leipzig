export type VotingReportInput = {
  pageUrl: string;
  sessionDate: string;
  agendaItem: string;
  itemNumber?: string;
  paperReference: string;
  title: string;
  repositoryUrl: string;
  contactEmail: string;
};

export type VotingReportLinks = { issueUrl: string; mailUrl: string };

// Everyone can point out an error in a vote: as a GitHub issue, or by mail for those without an account. Both carry
// the vote, so the report needs no further question to be found.
export function votingReportLinks(input: VotingReportInput): VotingReportLinks {
  const where = [
    `TOP ${input.agendaItem}`,
    input.itemNumber && `Punkt ${input.itemNumber}`,
  ]
    .filter(Boolean)
    .join(', ');
  const subject = `Hinweis zur Abstimmung vom ${input.sessionDate}, ${where}`;
  const body = [
    `Abstimmung: Ratsversammlung vom ${input.sessionDate}, ${where}`,
    `Vorlage: ${[input.paperReference, input.title].filter(Boolean).join(', ')}`,
    `Seite: ${input.pageUrl}`,
    '',
    'Was stimmt nicht? (zum Beispiel Name, Stimme oder Ergebnis)',
    '',
    '',
    'Woher wissen Sie es? (zum Beispiel Zeitpunkt im Video oder Fundstelle im Protokoll)',
    '',
  ].join('\n');
  const query = (fields: Record<string, string>) =>
    Object.entries(fields)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
  return {
    issueUrl: `${input.repositoryUrl}/issues/new?${query({ title: subject, body })}`,
    mailUrl: `mailto:${input.contactEmail}?${query({ subject, body })}`,
  };
}

// The review UI names its cases by the vote's index in the session, which the evidence file name carries
// („2026-10-29-005.png“ is the fifth vote, index 4).
export function reviewCaseNumberOf(votingFilename: string): number | null {
  const number = votingFilename.match(/-(\d{3})\.png$/)?.[1];
  return number ? Number(number) - 1 : null;
}
