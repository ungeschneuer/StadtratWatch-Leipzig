import { expect, test } from 'vitest';
import { describeUnassignedVotes } from './unassigned-votes';

test('names the votes counted by hand without a name', () => {
  expect(describeUnassignedVotes({ J: 1, N: 0, E: 0 })).toBe(
    'Von Hand gezählt, ohne dass jemand genannt wurde: 1 Ja-Stimme.',
  );
  expect(describeUnassignedVotes({ J: 0, N: 2, E: 1 })).toBe(
    'Von Hand gezählt, ohne dass jemand genannt wurde: 2 Nein-Stimmen und 1 Enthaltung.',
  );
});

test('names votes on the board the official result does not count', () => {
  expect(describeUnassignedVotes({ J: 0, N: 0, E: -2 })).toBe(
    'Das amtliche Ergebnis zählt 2 Enthaltungen weniger als die Tafel, ohne zu sagen, bei wem.',
  );
});

test('says nothing when every vote is assigned', () => {
  expect(describeUnassignedVotes({ J: 0, N: 0, E: 0 })).toBe('');
});
