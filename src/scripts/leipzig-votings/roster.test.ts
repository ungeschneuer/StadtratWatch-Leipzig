import { describe, expect, it } from 'bun:test';

import { matchBoardName, type RosterPerson } from './roster.ts';

function person(personId: string, givenName: string, familyName: string): RosterPerson {
  return { personId, name: `${givenName} ${familyName}`, givenName, familyName };
}

const roster = [
  person('1', 'Danilo', 'Streller'),
  person('2', 'André', 'Möllmer'),
  person('3', 'Getu', 'Abraham'),
  person('4', 'CHristoph', 'Neumann'),
  person('5', 'Andreas', 'Nowak'),
  person('6', 'Andreas', 'Schultz'),
  person('7', 'Jürgen Günter', 'Butz'),
];

describe('matchBoardName', () => {
  it('matches despite titles, lost accents and capitalisation', () => {
    expect(matchBoardName('Möllmer, Andre', roster).person?.personId).toEqual('2');
    expect(matchBoardName('Prof. Dr. Abraham, Getu', roster).person?.personId).toEqual('3');
    expect(matchBoardName('Neumann, CHristoph', roster).person?.personId).toEqual('4');
    expect(matchBoardName('Butz, Jürgen Günter', roster).person?.personId).toEqual('7');
  });

  it('tolerates a misread letter', () => {
    expect(matchBoardName('Streiler, Danilo', roster)).toMatchObject({ person: { personId: '1' }, distance: 1 });
  });

  it('ignores a cell border read as a character', () => {
    expect(matchBoardName('| Streller, Danilo', roster)).toMatchObject({ person: { personId: '1' } });
  });

  it('rejects names that are not on the roster', () => {
    expect(matchBoardName('Weickert, Michael', roster).person).toBeNull();
  });

  it('rejects ambiguous names', () => {
    const twins = [person('1', 'Anna', 'Meier'), person('2', 'Anja', 'Meier')];

    expect(matchBoardName('Meier, Ann', twins).person).toBeNull();
  });
});
