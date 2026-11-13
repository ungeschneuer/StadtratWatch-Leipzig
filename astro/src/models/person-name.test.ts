import { describe, expect, test } from 'vitest';
import { compareNamesForSorting, nameForSorting } from './person-name';

describe('nameForSorting', () => {
  test.each([
    ['Dr. Sabine Heymann', 'Sabine Heymann'],
    ['Dr. med. Nicole Schreyer-Krieg', 'Nicole Schreyer-Krieg'],
    ['Prof. Dr. Getu Abraham', 'Getu Abraham'],
    ['Dr. Heymann, Sabine', 'Heymann, Sabine'],
    ['Prof. Dr. Abraham, Getu', 'Abraham, Getu'],
    ['Andreas Nowak', 'Andreas Nowak'],
    ['Drago Neumann', 'Drago Neumann'],
  ])('%s → %s', (name, expected) => {
    expect(nameForSorting(name)).toBe(expected);
  });
});

test('sorts names as if they had no academic title', () => {
  const names = [
    'Dr. Sabine Heymann',
    'Falk Dossin',
    'Prof. Dr. Getu Abraham',
    'Andreas Nowak',
    'Dr. med. Nicole Schreyer-Krieg',
  ];
  expect(names.toSorted(compareNamesForSorting)).toEqual([
    'Andreas Nowak',
    'Falk Dossin',
    'Prof. Dr. Getu Abraham',
    'Dr. med. Nicole Schreyer-Krieg',
    'Dr. Sabine Heymann',
  ]);
});
