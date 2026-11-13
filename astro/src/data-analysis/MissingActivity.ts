import type { RegistryPerson } from '@models/registry.ts';
import type { SessionInput } from '@models/SessionInput.ts';
import { isPersonInSession } from '@utils/session-utils.ts';

// Why a member has no vote on the site: the city records the sessions only since a certain day, so members who left
// before have none; others were members while sessions were recorded but took part in no vote with a board.
export type MissingActivity =
  | {
      reason: 'left-before-recordings';
      end: string;
      firstRecordedSession: string;
    }
  | { reason: 'no-vote-while-member'; recordedSessions: number };

export function missingActivityOf(
  person: RegistryPerson,
  sessionInputs: SessionInput[],
): MissingActivity | null {
  const hasVoted = sessionInputs.some((sessionInput) =>
    sessionInput.votings.some((voting) =>
      voting.votes.some(
        (vote) => vote.name === person.name && vote.vote !== 'O',
      ),
    ),
  );
  if (hasVoted) return null;

  const recordedSessions = sessionInputs
    .map((sessionInput) => sessionInput.session.date)
    .sort();
  const firstRecordedSession = recordedSessions[0];
  if (
    person.end !== null &&
    firstRecordedSession !== undefined &&
    person.end < firstRecordedSession
  ) {
    return {
      reason: 'left-before-recordings',
      end: person.end,
      firstRecordedSession,
    };
  }
  return {
    reason: 'no-vote-while-member',
    recordedSessions: sessionInputs.filter((sessionInput) =>
      isPersonInSession(person, sessionInput.session),
    ).length,
  };
}
