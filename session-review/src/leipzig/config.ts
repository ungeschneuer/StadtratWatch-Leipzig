// Where the Leipzig review data lives. In development the Vite server serves the local data folders; the published app
// reads the data branch of the fork straight from GitHub, so a correction is visible right after the recheck commits.

export interface LeipzigSettings {
  repository: string;
  branch: string;
}

const SETTINGS_KEY = 'leipzig-review-settings';
const TOKEN_KEY = 'leipzig-review-github-token';

export const defaultSettings: LeipzigSettings = {
  repository: import.meta.env.VITE_LEIPZIG_REPOSITORY ?? 'ungeschneuer/StadtratWatch-Leipzig',
  branch: import.meta.env.VITE_LEIPZIG_BRANCH ?? 'data/leipzig-votings',
};

export const periodFolder = 'data/leipzig-8';

export function loadSettings(): LeipzigSettings {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: LeipzigSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Without storage the settings only last for this visit.
  }
}

// The token stays in this browser only; it is sent to api.github.com and nowhere else.
export function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Without storage the token has to be entered again next time.
  }
}

export function dataUrl(settings: LeipzigSettings, path: string): string {
  if (import.meta.env.DEV) return `/leipzig-data/${path}`;
  return `https://raw.githubusercontent.com/${settings.repository}/refs/heads/${settings.branch}/${periodFolder}/${path}`;
}

// Evidence images are published as release assets; locally they come from the extraction's output folder.
export function imageUrl(sessionId: string, publishedUrl: string): string {
  if (!import.meta.env.DEV) return publishedUrl;
  return `/leipzig-evidence/${sessionId}/${publishedUrl.slice(publishedUrl.lastIndexOf('/') + 1)}`;
}
