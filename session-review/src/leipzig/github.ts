import type { VotingCorrection } from '@srw-astro/models/leipzig-review';
import { type LeipzigSettings, periodFolder } from './config';

const API = 'https://api.github.com';

export interface CorrectionsFile {
  corrections: VotingCorrection[];
  sha: string | null;
}

export class GitHubError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new GitHubError(response.status, body.message ?? response.statusText);
  }
  return response.json() as Promise<T>;
}

export async function fetchLogin(token: string): Promise<string> {
  return (await request<{ login: string }>(token, '/user')).login;
}

function correctionsPath(sessionId: string): string {
  return `${periodFolder}/${sessionId}/corrections-${sessionId}.json`;
}

function decodeBase64Utf8(base64: string): string {
  const bytes = Uint8Array.from(atob(base64.replaceAll('\n', '')), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function readCorrections(
  token: string,
  settings: LeipzigSettings,
  sessionId: string,
): Promise<CorrectionsFile> {
  try {
    const file = await request<{ content: string; sha: string }>(
      token,
      `/repos/${settings.repository}/contents/${correctionsPath(sessionId)}?ref=${encodeURIComponent(settings.branch)}`,
    );
    return { corrections: JSON.parse(decodeBase64Utf8(file.content)) as VotingCorrection[], sha: file.sha };
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return { corrections: [], sha: null };
    throw error;
  }
}

// Several people may review at once. The write names the version it read; if someone else committed in between,
// GitHub rejects it, and the change is applied again to the newer file.
export async function commitCorrection(
  token: string,
  settings: LeipzigSettings,
  sessionId: string,
  update: (corrections: VotingCorrection[]) => VotingCorrection[],
  message: string,
): Promise<VotingCorrection[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await readCorrections(token, settings, sessionId);
    const next = update(current.corrections);
    try {
      await request(token, `/repos/${settings.repository}/contents/${correctionsPath(sessionId)}`, {
        method: 'PUT',
        body: JSON.stringify({
          message,
          branch: settings.branch,
          content: encodeBase64Utf8(`${JSON.stringify(next, null, 2)}\n`),
          ...(current.sha ? { sha: current.sha } : {}),
        }),
      });
      return next;
    } catch (error) {
      const conflict = error instanceof GitHubError && (error.status === 409 || error.status === 422);
      if (!conflict || attempt === 2) throw error;
    }
  }
  throw new Error('unreachable');
}
