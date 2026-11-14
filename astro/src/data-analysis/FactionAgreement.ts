import { FACTIONLESS_ID, MAYOR_FACTION_ID } from '@models/leipzig-members.ts';
import { factionIdOn } from '@models/person-affiliation.ts';
import type { Registry, RegistryFaction } from '@models/registry.ts';
import type { SessionInput } from '@models/SessionInput.ts';
import type { VoteCode } from '@models/Session.ts';

export type PairAgreement = { agreeing: number; counted: number };

export type FactionAgreement = {
  factions: RegistryFaction[];
  pair(a: string, b: string): PairAgreement;
};

// How often two factions voted the same way: the majority of each faction's cast votes on the session day, compared
// vote by vote. A vote counts for a pair only when both factions had a majority; members without a faction and the
// mayor are no faction.
export function calcFactionAgreement(
  parliamentPeriod: Registry,
  sessions: SessionInput[],
): FactionAgreement {
  const factions = parliamentPeriod.factions.filter(
    (faction) =>
      faction.id !== FACTIONLESS_ID && faction.id !== MAYOR_FACTION_ID,
  );
  const pairs = new Map<string, PairAgreement>();
  const keyOf = (a: string, b: string) => [a, b].sort().join('|');

  for (const session of sessions) {
    const factionOf = new Map(
      parliamentPeriod.persons.map((person) => [
        person.name,
        factionIdOn(person, session.session.date),
      ]),
    );
    for (const voting of session.votings) {
      const majorities = new Map(
        factions.map((faction) => [
          faction.id,
          majorityOf(
            voting.votes
              .filter((vote) => factionOf.get(vote.name) === faction.id)
              .map((vote) => vote.vote),
          ),
        ]),
      );
      for (const [index, a] of factions.entries()) {
        for (const b of factions.slice(index + 1)) {
          const majorityA = majorities.get(a.id);
          const majorityB = majorities.get(b.id);
          if (!majorityA || !majorityB) continue;
          const pair = pairs.get(keyOf(a.id, b.id)) ?? {
            agreeing: 0,
            counted: 0,
          };
          pair.counted++;
          if (majorityA === majorityB) pair.agreeing++;
          pairs.set(keyOf(a.id, b.id), pair);
        }
      }
    }
  }
  return {
    factions,
    pair: (a, b) => pairs.get(keyOf(a, b)) ?? { agreeing: 0, counted: 0 },
  };
}

export function majorityOf(votes: VoteCode[]): VoteCode | null {
  const counts = new Map<VoteCode, number>();
  for (const vote of votes)
    if (vote !== 'O') counts.set(vote, (counts.get(vote) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0 || ranked[1]?.[1] === ranked[0][1]) return null;
  return ranked[0][0];
}
