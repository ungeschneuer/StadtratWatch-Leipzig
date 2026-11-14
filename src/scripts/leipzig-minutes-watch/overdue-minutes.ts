// What the ALLRIS runner should have fetched by now. The city publishes the result pages of the agenda items within days,
// the Verlaufsprotokoll within about two weeks and the signed Beschlussprotokoll within about six (30.09.2026: all three
// by 11.11.2026). Each deadline leaves a margin, so a late city is no alarm but a runner that stopped is. In the summer
// break there are no sessions, so nothing can be overdue.
export const DEADLINES_IN_DAYS = {
  resultPages: 14,
  verlaufsprotokoll: 45,
  beschlussprotokoll: 75,
} as const;

export type SessionMinutes = {
  sessionId: string;
  // null: nothing fetched yet; agenda-item-pages: results of ALLRIS only; beschlussprotokoll: the signed minutes.
  minutesKind: 'agenda-item-pages' | 'beschlussprotokoll' | null;
  hasVerlaufsprotokoll: boolean;
};

export type OverdueMinutes = { sessionId: string; daysSinceSession: number; missing: string[] };

export function overdueMinutes(sessions: SessionMinutes[], today: string): OverdueMinutes[] {
  return sessions.flatMap((session) => {
    const days = daysBetween(session.sessionId, today);
    const missing = [
      session.minutesKind === null && days > DEADLINES_IN_DAYS.resultPages && 'Ergebnisse in ALLRIS',
      !session.hasVerlaufsprotokoll && days > DEADLINES_IN_DAYS.verlaufsprotokoll && 'Verlaufsprotokoll',
      session.minutesKind !== 'beschlussprotokoll' &&
        days > DEADLINES_IN_DAYS.beschlussprotokoll &&
        'Beschlussprotokoll',
    ].filter((item): item is string => Boolean(item));
    return missing.length > 0 ? [{ sessionId: session.sessionId, daysSinceSession: days, missing }] : [];
  });
}

export function overdueReport(overdue: OverdueMinutes[]): string {
  if (overdue.length === 0) return '';
  const lines = overdue.map(
    ({ sessionId, daysSinceSession, missing }) =>
      `- Ratsversammlung vom ${sessionId} (vor ${daysSinceSession} Tagen): ${missing.join(', ')} fehlt`,
  );
  return [
    'Für diese Sitzungen fehlen Unterlagen aus ALLRIS länger als üblich. Entweder hat die Stadt sie noch nicht ' +
      'veröffentlicht, oder der ALLRIS-Runner läuft nicht (Log: `~/bots/stadtratwatch-leipzig/logs/minutes.log`).',
    '',
    ...lines,
    '',
    `Fristen ab der Sitzung: Ergebnisse ${DEADLINES_IN_DAYS.resultPages} Tage, Verlaufsprotokoll ` +
      `${DEADLINES_IN_DAYS.verlaufsprotokoll} Tage, Beschlussprotokoll ${DEADLINES_IN_DAYS.beschlussprotokoll} Tage.`,
  ].join('\n');
}

function daysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);
}
