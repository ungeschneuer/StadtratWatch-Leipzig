import { expect, test } from 'vitest';
import { decodeEmail, encodeEmail, spellOutEmail } from './email-encoding';

test('encodes the address so that it no longer appears as plain text', () => {
  const encoded = encodeEmail('hallo@example.org');
  expect(encoded).not.toContain('@');
  expect(encoded).not.toContain('example');
  expect(decodeEmail(encoded)).toBe('hallo@example.org');
});

test('spells out the address for readers without JavaScript', () => {
  expect(spellOutEmail('hallo@example.org')).toBe(
    'hallo [at] example [punkt] org',
  );
});
