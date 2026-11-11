import { useState } from 'react';
import { type LeipzigSettings, saveSettings, saveToken } from './config';
import { fetchLogin } from './github';
import styles from './leipzig.module.css';

interface Props {
  settings: LeipzigSettings;
  login: string | null;
  onSettings: (settings: LeipzigSettings) => void;
  onSignedIn: (token: string | null, login: string | null) => void;
}

// Each reviewer signs in with a personal fine-grained token limited to this repository ("Contents: Read and write").
// Decisions are committed under that person's name, so several people can review side by side.
export function AccountPanel({ settings, login, onSettings, onSignedIn }: Props) {
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tokenHelp = `https://github.com/settings/personal-access-tokens/new?name=StadtratWatch-Pr%C3%BCfung&description=Pr%C3%BCfung+der+Leipziger+Abstimmungen`;

  async function signIn() {
    setError(null);
    try {
      const name = await fetchLogin(tokenInput.trim());
      saveToken(tokenInput.trim());
      setTokenInput('');
      onSignedIn(tokenInput.trim(), name);
    } catch (signInError) {
      setError(`Anmeldung fehlgeschlagen: ${(signInError as Error).message}`);
    }
  }

  return (
    <details className={styles.account}>
      <summary>{login ? `Angemeldet als ${login}` : 'Nicht angemeldet – Entscheidungen werden als Vorschlag eingereicht'}</summary>
      {login ? (
        <button
          type="button"
          onClick={() => {
            saveToken(null);
            onSignedIn(null, null);
          }}
        >
          Abmelden
        </button>
      ) : (
        <div className={styles.field}>
          <p>
            Zum direkten Speichern brauchst du Schreibrechte im Repository{' '}
            <code>{settings.repository}</code> und einen{' '}
            <a href={tokenHelp} target="_blank" rel="noreferrer">
              persönlichen Token
            </a>{' '}
            (nur dieses Repository, Berechtigung „Contents: Read and write“). Der Token bleibt in diesem Browser.
          </p>
          <input
            type="password"
            value={tokenInput}
            placeholder="github_pat_…"
            onChange={(event) => setTokenInput(event.target.value)}
          />
          <button type="button" onClick={signIn} disabled={!tokenInput.trim()}>
            Anmelden
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}
      <div className={styles.settings}>
        <label>
          Repository
          <input
            value={settings.repository}
            onChange={(event) => {
              const next = { ...settings, repository: event.target.value };
              saveSettings(next);
              onSettings(next);
            }}
          />
        </label>
        <label>
          Branch mit den Daten
          <input
            value={settings.branch}
            onChange={(event) => {
              const next = { ...settings, branch: event.target.value };
              saveSettings(next);
              onSettings(next);
            }}
          />
        </label>
      </div>
    </details>
  );
}
