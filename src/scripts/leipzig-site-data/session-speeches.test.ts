import { describe, expect, it } from 'bun:test';

import type { LeipzigMembersFile, LeipzigPerson } from '@srw-astro/models/leipzig-members';

import type { SubtitleCue } from '../leipzig-votings/subtitle-announcements.ts';
import type { VerlaufContribution, VerlaufSpeaker } from '../leipzig-votings/verlaufsprotokoll.ts';
import { speakerOf, tiesBetween, timedWordsOf, toSessionSpeeches, wordsOf } from './session-speeches.ts';

function person(name: string, familyName: string, factionId: string, partyId: string): LeipzigPerson {
  return {
    id: name.toLowerCase().replaceAll(' ', '-'),
    name,
    factionId,
    partyId,
    start: null,
    end: null,
    familyName,
    factionMemberships: [{ factionId, start: '2024-09-18', end: null }],
    partyMemberships: [{ partyId, start: '2024-09-18', end: null }],
  } as unknown as LeipzigPerson;
}

const members = {
  factions: [
    { id: 'die-linke', name: 'DIE LINKE', seats: 12, oparlId: 'o/1', oparlName: 'Fraktion DIE LINKE' },
    { id: 'spd', name: 'SPD', seats: 7, oparlId: 'o/2', oparlName: 'SPD-Fraktion' },
    { id: 'die-freie-fraktion', name: 'Die Freie Fraktion', seats: 5, oparlId: 'o/3', oparlName: 'Die Freie Fraktion' },
    { id: 'oberbuergermeister', name: 'Oberbürgermeister', seats: 1, oparlId: null, oparlName: null },
  ],
  parties: [
    { id: 'die-linke', name: 'DIE LINKE', seats: 12 },
    { id: 'spd', name: 'SPD', seats: 7 },
    { id: 'fdp', name: 'FDP', seats: 2 },
    { id: 'spd-mayor', name: 'SPD', seats: 1 },
  ],
  persons: [
    person('Burkhard Jung', 'Jung', 'oberbuergermeister', 'spd'),
    person('Juliane Nagel', 'Nagel', 'die-linke', 'die-linke'),
    person('Anja Nagel', 'Nagel', 'spd', 'spd'),
    person('René Hobusch', 'Hobusch', 'die-freie-fraktion', 'fdp'),
    person('Dr. med. Nicole Schreyer-Krieg', 'Schreyer-Krieg', 'spd', 'spd'),
  ],
} as unknown as LeipzigMembersFile;

function contribution(speaker: VerlaufSpeaker, text: string, isChair = false): VerlaufContribution {
  return { order: 0, speaker, isChair, agendaItemNumbers: [], afterResult: null, text };
}

describe('speakerOf', () => {
  const nameOf = (speaker: VerlaufSpeaker) => speakerOf(contribution(speaker, ''), members, '2026-09-03');

  it('names a councillor as members.json does, told apart by faction', () => {
    expect(nameOf({ title: 'Stadträtin', name: 'Nagel', group: 'DIE LINKE' }).name).toEqual('Juliane Nagel');
    expect(nameOf({ title: 'Stadträtin', name: 'Nagel', group: 'SPD' }).name).toEqual('Anja Nagel');
  });

  it('accepts the party for the faction, and one part of a double name', () => {
    expect(nameOf({ title: 'Stadtrat', name: 'Hobusch', group: 'FDP' }).name).toEqual('René Hobusch');
    expect(nameOf({ title: 'Stadträtin', name: 'Dr. Schreyer', group: 'SPD' }).name).toEqual(
      'Dr. med. Nicole Schreyer-Krieg',
    );
  });

  it('names the mayor as a member, deputies and guests as printed', () => {
    expect(nameOf({ title: 'Oberbürgermeister', name: 'Jung', group: null }).name).toEqual('Burkhard Jung');
    expect(nameOf({ title: 'Bürgermeister', name: 'Dienberg', group: null })).toEqual({
      name: 'Bürgermeister Dienberg',
      onBehalfOf: null,
      hidden: false,
    });
    expect(nameOf({ title: 'Herr', name: 'Achtner', group: 'Ortschaftsrat Böhlitz-Ehrenberg' }).onBehalfOf).toEqual(
      'Ortschaftsrat Böhlitz-Ehrenberg',
    );
  });

  it('hides residents, who are private persons', () => {
    expect(nameOf({ title: 'Frau', name: 'T.', group: 'Einwohnerin' }).hidden).toBe(true);
  });

  it('keeps an unknown councillor as printed, with a warning', () => {
    expect(nameOf({ title: 'Stadtrat', name: 'Wehmann', group: 'DIE LINKE' })).toMatchObject({
      name: 'Stadtrat Wehmann',
      warning: 'Stadtrat Wehmann (DIE LINKE): no councillor of this name on 2026-09-03',
    });
  });
});

function cue(startSeconds: number, endSeconds: number, text: string): SubtitleCue {
  return { startSeconds, endSeconds, text };
}

describe('tiesBetween', () => {
  it('ties word sequences that occur once on both sides, in order', () => {
    const protocol = wordsOf('eins zwei drei vier fünf sechs sieben acht neun zehn');
    const spoken = timedWordsOf([cue(10, 20, 'eins zwei drei vier fünf sechs sieben acht neun zehn')]);
    expect(tiesBetween(protocol, spoken).map(({ protocolIndex, seconds }) => [protocolIndex, seconds])).toEqual([
      [0, 10],
      [1, 11],
      [2, 12],
      [3, 13],
      [4, 14],
      [5, 15],
    ]);
  });

  it('drops a tie that would run against the order of the others', () => {
    const protocol = wordsOf('a b c d e f g h i j k l m n o p q r s t');
    const spoken = timedWordsOf([cue(0, 10, 'p q r s t'), cue(10, 30, 'a b c d e f g h i j k l m n o')]);
    const ties = tiesBetween(protocol, spoken);
    expect(ties.length).toBeGreaterThan(1);
    expect(ties.every(({ seconds }) => seconds >= 10)).toBe(true);
  });
});

describe('toSessionSpeeches', () => {
  const chair = { title: 'Oberbürgermeister', name: 'Jung', group: null };
  const nagel = { title: 'Stadträtin', name: 'Nagel', group: 'DIE LINKE' };
  const contributions = [
    contribution(chair, 'Meine Damen und Herren wir setzen die Sitzung fort und rufen den Antrag auf', true),
    contribution(nagel, 'Sehr geehrter Herr Oberbürgermeister es geht heute um den Leerstand in unserer Stadt'),
    contribution({ title: 'Frau', name: 'T.', group: 'Einwohnerin' }, 'Meine Frage betrifft die Schule im Ortsteil'),
  ];
  const cues = [
    cue(100, 105, 'Meine Damen und Herren, wir setzen die Sitzung fort'),
    cue(105, 108, 'und rufen den Antrag auf.'),
    // Ten minutes in which Frau Nagel walks to the lectern and the protocol records nothing.
    cue(700, 706, 'Sehr geehrter Herr Oberbürgermeister, es geht heute um den Leerstand'),
    cue(706, 708, 'in unserer Stadt.'),
    cue(720, 726, 'Meine Frage betrifft die Schule im Ortsteil.'),
  ];
  const result = toSessionSpeeches('2026-09-03', contributions, cues, members);

  it('times each contribution by its words in the subtitles, leaving out a silent gap', () => {
    expect(result.speeches.map(({ speaker, start, duration }) => [speaker, start, duration])).toEqual([
      ['Burkhard Jung', 100, 8],
      ['Juliane Nagel', 700, 8],
    ]);
  });

  it('marks the chair and keeps the protocol text', () => {
    expect(result.speeches[0].isChairPerson).toBe(true);
    expect(result.speeches[1]).not.toHaveProperty('isChairPerson');
    expect(result.speeches[1].transcription).toStartWith('Sehr geehrter Herr Oberbürgermeister');
  });

  it('counts the contributions with a tie of their own', () => {
    expect(result.stats).toMatchObject({ contributions: 3, tied: 3 });
  });
});
