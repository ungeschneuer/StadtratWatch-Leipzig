import { describe, expect, it } from 'bun:test';

import {
  type AnnouncedResult,
  assignAnnouncement,
  findAnnouncedResult,
  joinSplitCompounds,
  parseVtt,
  type SubtitleCue,
} from './subtitle-announcements.ts';

function cues(...texts: string[]): SubtitleCue[] {
  return texts.map((text, index) => ({ startSeconds: 100 + index * 5, endSeconds: 104 + index * 5, text }));
}

function announced(...texts: string[]) {
  return findAnnouncedResult(cues(...texts), 0, 1000);
}

describe('parseVtt', () => {
  it('reads cue timings and text', () => {
    const vtt =
      'WEBVTT\nKind:Caption\n\n00:44:56.720 --> 00:45:01.540\nIhr Votum bitte. \n\n01:00:00.000 --> 01:00:02.500\nZeile eins\nZeile zwei\n';

    expect(parseVtt(vtt)).toEqual([
      { startSeconds: 2696.72, endSeconds: 2701.54, text: 'Ihr Votum bitte.' },
      { startSeconds: 3600, endSeconds: 3602.5, text: 'Zeile eins Zeile zwei' },
    ]);
  });
});

describe('findAnnouncedResult', () => {
  it('reads "zu" announcements', () => {
    expect(announced('Das Ergebnis heisst 28 zu 28 zu 2, damit abgelehnt.')).toMatchObject({ J: 28, N: 28, E: 2 });
  });

  it('flags spoken corrections', () => {
    expect(announced('Und das Ergebnis, Herr Stange wird hinzugezählt, 21 zu 36 zu 0, damit abgelehnt.')).toMatchObject(
      {
        J: 21,
        N: 36,
        E: 0,
        mentionsCorrection: true,
      },
    );
  });

  it('joins announcements split across cues', () => {
    expect(
      announced(
        'Und im Ergebnis heisst das Frau Subert gegen Rot, dann ist das Ergebnis 40 zu',
        '10 zu 12, damit ist der Antrag angenommen.',
      ),
    ).toMatchObject({ J: 40, N: 10, E: 12, atSeconds: 100, mentionsCorrection: false });
  });

  it('reads garbled separators of the AI subtitles', () => {
    expect(announced('Macht im Ergebnis 14 zu 44.0 abgelehnt.')).toMatchObject({ J: 14, N: 44, E: 0 });
    expect(announced('13.33.13 heisst abgelehnt.')).toMatchObject({ J: 13, N: 33, E: 13 });
    expect(announced('Und das Ergebnis lautet 25 zu 37,2, der ist abgelehnt.')).toMatchObject({ J: 25, N: 37, E: 2 });
  });

  it('reads "dafür/dagegen" announcements', () => {
    expect(announced('23 dafür, 28 dagegen bei zwei Enthaltungen, somit abgelehnt.')).toMatchObject({
      J: 23,
      N: 28,
      E: 2,
    });
    expect(announced('25 dafür, 28 dagegen somit abgelehnt.')).toMatchObject({ J: 25, N: 28, E: null });
  });

  it('reads "dafür/dagegen" announcements without result word and with "Nein" or "und"', () => {
    expect(
      announced('So, konnte jeder abstimmen? Ja, ne? Dann 14 dafür, 32 dagegen bei 11 Enthaltungen.'),
    ).toMatchObject({
      J: 14,
      N: 32,
      E: 11,
    });
    expect(announced('46 dafür, 11 Nein und eine Enthaltung, somit mehrheitlich so bestätigt.')).toMatchObject({
      J: 46,
      N: 11,
      E: 1,
    });
    expect(announced('26 dafür, 23 dagegen und einer Enthaltung, damit entfällt der Antrag')).toMatchObject({
      J: 26,
      N: 23,
      E: 1,
    });
    expect(
      announced(
        'So, dann haben wir hier, das hätte ich so jetzt nicht erwartet, 48 dafür, 0',
        'dagegen bei 2 Enthaltung, somit in der geänderten Fassung bestätigt.',
      ),
    ).toMatchObject({ J: 48, N: 0, E: 2 });
  });

  it('leaves the abstentions open when only Ja and Nein are named', () => {
    expect(announced('Das heisst im Ergebnis 22 zu 31 abgelehnt.')).toMatchObject({ J: 22, N: 31, E: null });
  });

  it('splits counts the subtitles ran together, when they exceed the seats', () => {
    expect(announced('Und das Ergebnis heisst 48 zu 92 so beschlossen.')).toMatchObject({ J: 48, N: 9, E: 2 });
  });

  it('flags an added Ja vote as a spoken correction', () => {
    expect(
      announced('Sie sind grünen, nehme ich an, eine Jahrstimme mehr, also 11 zu 48 zu 0 abgelehnt.')
        ?.mentionsCorrection,
    ).toBe(true);
  });

  it('takes the corrected figure when the chair corrects themselves', () => {
    expect(
      announced(
        'das heisst im Ergebnis, Herr Leisner, 11 zu 49 zu 3, damit abgelehnt, 12, Entschuldigung, 12 zu 49 zu 3.',
      ),
    ).toMatchObject({ J: 12, N: 49, E: 3 });
  });

  it('joins counts the subtitles split into units and tens', () => {
    expect(announced('Dann ist das Ergebnis 30 zu 1 und 30 zu 0 damit abgelehnt.')).toMatchObject({
      J: 30,
      N: 31,
      E: 0,
    });
    expect(announced('Und das Ergebnis 40 zu 1, 20 zu 1. Ich gebe zu Protokoll, abgelehnt.')).toMatchObject({
      J: 40,
      N: 21,
      E: 1,
    });
    expect(announced('heisst im Ergebnis 33 zu 1, 3 zu 0, so beschlossen.')).toMatchObject({ J: 33, N: 31, E: 0 });
  });

  it('keeps the text length when joining, so cue offsets stay valid', () => {
    const text = 'Ergebnis 30 zu 1 und 30 zu 0';
    expect(joinSplitCompounds(text)).toHaveLength(text.length);
  });

  it('reads number words between the zu', () => {
    expect(announced('Und das Ergebnis lautet 11 zu 46 zu sechs und dann gibt es den Punkt zwei.')).toMatchObject({
      J: 11,
      N: 46,
      E: 6,
    });
  });

  it('reads a result with a comma before zu', () => {
    expect(announced('Und das Ergebnis? 6 zu 42, zu 18 abgelehnt.')).toMatchObject({ J: 6, N: 42, E: 18 });
  });

  it('does not read an item number before the result as a count', () => {
    expect(announced('Antrag, Beschlusspunkt 1. 18 zu 44 zu 2 abgelehnt.')).toMatchObject({ J: 18, N: 44, E: 2 });
  });

  it('ignores agenda numbers and committee results', () => {
    expect(announced('sind jetzt beschlossen worden, 2.1, 2.2, damit erledigt')).toBeNull();
    expect(announced('das Ergebnis 11 zu 0 zu 0, im Finanzausschuss 11 zu 0 zu 0.')).toBeNull();
  });

  it('ignores numbers without a result word', () => {
    expect(announced('Wir haben 30 zu 20 zu 5 Minuten Redezeit vereinbart.')).toBeNull();
  });

  it('looks only inside the time window', () => {
    expect(findAnnouncedResult(cues('Das Ergebnis heisst 28 zu 28 zu 2, damit abgelehnt.'), 200, 300)).toBeNull();
  });
});

describe('spoken corrections', () => {
  it('flags the phrasings the chair uses to add a vote', () => {
    expect(
      announced('Auch hier, Herr Stange hat zugezählt, macht 45 zu 11 zu 2, so beschlossen.')?.mentionsCorrection,
    ).toBe(true);
    expect(announced('Einmal rot dazu, dann macht das 18 zu 42 zu 0, so abgelehnt.')?.mentionsCorrection).toBe(true);
    expect(announced('Dann einmal grün noch dazu. Das Ergebnis heisst dann 35 zu 19 zu 4.')?.mentionsCorrection).toBe(
      true,
    );
    expect(
      announced('Das Ergebnis, 42 zu 16 zu 1, noch ein Ja dazu, 43 zu 16 zu 1, so beschlossen.')?.mentionsCorrection,
    ).toBe(true);
    expect(announced('Das Ergebnis heisst 28 zu 28 zu 2, damit abgelehnt.')?.mentionsCorrection).toBe(false);
  });
});

describe('assignAnnouncement', () => {
  const said = (J: number, N: number, E: number): AnnouncedResult => ({
    J,
    N,
    E,
    atSeconds: 0,
    quote: `${J} zu ${N} zu ${E}`,
    mentionsCorrection: false,
  });

  it('prefers the announcement that equals the board', () => {
    expect(assignAnnouncement([said(46, 9, 3), said(53, 1, 5)], { J: 53, N: 1, E: 5 }, [])).toEqual(said(53, 1, 5));
  });

  it('leaves an announcement that equals a neighbouring board to that neighbour', () => {
    expect(assignAnnouncement([said(46, 9, 3)], { J: 53, N: 1, E: 5 }, [{ J: 46, N: 9, E: 3 }])).toBeNull();
  });

  it('keeps a differing announcement that belongs to no neighbour, so the mismatch is reviewed', () => {
    expect(assignAnnouncement([said(21, 36, 0)], { J: 20, N: 36, E: 0 }, [{ J: 46, N: 9, E: 3 }])).toEqual(
      said(21, 36, 0),
    );
  });
});
