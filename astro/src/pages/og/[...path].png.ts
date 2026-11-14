import type { APIRoute, GetStaticPaths } from 'astro';
import {
  getParliamentPeriodWithFactionPaths,
  getParliamentPeriodWithPartyPaths,
  getParliamentPeriodWithPersonPaths,
  getParliamentPeriodWithSessionAndVotingPaths,
  getParliamentPeriodWithSessionPaths,
  getParliamentPeriodWithSessionsPaths,
} from '../wahlperiode-[parliamentPeriodNumber]/_helpers';
import { renderOgImage, type OgImageContent } from '@utils/og-image';
import { formatDate } from '@utils/format-date';
import { formatNumber } from '@utils/format-number';
import { factionIdOn, partyIdOn } from '@models/person-affiliation';
import { getVoteCounts, votingAccepted } from '@models/voting-breakdown';
import { DEFAULT_PARLIAMENT_PERIOD } from 'astro:env/server';

// One preview image per page that names one thing: a vote, a session, a person, a faction, a party; every other page
// shares the image of the start page.
type ImagePath = {
  params: { path: string };
  props: { content: OgImageContent };
};

function countOf(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

export const getStaticPaths = (async () => {
  const images: ImagePath[] = [];
  const image = (path: string, content: OgImageContent) =>
    images.push({ params: { path }, props: { content } });

  for (const { props } of await getParliamentPeriodWithSessionsPaths()) {
    if (props.parliamentPeriod.id !== DEFAULT_PARLIAMENT_PERIOD) continue;
    const votings = props.sessionInputs.flatMap(
      (sessionInput) => sessionInput.votings,
    );
    image('start', {
      title: 'Abstimmungen im Leipziger Stadtrat',
      lines: [
        props.parliamentPeriod.name,
        `${countOf(votings.length, 'Abstimmung', 'Abstimmungen')} seit dem ${formatDate(props.parliamentPeriod.sessions[0].date)}`,
      ],
    });
  }

  for (const { params, props } of await getParliamentPeriodWithSessionPaths()) {
    image(
      `wahlperiode-${params.parliamentPeriodNumber}/sitzung/${params.sessionId}`,
      {
        title: `Ratsversammlung vom ${formatDate(props.sessionInput.session.date)}`,
        lines: [
          countOf(
            props.sessionInput.votings.length,
            'Abstimmung',
            'Abstimmungen',
          ),
          props.parliamentPeriod.name,
        ],
      },
    );
  }

  for (const {
    params,
    props,
  } of await getParliamentPeriodWithSessionAndVotingPaths()) {
    const { voting, sessionInput, parliamentPeriod } = props;
    const subject = voting.votingSubject;
    const counts = getVoteCounts(voting);
    const accepted = votingAccepted(parliamentPeriod, voting);
    const where = [
      `TOP ${subject.agendaItem}`,
      subject.itemNumber && `Punkt ${subject.itemNumber}`,
    ]
      .filter(Boolean)
      .join(', ');
    image(
      `wahlperiode-${params.parliamentPeriodNumber}/sitzung/${params.sessionId}/abstimmung/${params.votingSlug}`,
      {
        title: subject.title || `Abstimmung zu ${where}`,
        lines: [
          `Ratsversammlung vom ${formatDate(sessionInput.session.date)}, ${where}`,
          [subject.type, subject.motionId].filter(Boolean).join(' '),
          ...(voting.reviewStatus === 'provisional'
            ? ['Vorläufiges Ergebnis']
            : []),
          ...(voting.reviewStatus === 'needs-review' ? ['In Prüfung'] : []),
        ].filter(Boolean),
        outcome: {
          accepted,
          text: `${accepted ? 'Angenommen' : 'Abgelehnt'}: ${formatNumber(counts.J)} Ja, ${formatNumber(counts.N)} Nein, ${countOf(counts.E, 'Enthaltung', 'Enthaltungen')}`,
        },
      },
    );
  }

  for (const { params, props } of await getParliamentPeriodWithPersonPaths()) {
    const { person, parliamentPeriod } = props;
    // The faction and party a member had last: today, or on the last day of a membership that ended.
    const today = new Date().toISOString().slice(0, 10);
    const day = person.end && person.end < today ? person.end : today;
    const faction = parliamentPeriod.factions.find(
      (candidate) => candidate.id === factionIdOn(person, day),
    );
    const party = parliamentPeriod.parties.find(
      (candidate) => candidate.id === partyIdOn(person, day),
    );
    image(
      `wahlperiode-${params.parliamentPeriodNumber}/person/${params.personId}`,
      {
        title: person.name,
        lines: [
          ...(faction ? [`Fraktion: ${faction.name}`] : []),
          ...(party ? [`Partei (Wahlliste 2024): ${party.name}`] : []),
        ],
      },
    );
  }

  for (const { params, props } of await getParliamentPeriodWithFactionPaths()) {
    image(
      `wahlperiode-${params.parliamentPeriodNumber}/fraktion/${params.factionId}`,
      {
        title: props.faction.name,
        lines: [
          `Fraktion, ${countOf(props.faction.seats, 'Sitz', 'Sitze')}`,
          props.parliamentPeriod.name,
        ],
      },
    );
  }

  for (const { params, props } of await getParliamentPeriodWithPartyPaths()) {
    image(
      `wahlperiode-${params.parliamentPeriodNumber}/partei/${params.partyId}`,
      {
        title: props.party.name,
        lines: [
          `Partei (Wahlliste 2024), ${countOf(props.party.seats, 'Sitz', 'Sitze')}`,
          props.parliamentPeriod.name,
        ],
      },
    );
  }

  return images;
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgImage((props as ImagePath['props']).content);
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
