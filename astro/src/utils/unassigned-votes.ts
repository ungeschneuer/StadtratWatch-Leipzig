type VoteCounts = { J: number; N: number; E: number };

const VOTE_NAMES = {
  J: ['Ja-Stimme', 'Ja-Stimmen'],
  N: ['Nein-Stimme', 'Nein-Stimmen'],
  E: ['Enthaltung', 'Enthaltungen'],
} as const;

function listVotes(counts: VoteCounts): string {
  const parts = (Object.keys(VOTE_NAMES) as (keyof VoteCounts)[])
    .filter((code) => counts[code] > 0)
    .map((code) => {
      const [singular, plural] = VOTE_NAMES[code];
      return `${counts[code]} ${counts[code] === 1 ? singular : plural}`;
    });
  return parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} und ${parts.at(-1)}`
    : (parts[0] ?? '');
}

// The difference between the official result and the votes a reviewer could assign, in words for the vote's page.
export function describeUnassignedVotes(unassigned: VoteCounts): string {
  const added = listVotes({
    J: Math.max(unassigned.J, 0),
    N: Math.max(unassigned.N, 0),
    E: Math.max(unassigned.E, 0),
  });
  const removed = listVotes({
    J: Math.max(-unassigned.J, 0),
    N: Math.max(-unassigned.N, 0),
    E: Math.max(-unassigned.E, 0),
  });
  return [
    added && `Von Hand gezählt, ohne dass jemand genannt wurde: ${added}.`,
    removed &&
      `Das amtliche Ergebnis zählt ${removed} weniger als die Tafel, ohne zu sagen, bei wem.`,
  ]
    .filter(Boolean)
    .join(' ');
}
