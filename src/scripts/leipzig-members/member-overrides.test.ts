import { describe, expect, it } from 'bun:test';

import { MemberOverridesError, parseMemberOverrides } from './member-overrides.ts';

describe('parseMemberOverrides', () => {
  it('accepts an override with reason, source and a change', () => {
    const overrides = [{ personOparlId: 'p/1', party: 'SPD', reason: 'not on the list', source: 'OB-Wahl 2020' }];

    expect(parseMemberOverrides(overrides, 'member-overrides.json')).toEqual(overrides);
  });

  it('names every problem of a broken file', () => {
    expect(() => parseMemberOverrides([{ personOparlId: 'p/1', exclude: false }], 'member-overrides.json')).toThrow(
      new MemberOverridesError([
        'member-overrides.json entry 0: reason is required',
        'member-overrides.json entry 0: source is required',
        'member-overrides.json entry 0: exclude can only be true',
      ]),
    );
  });

  it('needs a date and a party for a party change', () => {
    expect(() =>
      parseMemberOverrides([{ personOparlId: 'p/1', since: '1.7.2025', reason: 'r', source: 's' }], 'o.json'),
    ).toThrow(
      new MemberOverridesError([
        'o.json entry 0: needs one of exclude, name, givenName, familyName, party',
        'o.json entry 0: since must be a date (YYYY-MM-DD)',
        'o.json entry 0: since needs a party',
      ]),
    );
  });

  it('rejects a file that is no array', () => {
    expect(() => parseMemberOverrides({}, 'member-overrides.json')).toThrow('expected a JSON array');
  });
});
