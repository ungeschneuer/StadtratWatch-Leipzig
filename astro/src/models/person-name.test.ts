import { describe, expect, test } from 'vitest';
import { compareNamesForSorting, nameForSorting } from './person-name';

describe('nameForSorting', () => {
  test.each([
    ['Dr. Sabine Heymann', 'Heymann Sabine'],
    ['Dr. med. Nicole Schreyer-Krieg', 'Schreyer-Krieg Nicole'],
    ['Prof. Dr. Getu Abraham', 'Abraham Getu'],
    ['Jürgen Günter Butz', 'Butz Jürgen Günter'],
    ['Dr. Heymann, Sabine', 'Heymann Sabine'],
    ['Prof. Dr. Abraham, Getu', 'Abraham Getu'],
    ['Andreas Nowak', 'Nowak Andreas'],
    ['Drago Neumann', 'Neumann Drago'],
  ])('%s → %s', (name, expected) => {
    expect(nameForSorting(name)).toBe(expected);
  });
});

test('sorts by surname and ignores academic titles', () => {
  const names = [
    'Dr. Sabine Heymann',
    'Falk Dossin',
    'Prof. Dr. Getu Abraham',
    'Andreas Nowak',
    'Dr. med. Nicole Schreyer-Krieg',
    'Jürgen Günter Butz',
  ];
  expect(names.toSorted(compareNamesForSorting)).toEqual([
    'Prof. Dr. Getu Abraham',
    'Jürgen Günter Butz',
    'Falk Dossin',
    'Dr. Sabine Heymann',
    'Andreas Nowak',
    'Dr. med. Nicole Schreyer-Krieg',
  ]);
});

test('reads board names in surname-first order', () => {
  expect(
    ['Dr. Heymann, Sabine', 'Albrecht, Karsten'].toSorted(
      compareNamesForSorting,
    ),
  ).toEqual(['Albrecht, Karsten', 'Dr. Heymann, Sabine']);
});
