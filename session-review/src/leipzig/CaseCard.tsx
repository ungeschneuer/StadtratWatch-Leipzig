import { useState } from 'react';
import type { ReviewCase, VotingCorrection } from '@srw-astro/models/leipzig-review';
import { imageUrl } from './config';
import { describeCorrection } from './corrections';
import { DecisionForm } from './DecisionForm';
import { Notice } from './Page';

const SOURCE_LABELS = {
  beschlussprotokoll: 'Niederschrift',
  'agenda-item-pages': 'ALLRIS',
  verlaufsprotokoll: 'Verlaufsprotokoll',
} as const;

const PRIORITY_LABELS = { hoch: 'Priorität hoch', mittel: 'Priorität mittel', niedrig: 'Priorität niedrig' } as const;
const PRIORITY_BADGES = { hoch: 'badge-error', mittel: 'badge-warning', niedrig: 'badge-success' } as const;

// A count that differs from the board is marked by colour and named for screen readers.
function CountCell({ value, board }: { value: number | null; board: number }) {
  const differs = value !== null && value !== board;
  return (
    <td className={`text-right tabular-nums ${differs ? 'bg-error/15 text-error font-semibold' : ''}`}>
      {value ?? '–'}
      {differs && <span className="sr-only"> (weicht von der Tafel ab)</span>}
    </td>
  );
}

// Starting a little before the result shows the chair's announcement as well.
const VIDEO_LEAD_SECONDS = 20;

interface Props {
  sessionId: string;
  reviewCase: ReviewCase;
  savedCorrections: VotingCorrection[];
  canSave: boolean;
  saving: boolean;
  onSeek: (seconds: number) => void;
  onSave: (correction: VotingCorrection) => void;
  onPropose: (correction: VotingCorrection) => void;
}

export function CaseCard({
  sessionId,
  reviewCase,
  savedCorrections,
  canSave,
  saving,
  onSeek,
  onSave,
  onPropose,
}: Props) {
  const [draft, setDraft] = useState<{ correction: VotingCorrection | null; key: number }>({
    correction: null,
    key: 0,
  });
  const decided = savedCorrections.length > 0 || !reviewCase.open;
  const { board, announced, neighbours } = reviewCase;

  return (
    <article
      id={`fall-${reviewCase.votingIndex}`}
      className={`card border-base-300 bg-base-100 mb-5 scroll-mt-4 border ${decided ? 'opacity-75' : ''}`}
    >
      <div className="card-body gap-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-center gap-2">
          <h2 className="card-title me-auto">
            #{reviewCase.votingIndex}, {reviewCase.agendaItemNumber ? `TOP ${reviewCase.agendaItemNumber}` : 'ohne TOP'}
          </h2>
          <span className={`badge badge-soft ${PRIORITY_BADGES[reviewCase.priority]}`}>
            {PRIORITY_LABELS[reviewCase.priority]}
          </span>
          {decided && <span className="badge badge-ghost">entschieden</span>}
          <button
            type="button"
            className="btn btn-sm btn-outline btn-primary"
            onClick={() => onSeek(Math.max(0, reviewCase.videoSeconds - VIDEO_LEAD_SECONDS))}
          >
            Video ab {reviewCase.timecode}
          </button>
        </header>
        <p className="hyphens-auto" lang="de">
          {reviewCase.title}
          {reviewCase.paperReference && (
            <span className="text-base-content/70">
              {' '}
              (<span className="whitespace-nowrap">{reviewCase.paperReference}</span>)
            </span>
          )}
        </p>

        <ul className="list-disc space-y-1 ps-5 text-sm">
          {reviewCase.problems.map((problem) => (
            <li key={problem.check} title={problem.detail}>
              {problem.message}
            </li>
          ))}
        </ul>

        <div className="border-base-300 rounded-box w-fit max-w-full overflow-x-auto border">
          <table className="table-sm table">
            <thead>
              <tr>
                <td />
                <th scope="col" className="text-right">
                  Ja
                </th>
                <th scope="col" className="text-right">
                  Nein
                </th>
                <th scope="col" className="text-right">
                  Enth.
                </th>
                <th scope="col" className="text-right">
                  abgegeben
                </th>
                <th scope="col" className="text-right">
                  anwesend
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Tafel</th>
                <td className="text-right tabular-nums">{board.J}</td>
                <td className="text-right tabular-nums">{board.N}</td>
                <td className="text-right tabular-nums">{board.E}</td>
                <td className="text-right tabular-nums">{board.castVotes ?? '?'}</td>
                <td className="text-right tabular-nums">{board.presentMembers ?? '?'}</td>
              </tr>
              {reviewCase.official?.sources.map((source) => (
                <tr key={source.kind}>
                  <th scope="row" title={source.label} className="font-normal">
                    {SOURCE_LABELS[source.kind]} (TOP {source.agendaItemNumbers.join('/') || '?'}
                    {reviewCase.official?.procedural ? ', Verfahren' : ''})
                  </th>
                  <CountCell value={source.J} board={board.J} />
                  <CountCell value={source.N} board={board.N} />
                  <CountCell value={source.E} board={board.E} />
                  <td colSpan={2} />
                </tr>
              ))}
              {announced && (
                <tr>
                  <th scope="row" className="font-normal">
                    Ansage {announced.timecode}
                  </th>
                  <CountCell value={announced.J} board={board.J} />
                  <CountCell value={announced.N} board={board.N} />
                  <CountCell value={announced.E} board={board.E} />
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {reviewCase.images.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {reviewCase.images.map((image) => (
              <figure key={image.url} className="flex flex-col gap-1">
                <a className="block" href={imageUrl(sessionId, image.url)} target="_blank" rel="noreferrer">
                  <img
                    src={imageUrl(sessionId, image.url)}
                    alt={`${image.label} der Abstimmung #${reviewCase.votingIndex}`}
                    loading="lazy"
                    className="border-base-300 rounded-box w-full border"
                  />
                </a>
                <figcaption className="text-base-content/70 text-xs">{image.label}</figcaption>
              </figure>
            ))}
          </div>
        )}

        {reviewCase.official?.correction && (
          <Notice>
            {reviewCase.official.correction.basis === 'named'
              ? 'Von Hand gezählt laut Protokoll:'
              : 'Von Hand gezählt (einzige Anwesende ohne Stimme):'}{' '}
            {reviewCase.official.correction.seats.map((seat) => seat.boardName).join(', ')} – „
            {reviewCase.official.correction.quote}“
          </Notice>
        )}

        {reviewCase.transcript.length > 0 && (
          <details
            className="collapse-arrow border-base-300 rounded-box collapse border"
            open={reviewCase.problems.some((problem) => problem.check === 'announcement-matches')}
          >
            <summary className="collapse-title text-sm font-semibold">Untertitel rund um die Abstimmung</summary>
            <ol className="collapse-content space-y-0.5 text-sm">
              {reviewCase.transcript.map((line) => (
                <li key={line.seconds} className={`rounded px-1 ${line.highlight ? 'bg-warning/20' : ''}`}>
                  <button type="button" className="link link-primary tabular-nums" onClick={() => onSeek(line.seconds)}>
                    {line.timecode}
                  </button>{' '}
                  {line.text}
                </li>
              ))}
            </ol>
          </details>
        )}

        <div className="space-y-1 text-sm">
          {neighbours.previous && (
            <p>
              Davor: #{neighbours.previous.votingIndex}{' '}
              {neighbours.previous.agendaItemNumber ? `TOP ${neighbours.previous.agendaItemNumber}` : 'ohne TOP'} (
              {neighbours.previous.result}, {neighbours.previous.timecode})
            </p>
          )}
          {neighbours.next && (
            <p>
              Danach: #{neighbours.next.votingIndex}{' '}
              {neighbours.next.agendaItemNumber ? `TOP ${neighbours.next.agendaItemNumber}` : 'ohne TOP'} (
              {neighbours.next.result}, {neighbours.next.timecode})
            </p>
          )}
          {reviewCase.candidates.length > 0 && (
            <p>
              Mögliche Betroffene:{' '}
              {reviewCase.candidates.map((candidate) => `${candidate.boardName} (${candidate.reason})`).join('; ')}
            </p>
          )}
          <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            {reviewCase.links.map((link) => (
              <a key={link.url} className="link link-primary" href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </p>
        </div>

        {[...reviewCase.reviews, ...savedCorrections].length > 0 && (
          <div className="text-sm">
            <h3 className="mb-1 font-semibold">Bisherige Entscheidungen</h3>
            <ul className="list-disc space-y-1 ps-5">
              {reviewCase.reviews.map((review, index) => (
                <li key={`review-${index}`}>
                  {review.reason}
                  {review.reviewer && ` – ${review.reviewer}`}
                  {review.reviewedAt && `, ${new Date(review.reviewedAt).toLocaleString('de-DE')}`}
                </li>
              ))}
              {savedCorrections.map((correction, index) => (
                <li key={`saved-${index}`}>
                  {describeCorrection(correction)}: {correction.reason}
                  {correction.reviewer && ` – ${correction.reviewer}`} (gespeichert, wird übernommen)
                </li>
              ))}
            </ul>
          </div>
        )}

        {reviewCase.suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <h3 className="font-semibold">Vorschläge</h3>
            {reviewCase.suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                className="btn btn-sm btn-soft btn-primary h-auto min-h-8 max-w-full py-1 text-left whitespace-normal"
                onClick={() => setDraft({ correction: suggestion.correction, key: draft.key + 1 })}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}

        <DecisionForm
          key={draft.key}
          reviewCase={reviewCase}
          initial={draft.correction}
          canSave={canSave}
          saving={saving}
          onSave={onSave}
          onPropose={onPropose}
        />
      </div>
    </article>
  );
}
