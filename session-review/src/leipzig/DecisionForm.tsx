import { useState } from 'react';
import { type ReviewCase, unassignedAfterChanges, type VotingCorrection } from '@srw-astro/models/leipzig-review';
import type { VoteCode } from '@srw-astro/models/session';
import { compareNamesForSorting } from '@srw-astro/models/person-name';

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
  const [unresolved, setUnresolved] = useState(initial?.unresolved ?? false);
  const [assignAgendaItem, setAssignAgendaItem] = useState(Boolean(initial?.agendaItemNumber));
  const [agendaItemNumber, setAgendaItemNumber] = useState(initial?.agendaItemNumber ?? '');
  const [seats, setSeats] = useState<SeatChange[]>(initial?.seats ?? []);
  const [reason, setReason] = useState(initial?.reason ?? '');
  const [source, setSource] = useState(initial?.source ?? `Video ${reviewCase.timecode}`);

  const seatOptions = reviewCase.seats
    .filter((seat) => seat.personId)
    .sort((a, b) => compareNamesForSorting(a.boardName, b.boardName));
  const boardVoteOf = (personId: string) => reviewCase.seats.find((seat) => seat.personId === personId)?.vote ?? 'O';

  const hasEffect =
    discard || unresolved || approve || (assignAgendaItem && agendaItemNumber.trim() !== '') || seats.length > 0;
  // Named votes can be assigned while another hand-counted vote stays unassigned; a discarded vote changes nothing.
  const valid =
    hasEffect &&
    reason.trim() !== '' &&
    seats.every((seat) => seat.personId) &&
    !(discard && (approve || seats.length > 0)) &&
    !(unresolved && (approve || discard));
  const unassigned = unresolved
    ? unassignedAfterChanges(
        reviewCase,
        seats.filter((seat) => seat.personId),
      )
    : null;

  function build(): VotingCorrection {
    return {
      voting: initial?.voting ?? {
        videoSeconds: reviewCase.videoSeconds,
        ...(reviewCase.agendaItemNumber ? { agendaItemNumber: reviewCase.agendaItemNumber } : {}),
      },
      ...(seats.length > 0 ? { seats } : {}),
      ...(approve ? { approve: true } : {}),
      ...(discard ? { discard: true } : {}),
      ...(unresolved ? { unresolved: true } : {}),
      ...(assignAgendaItem && agendaItemNumber.trim() ? { agendaItemNumber: agendaItemNumber.trim() } : {}),
      reason: reason.trim(),
      ...(source.trim() ? { source: source.trim() } : {}),
    };
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSave(build());
      }}
    >
      <fieldset className="fieldset border-base-300 bg-base-200 rounded-box gap-3 border p-4">
        <legend className="fieldset-legend">Entscheidung</legend>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox checkbox-sm mt-0.5"
            checked={approve}
            onChange={(event) => setApprove(event.target.checked)}
          />
          Tafel-Lesung ist richtig (bestätigen)
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox checkbox-sm mt-0.5"
            checked={discard}
            onChange={(event) => setDiscard(event.target.checked)}
          />
          Keine gültige Abstimmung (Zwischenstand, alte Tafel oder wiederholt) – verwerfen
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox checkbox-sm mt-0.5"
            checked={unresolved}
            onChange={(event) => setUnresolved(event.target.checked)}
          />
          Nicht vollständig zuzuordnen: gültige Abstimmung, aber nicht für jede nachgezählte Stimme belegbar, von wem
          sie kam. Belegte Stimmen unter „Stimmen ändern“ eintragen; der Rest bleibt ohne Namen, das Ergebnis folgt der
          amtlichen Zählung.
        </label>
        {unassigned && (
          <p className="text-base-content/70 ms-6 text-sm" role="status">
            Bleibt ohne Namen: {describeRemainder(unassigned)}
          </p>
        )}
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox checkbox-sm mt-0.5"
            checked={assignAgendaItem}
            onChange={(event) => setAssignAgendaItem(event.target.checked)}
          />
          TOP zuordnen
          {assignAgendaItem && (
            <input
              aria-label="TOP-Nummer"
              className="input input-sm -mt-1 w-32"
              value={agendaItemNumber}
              placeholder="z. B. 18.20"
              onChange={(event) => setAgendaItemNumber(event.target.value)}
            />
          )}
        </label>

        <div className="flex flex-col items-start gap-2 text-sm">
          <span>Stimmen ändern</span>
          {seats.map((seat, position) => (
            <div key={position} className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Person"
                className="select select-sm w-72 max-w-full"
                value={seat.personId}
                onChange={(event) =>
                  setSeats(
                    seats.map((other, index) =>
                      index === position ? { ...other, personId: event.target.value } : other,
                    ),
                  )
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
                aria-label="Stimme"
                className="select select-sm w-40"
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
              {seat.personId && (
                <span className="text-base-content/70">bisher {VOTE_LABELS[boardVoteOf(seat.personId)]}</span>
              )}
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setSeats(seats.filter((_, index) => index !== position))}
              >
                Entfernen
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setSeats([...seats, { personId: '', vote: 'J' }])}
          >
            + Stimme
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Begründung (Pflicht)
          <textarea
            className="textarea w-full"
            value={reason}
            rows={2}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Beleg
          <input className="input w-full" value={source} onChange={(event) => setSource(event.target.value)} />
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        {canSave ? (
          <button type="submit" className="btn btn-primary" disabled={!valid || saving}>
            {saving ? 'Speichert …' : 'Entscheidung speichern'}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!valid} onClick={() => onPropose(build())}>
            Als Vorschlag einreichen (GitHub-Issue)
          </button>
        )}
        {!valid && (
          <span className="text-base-content/70 text-sm">
            Mindestens eine Entscheidung und eine Begründung angeben; Verwerfen nicht zusammen mit Bestätigen oder
            Stimmen, „nicht vollständig zuzuordnen“ nicht zusammen mit Bestätigen oder Verwerfen.
          </span>
        )}
      </div>
    </form>
  );
}

function describeRemainder(unassigned: { J: number; N: number; E: number }): string {
  const parts = [
    ['Ja', unassigned.J],
    ['Nein', unassigned.N],
    ['Enthaltung', unassigned.E],
  ] as const;
  const named = parts
    .filter(([, count]) => count !== 0)
    .map(([label, count]) => `${count > 0 ? '+' : ''}${count} ${label}`);
  return named.length > 0 ? named.join(', ') : 'nichts, alle Stimmen sind zugeordnet';
}
