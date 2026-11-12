import { describe, expect, it } from 'bun:test';

import { parseContributions, parseVerlaufsprotokoll } from './verlaufsprotokoll.ts';

// Lines as the Verlaufsprotokoll of 28.01.2026 has them, shortened.
const lines = [
  'RATSVERSAMMLUNG VOM 28. JANUAR 2026',
  '14.17 Einführung der „Brötchentaste“ in',
  'Leipzig',
  '14.17.1 dazu Änderungsantrag (VIII-A-01935-',
  'Oberbürgermeister Jung: Herr Kriegel, bitte.',
  'Stadtrat Kriegel (AfD): 99 Prozent der Bäcker',
  'Oberbürgermeister Jung: Ihr Votum bitte zum Än-',
  'derungsantrag der BSW-Fraktion. - Frau Nagel',
  'noch nicht. Es kommt einmal Rot dazu.',
  'Abstimmung: 33 - 33 - 0. Damit abgelehnt.',
  'V e r l a u f s p r o t o k o l l v o m 2 8 . 0 1 . 2 0 2 6 S e i t e | 3 4',
  'Ich bitte um Ihr Votum zum Ursprungsantrag.',
  'Abstimmung: 32 - 34 - 0. Ebenfalls abgelehnt.',
  'Abstimmung: Einstimmig so beschlossen.',
];

describe('parseVerlaufsprotokoll', () => {
  const results = parseVerlaufsprotokoll(lines, new Set(['14', '14.17', '14.17.1']));

  it('reads every numbered result in order with the agenda items before it', () => {
    expect(results.map((result) => [result.agendaItemNumbers, `${result.J}/${result.N}/${result.E}`])).toEqual([
      [['14.17'], '33/33/0'],
      [['14.17'], '32/34/0'],
    ]);
  });

  it('keeps what was said before the result, without hyphenation and page headers', () => {
    expect(results[0].context).toContain(
      'Ihr Votum bitte zum Änderungsantrag der BSW-Fraktion. - Frau Nagel noch nicht.',
    );
    expect(results[1].context).toEqual('Ich bitte um Ihr Votum zum Ursprungsantrag.');
  });

  it('takes a number at the start of a text line for a heading only if the agenda has it', () => {
    expect(results.every((result) => !result.agendaItemNumbers.includes('99'))).toBe(true);
  });
});

// Lines as the Verlaufsprotokolle of 2026 have them, shortened.
const speechLines = [
  'RATSVERSAMMLUNG LEIPZIG 03. SEPTEMBER 2026',
  '1 Begrüßung und Eröffnung',
  'Oberbürgermeister Jung: Meine sehr verehrten',
  'Damen und Herren! Wir möchten gerne die Ratsver-',
  'sammlung fortsetzen.',
  '13.20 Leerstand bekämpfen - Zweckentfrem-',
  'deten Wohnraum enteignen (VIII-A-',
  '02842)',
  'Eingereicht von: Fraktion Bündnis 90/Die',
  'Grünen',
  'Frau Nagel, bitte schön.',
  'Stadträtin Nagel (DIE LINKE): Sehr geehrter',
  'Herr Oberbürgermeister! Frau Riekewald hat es',
  'gesagt: Die Hürden sind hoch.',
  'Vielen Dank.',
  'V e r l a u f s p r o t o k o l l - 0 3 . 0 9 . 2 0 2 6 S e i t e | 2',
  'Und noch ein Satz zum Schluss, der weitergeht.',
  'Stadträtin Herbst-Weckel (Bündnis 90/Die Grü-',
  'nen): Danke.',
  'Herr K. (Einwohner): Meine Frage ist kurz.',
  'Oberbürgermeister Jung: Ihr Votum, bitte.',
  'Abstimmung: 39 - 11 - 10. Ebenfalls positiv vo-',
  'tiert.',
  'Herr Bonew, ich darf Sie bitten, zu übernehmen.',
  '(Übergabe der Sitzungsleitung an Bürgermeister',
  'Bonew)',
  'Bürgermeister Bonew: Herr Bütow, bitte.',
  'Stadtrat Bütow (AfD): Danke.',
  'Bürgermeister Dienberg: Dazu eine Anmerkung.',
  '(Sitzungsunterbrechung)',
  'Bürgermeister Bonew: Wir setzen fort.',
  'Oberbürgermeister: ___________________________________',
  'Protokollantin: Julia Kostka',
];

describe('parseContributions', () => {
  const contributions = parseContributions(speechLines, new Set(['1', '13', '13.20']));
  const speakers = contributions.map(({ speaker, isChair }) => `${speaker.name}${isChair ? ' (chair)' : ''}`);

  it('starts a contribution at each speaker heading, and gives what follows a heading or result to the chair', () => {
    expect(speakers).toEqual([
      'Jung (chair)',
      'Jung (chair)',
      'Nagel',
      'Herbst-Weckel',
      'K.',
      'Jung (chair)',
      'Jung (chair)',
      'Bonew (chair)',
      'Bütow',
      'Dienberg',
      'Bonew (chair)',
    ]);
  });

  it('reads title and faction, also from a heading that wraps in its brackets', () => {
    expect(contributions[2].speaker).toEqual({ title: 'Stadträtin', name: 'Nagel', group: 'DIE LINKE' });
    expect(contributions[3].speaker.group).toEqual('Bündnis 90/Die Grünen');
    expect(contributions[4].speaker).toEqual({ title: 'Herr', name: 'K.', group: 'Einwohner' });
  });

  it('keeps the text without hyphenation, page headers, agenda headings and submitters', () => {
    expect(contributions[0].text).toEqual(
      'Meine sehr verehrten Damen und Herren! Wir möchten gerne die Ratsversammlung fortsetzen.',
    );
    expect(contributions[1].text).toEqual('Frau Nagel, bitte schön.');
    expect(contributions[2].text).toEqual(
      'Sehr geehrter Herr Oberbürgermeister! Frau Riekewald hat es gesagt: Die Hürden sind hoch.\n\nVielen Dank.\n\nUnd noch ein Satz zum Schluss, der weitergeht.',
    );
  });

  it('ends the chair turn after a result, the result line included even when it wraps', () => {
    expect(contributions[5].text).toEqual('Ihr Votum, bitte.\n\nAbstimmung: 39 - 11 - 10. Ebenfalls positiv votiert.');
    expect(contributions[6]).toMatchObject({ afterResult: 0, text: 'Herr Bonew, ich darf Sie bitten, zu übernehmen.' });
  });

  it('records the agenda items of each contribution', () => {
    expect(contributions[0].agendaItemNumbers).toEqual(['1']);
    expect(contributions[2].agendaItemNumbers).toEqual(['13.20']);
  });

  it('stops at the signatures', () => {
    expect(contributions.at(-1)?.text).toEqual('Wir setzen fort.');
  });
});
