import { getStaticPaths as getStaticParliamentPeriodPaths } from '../../[parliamentPeriodId].json.ts';
import { generateMeta } from '../../../_helpers.ts';
import { getEntry } from 'astro:content';
import { getVideoTimestampAsSeconds } from '@utils/session-utils.ts';
import type { Registry, RegistrySession } from '@models/registry.ts';
import {
  decidedByMayor,
  getVotingId,
  votingAccepted,
} from '@models/voting-breakdown.ts';
import type { VoteCode } from '@models/Session.ts';
import { getMajorityRequirement } from '@models/session-scan.ts';

export const getStaticPaths = async () => {
  const paths = await getStaticParliamentPeriodPaths();
  return paths.flatMap((path) =>
    path.props.parliamentPeriod.sessions.map((session) => ({
      params: {
        parliamentPeriodId: path.params.parliamentPeriodId,
        sessionId: session.id,
      },
      props: {
        parliamentPeriod: path.props.parliamentPeriod,
        session,
      },
    })),
  );
};

const apiVoteByVoteCode: Record<VoteCode, string> = {
  J: 'yes',
  N: 'no',
  E: 'abstain',
  O: 'no_show',
};

export async function GET({
  params,
  props,
}: {
  params: { parliamentPeriodId: string; sessionId: string };
  props: { parliamentPeriod: Registry; session: RegistrySession };
}) {
  const { parliamentPeriodId, sessionId } = params;

  const sessionScansEntry = await getEntry(
    'sessionScans',
    `${parliamentPeriodId}/${sessionId}`,
  );
  const { data: sessionScans } = sessionScansEntry || {};
  if (!sessionScans) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const { parliamentPeriod } = props;
  const personsMap = new Map(
    parliamentPeriod.persons.map((person) => [person.name, person]),
  );
  const data = sessionScans.map((scan) => ({
    id: getVotingId(scan),
    videoTimestamp: getVideoTimestampAsSeconds(scan),
    votingSubject: scan.votingSubject,
    // personId is the readable key of the site's addresses; personOparlId stays when a name is corrected.
    votes: scan.votes.map((vote) => ({
      personId: personsMap.get(vote.name)?.id,
      personOparlId: personsMap.get(vote.name)?.oparlId ?? null,
      vote: apiVoteByVoteCode[vote.vote],
    })),
    majorityRequirement: getMajorityRequirement(scan),
    presentMembers: scan.presentMembers ?? null,
    result: votingAccepted(parliamentPeriod, scan) ? 'accepted' : 'rejected',
    reviewStatus: scan.reviewStatus ?? null,
    decidedByMayor: decidedByMayor(parliamentPeriod, scan, props.session.date),
    recusedPersonIds: (scan.recusedPersons ?? []).map(
      (name) => personsMap.get(name)?.id ?? null,
    ),
  }));

  const response = {
    meta: generateMeta(),
    data,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
