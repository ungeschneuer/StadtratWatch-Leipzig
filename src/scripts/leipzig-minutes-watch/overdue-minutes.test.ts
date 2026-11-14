import { describe, expect, it } from 'bun:test';

import { overdueMinutes, overdueReport } from './overdue-minutes.ts';

const complete = { minutesKind: 'beschlussprotokoll', hasVerlaufsprotokoll: true } as const;

describe('overdueMinutes', () => {
  it('names nothing while the deadlines run', () => {
    expect(
      overdueMinutes(
        [{ sessionId: '2026-10-29', minutesKind: 'agenda-item-pages', hasVerlaufsprotokoll: true }],
        '2026-11-14',
      ),
    ).toEqual([]);
  });

  it('names what is missing once a deadline has passed', () => {
    expect(
      overdueMinutes(
        [
          { sessionId: '2026-09-30', ...complete },
          { sessionId: '2026-09-02', minutesKind: 'agenda-item-pages', hasVerlaufsprotokoll: false },
          { sessionId: '2026-10-28', minutesKind: null, hasVerlaufsprotokoll: false },
        ],
        '2026-11-20',
      ),
    ).toEqual([
      { sessionId: '2026-09-02', daysSinceSession: 79, missing: ['Verlaufsprotokoll', 'Beschlussprotokoll'] },
      { sessionId: '2026-10-28', daysSinceSession: 23, missing: ['Ergebnisse in ALLRIS'] },
    ]);
  });

  // No session in July and August: the last one before the break is complete, so the break raises nothing.
  it('stays quiet in the summer break', () => {
    expect(overdueMinutes([{ sessionId: '2026-07-02', ...complete }], '2026-08-31')).toEqual([]);
  });
});

describe('overdueReport', () => {
  it('is empty when nothing is overdue, so the issue can be closed', () => {
    expect(overdueReport([])).toEqual('');
  });

  it('lists the sessions and the deadlines', () => {
    const report = overdueReport([
      { sessionId: '2026-10-28', daysSinceSession: 23, missing: ['Ergebnisse in ALLRIS'] },
    ]);
    expect(report).toContain('- Ratsversammlung vom 2026-10-28 (vor 23 Tagen): Ergebnisse in ALLRIS fehlt');
    expect(report).toContain('Beschlussprotokoll 75 Tage');
  });
});
