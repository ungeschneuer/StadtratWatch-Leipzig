import { useState } from 'react';
import type { ReviewCase, VotingCorrection } from '@srw-astro/models/leipzig-review';
import { imageUrl } from './config';
import { describeCorrection } from './corrections';
import { DecisionForm } from './DecisionForm';
import styles from './leipzig.module.css';

const SOURCE_LABELS = {
  beschlussprotokoll: 'Niederschrift',
  'agenda-item-pages': 'ALLRIS',
  verlaufsprotokoll: 'Verlaufsprotokoll',
} as const;

const PRIORITY_LABELS = { hoch: 'Priorität hoch', mittel: 'Priorität mittel', niedrig: 'Priorität niedrig' } as const;

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

export function CaseCard({ sessionId, reviewCase, savedCorrections, canSave, saving, onSeek, onSave, onPropose }: Props) {
  const [draft, setDraft] = useState<{ correction: VotingCorrection | null; key: number }>({ correction: null, key: 0 });
  const decided = savedCorrections.length > 0 || !reviewCase.open;
  const { board, announced, neighbours } = reviewCase;

  return (
    <article id={`fall-${reviewCase.votingIndex}`} className={`${styles.card} ${decided ? styles.decided : ''}`}>
      <header className={styles.cardHeader}>
        <h2>
          #{reviewCase.votingIndex} · {reviewCase.agendaItemNumber ? `TOP ${reviewCase.agendaItemNumber}` : 'ohne TOP'}
        </h2>
        <span className={`${styles.badge} ${styles[reviewCase.priority]}`}>{PRIORITY_LABELS[reviewCase.priority]}</span>
        {decided && <span className={`${styles.badge} ${styles.done}`}>entschieden</span>}
        <button type="button" onClick={() => onSeek(Math.max(0, reviewCase.videoSeconds - VIDEO_LEAD_SECONDS))}>
          ▶ Video ab {reviewCase.timecode}
        </button>
      </header>
      <p className={styles.title}>
        {reviewCase.title}
        {reviewCase.paperReference && <span className={styles.muted}> · {reviewCase.paperReference}</span>}
      </p>

      <ul className={styles.problems}>
        {reviewCase.problems.map((problem) => (
          <li key={problem.check} title={problem.detail}>
            {problem.message}
          </li>
        ))}
      </ul>

      <table className={styles.numbers}>
        <thead>
          <tr>
            <th />
            <th>Ja</th>
            <th>Nein</th>
            <th>Enth.</th>
            <th>abgegeben</th>
            <th>anwesend</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Tafel</th>
            <td>{board.J}</td>
            <td>{board.N}</td>
            <td>{board.E}</td>
            <td>{board.castVotes ?? '?'}</td>
            <td>{board.presentMembers ?? '?'}</td>
          </tr>
          {reviewCase.official?.sources.map((source) => (
            <tr key={source.kind}>
              <th title={source.label}>
                {SOURCE_LABELS[source.kind]} (TOP {source.agendaItemNumbers.join('/') || '?'}
                {reviewCase.official?.procedural ? ', Verfahren' : ''})
              </th>
              <td className={source.J !== board.J ? styles.differs : ''}>{source.J}</td>
              <td className={source.N !== board.N ? styles.differs : ''}>{source.N}</td>
              <td className={source.E !== board.E ? styles.differs : ''}>{source.E}</td>
              <td colSpan={2} />
            </tr>
          ))}
          {announced && (
            <tr>
              <th>Ansage {announced.timecode}</th>
              <td className={announced.J !== board.J ? styles.differs : ''}>{announced.J}</td>
              <td className={announced.N !== board.N ? styles.differs : ''}>{announced.N}</td>
              <td className={announced.E !== null && announced.E !== board.E ? styles.differs : ''}>{announced.E ?? '–'}</td>
              <td colSpan={2} />
            </tr>
          )}
        </tbody>
      </table>

      {reviewCase.images.length > 0 && (
        <div className={styles.images}>
          {reviewCase.images.map((image) => (
            <figure key={image.url}>
              <a href={imageUrl(sessionId, image.url)} target="_blank" rel="noreferrer">
                <img src={imageUrl(sessionId, image.url)} alt={`${image.label} der Abstimmung #${reviewCase.votingIndex}`} loading="lazy" />
              </a>
              <figcaption>{image.label}</figcaption>
            </figure>
          ))}
        </div>
      )}

      {reviewCase.official?.correction && (
        <p className={styles.notice}>
          {reviewCase.official.correction.basis === 'named'
            ? 'Von Hand gezählt laut Protokoll:'
            : 'Von Hand gezählt (einzige Anwesende ohne Stimme):'}{' '}
          {reviewCase.official.correction.seats.map((seat) => seat.boardName).join(', ')} – „
          {reviewCase.official.correction.quote}“
        </p>
      )}

      {reviewCase.transcript.length > 0 && (
        <details className={styles.transcript} open={reviewCase.problems.some((problem) => problem.check === 'announcement-matches')}>
          <summary>Untertitel rund um die Abstimmung</summary>
          <ol>
            {reviewCase.transcript.map((line) => (
              <li key={line.seconds} className={line.highlight ? styles.highlight : ''}>
                <button type="button" className={styles.timecode} onClick={() => onSeek(line.seconds)}>
                  {line.timecode}
                </button>{' '}
                {line.text}
              </li>
            ))}
          </ol>
        </details>
      )}

      <div className={styles.context}>
        {neighbours.previous && (
          <p>
            Davor: #{neighbours.previous.votingIndex} {neighbours.previous.agendaItemNumber ? `TOP ${neighbours.previous.agendaItemNumber}` : 'ohne TOP'} ({neighbours.previous.result}, {neighbours.previous.timecode})
          </p>
        )}
        {neighbours.next && (
          <p>
            Danach: #{neighbours.next.votingIndex} {neighbours.next.agendaItemNumber ? `TOP ${neighbours.next.agendaItemNumber}` : 'ohne TOP'} ({neighbours.next.result}, {neighbours.next.timecode})
          </p>
        )}
        {reviewCase.candidates.length > 0 && (
          <p>
            Mögliche Betroffene:{' '}
            {reviewCase.candidates.map((candidate) => `${candidate.boardName} (${candidate.reason})`).join('; ')}
          </p>
        )}
        <p className={styles.links}>
          {reviewCase.links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </p>
      </div>

      {[...reviewCase.reviews, ...savedCorrections].length > 0 && (
        <div className={styles.history}>
          <strong>Bisherige Entscheidungen</strong>
          <ul>
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
        <div className={styles.suggestions}>
          <strong>Vorschläge</strong>
          {reviewCase.suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
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
    </article>
  );
}
