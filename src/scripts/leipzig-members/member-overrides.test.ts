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

  it('rejects a file that is no array', () => {
    expect(() => parseMemberOverrides({}, 'member-overrides.json')).toThrow('expected a JSON array');
  });
});
