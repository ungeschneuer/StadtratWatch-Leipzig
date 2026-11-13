import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ReviewCasesFile, ReviewIndex, VotingCorrection } from '@srw-astro/models/leipzig-review';
import { AccountPanel } from './AccountPanel';
import { CaseCard } from './CaseCard';
import { dataUrl, loadSettings, loadToken, type LeipzigSettings } from './config';
import { correctionsForCase, replaceCorrectionsForCase } from './corrections';
import { commitCorrection, fetchLogin, readCorrections } from './github';
import { type SeekRequest, VideoPlayer } from './VideoPlayer';
import { Notice, Page, PageTitle } from './Page';

const PRIORITY_ORDER = { hoch: 0, mittel: 1, niedrig: 2 } as const;

function useAccount() {
  const [settings, setSettings] = useState<LeipzigSettings>(loadSettings);
  const [token, setToken] = useState<string | null>(loadToken);
  const [login, setLogin] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchLogin(token)
      .then(setLogin)
      .catch(() => setToken(null));
  }, [token]);

  return {
    settings,
    setSettings,
    token: login ? token : null,
    login,
    signIn: (nextToken: string | null, nextLogin: string | null) => {
      setToken(nextToken);
      setLogin(nextLogin);
    },
  };
}

function useJson<T>(url: string): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ url: string; data: T | null; error: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(url, { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`${url} → ${response.status}`);
        return response.json() as Promise<T>;
      })
      .then((data) => !cancelled && setState({ url, data, error: null }))
      .catch((error: Error) => !cancelled && setState({ url, data: null, error: error.message }));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state?.url === url ? state : { data: null, error: null };
}

export function LeipzigSessions() {
  const account = useAccount();
  const { data, error } = useJson<ReviewIndex>(dataUrl(account.settings, 'review-index.json'));

  return (
    <Page>
      <PageTitle>Prüfung der Leipziger Abstimmungen</PageTitle>
      <AccountPanel {...account} onSettings={account.setSettings} onSignedIn={account.signIn} />
      {error && <Notice tone="error">Konnte die Übersicht nicht laden: {error}</Notice>}
      {data && (
        <div className="border-base-300 bg-base-100 rounded-box overflow-x-auto border">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Sitzung</th>
                <th scope="col" className="text-right">
                  offen
                </th>
                <th scope="col" className="text-right">
                  entschieden
                </th>
                <th scope="col">Video</th>
              </tr>
            </thead>
            <tbody>
              {[...data.sessions].reverse().map((session) => (
                <tr key={session.sessionId}>
                  <th scope="row" className="font-normal">
                    <Link to={`/leipzig/${session.sessionId}`} className="link link-primary whitespace-nowrap">
                      {new Date(session.sessionId).toLocaleDateString('de-DE', { dateStyle: 'long' })}
                    </Link>
                  </th>
                  <td className="text-right tabular-nums">
                    {session.open > 0 ? <span className="badge badge-soft badge-warning">{session.open}</span> : 0}
                  </td>
                  <td className="text-right tabular-nums">{session.reviewed}</td>
                  <td className="text-base-content/70">{session.videoAvailable ? 'online' : 'nicht mehr online'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

export function LeipzigSessionReview() {
  const { sessionDate = '' } = useParams();
  const account = useAccount();
  const { data, error } = useJson<ReviewCasesFile>(
    dataUrl(account.settings, `${sessionDate}/review-${sessionDate}.json`),
  );
  const [corrections, setCorrections] = useState<VotingCorrection[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [seek, setSeek] = useState<SeekRequest | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);

  useEffect(() => {
    if (!account.token) {
      fetch(dataUrl(account.settings, `${sessionDate}/corrections-${sessionDate}.json`), { cache: 'no-cache' })
        .then((response) => (response.ok ? (response.json() as Promise<VotingCorrection[]>) : []))
        .then(setCorrections)
        .catch(() => setCorrections([]));
      return;
    }
    readCorrections(account.token, account.settings, sessionDate)
      .then((file) => setCorrections(file.corrections))
      .catch((readError: Error) =>
        setMessage({ text: `Korrekturen nicht lesbar: ${readError.message}`, tone: 'error' }),
      );
  }, [account.token, account.settings, sessionDate]);

  // A link from the notification issue names one case; it is shown even when decided and scrolled into view.
  const linkedCase = Number(window.location.hash.match(/^#fall-(\d+)$/)?.[1] ?? Number.NaN);
  useEffect(() => {
    if (!data || Number.isNaN(linkedCase)) return;
    document.getElementById(`fall-${linkedCase}`)?.scrollIntoView({ block: 'start' });
  }, [data, linkedCase]);

  const cases = useMemo(
    () =>
      (data?.cases ?? [])
        .filter(
          (reviewCase) =>
            showAll ||
            reviewCase.votingIndex === linkedCase ||
            (reviewCase.open && correctionsForCase(corrections, reviewCase).length === 0),
        )
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.videoSeconds - b.videoSeconds),
    [data, corrections, showAll, linkedCase],
  );

  async function save(votingIndex: number, correction: VotingCorrection) {
    const reviewCase = data?.cases.find((candidate) => candidate.votingIndex === votingIndex);
    if (!account.token || !account.login || !reviewCase) return;
    setSaving(votingIndex);
    setMessage(null);
    const signed = { ...correction, reviewer: account.login, reviewedAt: new Date().toISOString() };
    try {
      const next = await commitCorrection(
        account.token,
        account.settings,
        sessionDate,
        (current) => replaceCorrectionsForCase(current, reviewCase, signed),
        `Prüfung ${sessionDate} #${votingIndex}: ${correction.reason}`,
      );
      setCorrections(next);
      setMessage({
        text: `#${votingIndex} gespeichert. Die Daten werden nach der automatischen Prüfung aktualisiert.`,
        tone: 'info',
      });
    } catch (saveError) {
      setMessage({ text: `Speichern fehlgeschlagen: ${(saveError as Error).message}`, tone: 'error' });
    } finally {
      setSaving(null);
    }
  }

  function propose(votingIndex: number, correction: VotingCorrection) {
    const title = `Prüfvorschlag ${sessionDate} #${votingIndex}`;
    const body = [
      `Vorschlag zur Abstimmung #${votingIndex} der Ratsversammlung vom ${sessionDate}.`,
      '',
      `Eintrag für \`data/leipzig-8/${sessionDate}/corrections-${sessionDate}.json\`:`,
      '',
      '```json',
      JSON.stringify(correction, null, 2),
      '```',
    ].join('\n');
    const url = `https://github.com/${account.settings.repository}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener');
  }

  const openCount = (data?.cases ?? []).filter(
    (reviewCase) => reviewCase.open && correctionsForCase(corrections, reviewCase).length === 0,
  ).length;

  return (
    <Page>
      <p className="mb-2 text-sm">
        <Link to="/leipzig" className="link link-primary">
          ← Alle Sitzungen
        </Link>
      </p>
      <PageTitle>
        Ratsversammlung vom {new Date(sessionDate).toLocaleDateString('de-DE', { dateStyle: 'long' })}
      </PageTitle>
      <AccountPanel {...account} onSettings={account.setSettings} onSignedIn={account.signIn} />
      {error && <Notice tone="error">Konnte die Prüffälle nicht laden: {error}</Notice>}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {data && (
        <>
          <div className="bg-base-200 sticky top-0 z-10 py-2">
            <VideoPlayer hlsUrl={data.video.hlsUrl} available={data.video.available} seek={seek} />
          </div>
          <div className="my-3 flex flex-wrap items-center justify-between gap-4 text-sm">
            <span className="font-semibold">
              {openCount} offen von {data.summary.cases} Prüffällen
            </span>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={showAll}
                onChange={(event) => setShowAll(event.target.checked)}
              />
              auch entschiedene zeigen
            </label>
          </div>
          {cases.length === 0 && <Notice>Keine offenen Prüffälle.</Notice>}
          {cases.map((reviewCase) => (
            <CaseCard
              key={reviewCase.votingIndex}
              sessionId={sessionDate}
              reviewCase={reviewCase}
              savedCorrections={reviewCase.open ? correctionsForCase(corrections, reviewCase) : []}
              canSave={Boolean(account.token)}
              saving={saving === reviewCase.votingIndex}
              onSeek={(seconds) => setSeek({ seconds, sequence: (seek?.sequence ?? 0) + 1 })}
              onSave={(correction) => void save(reviewCase.votingIndex, correction)}
              onPropose={(correction) => propose(reviewCase.votingIndex, correction)}
            />
          ))}
        </>
      )}
    </Page>
  );
}
