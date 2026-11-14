import { FACTIONLESS_ID, MAYOR_FACTION_ID } from '@models/leipzig-members.ts';
import { factionIdOn } from '@models/person-affiliation.ts';
import type { Registry, RegistryPerson } from '@models/registry.ts';
import type { SessionInput } from '@models/SessionInput.ts';
import { majorityOf } from './FactionAgreement.ts';

export type FactionDeviation = { deviating: number; counted: number };

// How often a member voted differently from the majority of their own faction on the session day: yes against no,
// and also an abstention where the faction voted yes or no. Only the member's cast votes count. A faction split evenly
// has no majority; members without a faction and the mayor have no faction to deviate from.
export function calcFactionDeviationOfPerson(
  parliamentPeriod: Registry,
  person: RegistryPerson,
  sessions: SessionInput[],
): FactionDeviation | null {
  let deviating = 0;
  let counted = 0;
  let hadFaction = false;
  for (const session of sessions) {
    const factionId = factionIdOn(person, session.session.date);
    if (factionId === FACTIONLESS_ID || factionId === MAYOR_FACTION_ID)
      continue;
    hadFaction = true;
    const colleagues = new Set(
      parliamentPeriod.persons
        .filter(
          (candidate) =>
            factionIdOn(candidate, session.session.date) === factionId,
        )
        .map((candidate) => candidate.name),
    );
    for (const voting of session.votings) {
      const own = voting.votes.find((vote) => vote.name === person.name)?.vote;
      if (!own || own === 'O') continue;
      const majority = majorityOf(
        voting.votes
          .filter((vote) => colleagues.has(vote.name))
          .map((vote) => vote.vote),
      );
      if (!majority) continue;
      counted++;
      if (own !== majority) deviating++;
    }
  }
  return hadFaction ? { deviating, counted } : null;
}
