import { useState } from 'react';
import { type LeipzigSettings, saveSettings, saveToken } from './config';
import { fetchLogin } from './github';

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
    <details className="collapse-arrow border-base-300 bg-base-100 rounded-box collapse mb-4 border">
      <summary className="collapse-title text-sm font-semibold">
        {login ? `Angemeldet als ${login}` : 'Nicht angemeldet – Entscheidungen werden als Vorschlag eingereicht'}
      </summary>
      <div className="collapse-content flex flex-col gap-4 text-sm">
        {login ? (
          <button
            type="button"
            className="btn btn-sm self-start"
            onClick={() => {
              saveToken(null);
              onSignedIn(null, null);
            }}
          >
            Abmelden
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="max-w-prose">
              Zum direkten Speichern brauchst du Schreibrechte im Repository <code>{settings.repository}</code> und
              einen{' '}
              <a href={tokenHelp} target="_blank" rel="noreferrer" className="link link-primary">
                persönlichen Token
              </a>{' '}
              (nur dieses Repository, Berechtigung „Contents: Read and write“). Der Token bleibt in diesem Browser.
            </p>
            <div className="join">
              <input
                type="password"
                aria-label="Persönlicher Token"
                className="input input-sm join-item w-72 max-w-full"
                value={tokenInput}
                placeholder="github_pat_…"
                onChange={(event) => setTokenInput(event.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm btn-primary join-item"
                onClick={signIn}
                disabled={!tokenInput.trim()}
              >
                Anmelden
              </button>
            </div>
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-base-content/70">Repository</span>
            <input
              className="input input-sm"
              value={settings.repository}
              onChange={(event) => {
                const next = { ...settings, repository: event.target.value };
                saveSettings(next);
                onSettings(next);
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-base-content/70">Branch mit den Daten</span>
            <input
              className="input input-sm"
              value={settings.branch}
              onChange={(event) => {
                const next = { ...settings, branch: event.target.value };
                saveSettings(next);
                onSettings(next);
              }}
            />
          </label>
        </div>
      </div>
    </details>
  );
}
