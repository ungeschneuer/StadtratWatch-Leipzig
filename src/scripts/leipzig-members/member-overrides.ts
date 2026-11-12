// Corrections to the sources, kept in data/<period>/member-overrides.json. Each entry names the OParl person, says why
// and where that is documented, and is applied after every import, so a fresh OParl download never loses it.
export type MemberOverride = {
  personOparlId: string;
  reason: string;
  source: string;
  // Not a member of the council in this period, although OParl lists a membership.
  exclude?: boolean;
  // The name as it should be shown, when OParl misspells it.
  name?: string;
  givenName?: string;
  familyName?: string;
  // The short name of the party, as in the candidates list („SPD“), when the list does not say it.
  party?: string;
  // The day a change of party took effect; without it, `party` holds from the start of the membership. A person may have
  // several such overrides, one per change.
  since?: string;
};

export class MemberOverridesError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'));
  }
}

const CHANGES = ['exclude', 'name', 'givenName', 'familyName', 'party'] as const;

export function parseMemberOverrides(json: unknown, source: string): MemberOverride[] {
  if (!Array.isArray(json)) throw new MemberOverridesError([`${source}: expected a JSON array of overrides`]);
  const problems: string[] = [];
  json.forEach((entry, index) => {
    const at = `${source} entry ${index}`;
    for (const field of ['personOparlId', 'reason', 'source'] as const) {
      if (typeof entry?.[field] !== 'string' || entry[field].trim() === '')
        problems.push(`${at}: ${field} is required`);
    }
    if (!CHANGES.some((change) => entry?.[change] !== undefined)) {
      problems.push(`${at}: needs one of ${CHANGES.join(', ')}`);
    }
    if (entry?.exclude !== undefined && entry.exclude !== true) problems.push(`${at}: exclude can only be true`);
    if (entry?.since !== undefined && (typeof entry.since !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.since))) {
      problems.push(`${at}: since must be a date (YYYY-MM-DD)`);
    }
    if (entry?.since !== undefined && entry?.party === undefined) problems.push(`${at}: since needs a party`);
    for (const field of ['name', 'givenName', 'familyName', 'party'] as const) {
      if (entry?.[field] !== undefined && (typeof entry[field] !== 'string' || entry[field].trim() === '')) {
        problems.push(`${at}: ${field} must be a non-empty string`);
      }
    }
  });
  if (problems.length > 0) throw new MemberOverridesError(problems);
  return json as MemberOverride[];
}
