import { useState } from 'react';
import type { ReviewCase, VotingCorrection } from '@srw-astro/models/leipzig-review';
import type { VoteCode } from '@srw-astro/models/session';
import styles from './leipzig.module.css';

const VOTE_LABELS: Record<VoteCode, string> = { J: 'Ja', N: 'Nein', E: 'Enthaltung', O: 'keine Stimme' };

interface Props {
  reviewCase: ReviewCase;
  initial: VotingCorrection | null;
  canSave: boolean;
  saving: boolean;
  onSave: (correction: VotingCorrection) => void;
  onPropose: (correction: VotingCorrection) => void;
}

interface SeatChange {
  personId: string;
  vote: VoteCode;
}

export function DecisionForm({ reviewCase, initial, canSave, saving, onSave, onPropose }: Props) {
  const [approve, setApprove] = useState(initial?.approve ?? false);
  const [discard, setDiscard] = useState(initial?.discard ?? false);
  const [assignAgendaItem, setAssignAgendaItem] = useState(Boolean(initial?.agendaItemNumber));
  const [agendaItemNumber, setAgendaItemNumber] = useState(initial?.agendaItemNumber ?? '');
  const [seats, setSeats] = useState<SeatChange[]>(initial?.seats ?? []);
  const [reason, setReason] = useState(initial?.reason ?? '');
  const [source, setSource] = useState(initial?.source ?? `Video ${reviewCase.timecode}`);

  const seatOptions = reviewCase.seats
    .filter((seat) => seat.personId)
    .sort((a, b) => a.boardName.localeCompare(b.boardName, 'de'));
  const boardVoteOf = (personId: string) => reviewCase.seats.find((seat) => seat.personId === personId)?.vote ?? 'O';

  const hasEffect = discard || approve || (assignAgendaItem && agendaItemNumber.trim() !== '') || seats.length > 0;
  const valid =
    hasEffect && reason.trim() !== '' && seats.every((seat) => seat.personId) && !(discard && (approve || seats.length > 0));

  function build(): VotingCorrection {
    return {
      voting: initial?.voting ?? {
        videoSeconds: reviewCase.videoSeconds,
        ...(reviewCase.agendaItemNumber ? { agendaItemNumber: reviewCase.agendaItemNumber } : {}),
      },
      ...(seats.length > 0 ? { seats } : {}),
      ...(approve ? { approve: true } : {}),
      ...(discard ? { discard: true } : {}),
      ...(assignAgendaItem && agendaItemNumber.trim() ? { agendaItemNumber: agendaItemNumber.trim() } : {}),
      reason: reason.trim(),
      ...(source.trim() ? { source: source.trim() } : {}),
    };
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSave(build());
      }}
    >
      <fieldset>
        <legend>Entscheidung</legend>
        <label className={styles.check}>
          <input type="checkbox" checked={approve} onChange={(event) => setApprove(event.target.checked)} />
          Tafel-Lesung ist richtig (bestätigen)
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={discard} onChange={(event) => setDiscard(event.target.checked)} />
          Keine gültige Abstimmung (Zwischenstand, alte Tafel oder wiederholt) – verwerfen
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={assignAgendaItem}
            onChange={(event) => setAssignAgendaItem(event.target.checked)}
          />
          TOP zuordnen
          {assignAgendaItem && (
            <input
              className={styles.short}
              value={agendaItemNumber}
              placeholder="z. B. 18.20"
              onChange={(event) => setAgendaItemNumber(event.target.value)}
            />
          )}
        </label>

        <div className={styles.seats}>
          <span>Stimmen ändern</span>
          {seats.map((seat, position) => (
            <div key={position} className={styles.seatRow}>
              <select
                value={seat.personId}
                onChange={(event) =>
                  setSeats(seats.map((other, index) => (index === position ? { ...other, personId: event.target.value } : other)))
                }
              >
                <option value="">Person wählen …</option>
                {seatOptions.map((option) => (
                  <option key={option.personId} value={option.personId ?? ''}>
                    {option.boardName} (Tafel: {VOTE_LABELS[option.vote]})
                  </option>
                ))}
              </select>
              <select
                value={seat.vote}
                onChange={(event) =>
                  setSeats(
                    seats.map((other, index) =>
                      index === position ? { ...other, vote: event.target.value as VoteCode } : other,
                    ),
                  )
                }
              >
                {(Object.keys(VOTE_LABELS) as VoteCode[]).map((vote) => (
                  <option key={vote} value={vote}>
                    {VOTE_LABELS[vote]}
                  </option>
                ))}
              </select>
              {seat.personId && <span className={styles.muted}>bisher {VOTE_LABELS[boardVoteOf(seat.personId)]}</span>}
              <button type="button" onClick={() => setSeats(seats.filter((_, index) => index !== position))}>
                Entfernen
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setSeats([...seats, { personId: '', vote: 'J' }])}>
            + Stimme
          </button>
        </div>

        <label className={styles.field}>
          Begründung (Pflicht)
          <textarea value={reason} rows={2} onChange={(event) => setReason(event.target.value)} />
        </label>
        <label className={styles.field}>
          Beleg
          <input value={source} onChange={(event) => setSource(event.target.value)} />
        </label>
      </fieldset>

      <div className={styles.actions}>
        {canSave ? (
          <button type="submit" className={styles.primary} disabled={!valid || saving}>
            {saving ? 'Speichert …' : 'Entscheidung speichern'}
          </button>
        ) : (
          <button type="button" className={styles.primary} disabled={!valid} onClick={() => onPropose(build())}>
            Als Vorschlag einreichen (GitHub-Issue)
          </button>
        )}
        {!valid && <span className={styles.muted}>Mindestens eine Entscheidung und eine Begründung angeben; Verwerfen nicht zusammen mit Bestätigen oder Stimmen.</span>}
      </div>
    </form>
  );
}
