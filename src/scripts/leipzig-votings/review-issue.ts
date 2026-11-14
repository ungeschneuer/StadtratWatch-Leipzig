import type { ReviewCasesFile } from '@srw-astro/models/leipzig-review';

export type ReviewIssue = { sessionId: string; title: string; open: number; body: string };

// The marker lets the workflow find the issue of a session again, whatever its title has become.
export function issueMarker(sessionId: string): string {
  return `<!-- leipzig-review:${sessionId} -->`;
}

export function renderReviewIssue(file: ReviewCasesFile, reviewUiUrl: string): ReviewIssue {
  const sessionUrl = `${reviewUiUrl.replace(/\/$/, '')}/leipzig/${file.sessionId}`;
  const date = new Date(`${file.sessionId}T12:00:00Z`).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const cases = [...file.cases].sort((a, b) => a.videoSeconds - b.videoSeconds);
  const lines = cases.map((reviewCase) => {
    const top = reviewCase.agendaItemNumber ? `TOP ${reviewCase.agendaItemNumber}` : 'ohne TOP';
    const problem = reviewCase.problems[0]?.message ?? '';
    return `- [${reviewCase.open ? ' ' : 'x'}] **#${reviewCase.votingIndex}**, ${top}, ${reviewCase.timecode}, Priorität ${reviewCase.priority}: ${problem} [prüfen](${sessionUrl}#fall-${reviewCase.votingIndex})`;
  });
  const open = file.summary.open;
  const body = [
    issueMarker(file.sessionId),
    `Die automatische Auswertung der Ratsversammlung vom ${date} hat ${file.summary.cases} Abstimmung(en) gefunden, die ein Mensch prüfen muss.`,
    '',
    `**${open} offen**, ${file.summary.reviewed} entschieden. Zur Prüfung: **[Prüfseite öffnen](${sessionUrl})** (Video, Belegbilder, Untertitel und Vorschläge je Fall).`,
    '',
    file.video.available
      ? 'Die Aufzeichnung ist noch in der Mediathek. Fälle, die das Video brauchen, bitte bald prüfen.'
      : 'Die Aufzeichnung ist nicht mehr in der Mediathek; es bleiben die Belegbilder und Untertitel.',
    '',
    ...lines,
    '',
    'Entscheidungen landen in `corrections-' +
      file.sessionId +
      '.json` im Daten-PR; nach jedem Speichern prüft ein Workflow die Datei und hakt erledigte Fälle hier ab.',
  ].join('\n');
  return {
    sessionId: file.sessionId,
    title: `Prüfung Ratsversammlung ${date}: ${open === 0 ? 'erledigt' : `${open} offen`}`,
    open,
    body,
  };
}
