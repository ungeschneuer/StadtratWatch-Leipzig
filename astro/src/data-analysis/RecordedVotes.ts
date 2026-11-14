import type { Registry, RegistryPerson } from '@models/registry.ts';
import type { SessionInput } from '@models/SessionInput.ts';

// The site shows only members with at least one recorded yes, no or abstention. Members who left before the city
// began recording, or who were on the board without ever voting, would only show empty values; they stay in the data
// and in the analyses, but not in the lists and have no page of their own.
export function hasRecordedVote(
  person: RegistryPerson,
  sessionInputs: SessionInput[],
): boolean {
  return sessionInputs.some((sessionInput) =>
    sessionInput.votings.some((voting) =>
      voting.votes.some(
        (vote) => vote.name === person.name && vote.vote !== 'O',
      ),
    ),
  );
}

export function personsWithRecordedVotes(
  parliamentPeriod: Registry,
  sessionInputs: SessionInput[],
): RegistryPerson[] {
  return parliamentPeriod.persons.filter((person) =>
    hasRecordedVote(person, sessionInputs),
  );
}
