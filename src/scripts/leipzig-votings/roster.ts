export type RosterPerson = {
  personId: string;
  name: string;
  familyName: string;
  givenName: string;
  // OParl starts a successor's membership on the day after the session that swore them in, where they already vote.
  joinsAfterSessionDay?: boolean;
};

export type RosterMatch = { person: RosterPerson; distance: number } | { person: null; reason: string };

const TITLES = /\b(?:Prof|Dr|med|rer|nat|phil|habil|Dipl|Ing)\b\.?/gi;

// Board names read "Dr. Heymann, Sabine". OCR may drop accents or confuse single letters ("Streiler" for "Streller"),
// so the closest roster entry wins if it is clearly closer than the runner-up.
export function matchBoardName(boardName: string, roster: RosterPerson[]): RosterMatch {
  const [familyPart, givenPart = ''] = boardName.replace(TITLES, '').split(',');
  const boardKey = nameKey(familyPart, givenPart);
  const ranked = roster
    .map((person) => ({ person, distance: editDistance(boardKey, nameKey(person.familyName, person.givenName)) }))
    .sort((a, b) => a.distance - b.distance);
  const [best, runnerUp] = ranked;
  if (!best) {
    return { person: null, reason: 'empty roster' };
  }
  const allowedDistance = Math.max(2, Math.floor(boardKey.length / 6));
  if (best.distance > allowedDistance) {
    return { person: null, reason: `no roster name close to "${boardName}"` };
  }
  if (runnerUp && runnerUp.distance - best.distance < 2) {
    return { person: null, reason: `"${boardName}" is ambiguous` };
  }
  return best;
}

function nameKey(familyName: string, givenName: string): string {
  const firstGivenName = givenName.trim().split(/\s+/)[0] ?? '';
  return `${simplify(familyName)}|${simplify(firstGivenName)}`;
}

function simplify(text: string): string {
  return text
    .normalize('NFKD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .replaceAll('ß', 'ss')
    .toLowerCase()
    .replaceAll(/[^a-z]/g, '');
}

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}
