import { expect, test } from 'vitest';
import { compareSortValues, nextSortDirection } from './sortable-table';

test('numbers start with the largest value, text starts with A', () => {
  expect(nextSortDirection('number', undefined)).toBe('descending');
  expect(nextSortDirection('text', undefined)).toBe('ascending');
});

test('a second click on the same column reverses the order', () => {
  expect(nextSortDirection('number', 'descending')).toBe('ascending');
  expect(nextSortDirection('text', 'ascending')).toBe('descending');
});

test('numbers compare as numbers, not as text', () => {
  const values = ['9', '10', '2'];
  expect(
    values.toSorted((a, b) => compareSortValues(a, b, 'number', 'ascending')),
  ).toEqual(['2', '9', '10']);
});

test('rows without a value stay at the end in both directions', () => {
  const values = ['', '0.5', '0.8'];
  expect(
    values.toSorted((a, b) => compareSortValues(a, b, 'number', 'descending')),
  ).toEqual(['0.8', '0.5', '']);
  expect(
    values.toSorted((a, b) => compareSortValues(a, b, 'number', 'ascending')),
  ).toEqual(['0.5', '0.8', '']);
});

test('text follows German order', () => {
  const values = ['Zwickau', 'Ärztin', 'Bach'];
  expect(
    values.toSorted((a, b) => compareSortValues(a, b, 'text', 'ascending')),
  ).toEqual(['Ärztin', 'Bach', 'Zwickau']);
});
