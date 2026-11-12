import { getEntry } from 'astro:content';
import { describe, expect, test, vi } from 'vitest';
import type { Registry, RegistrySession } from '@models/registry';
import type { SessionSpeech } from '@models/session-speech';
import { GET } from './[sessionId].json.ts';

vi.mock('astro:content', () => ({
  getEntry: vi.fn(),
}));

function createSpeech(): SessionSpeech {
  return {
    speaker: 'Max Mustermann',
    start: 0,
    duration: 60,
    transcription: 'Text laut Verlaufsprotokoll',
  };
}

const session: RegistrySession = {
  id: '2026-10-29',
  date: '2026-10-29',
  title: 'Sitzung',
  youtubeUrl: '',
  meetingMinutesUrl: null,
  approved: true,
};

const parliamentPeriod: Registry = {
  id: 'leipzig-8',
  name: 'Wahlperiode VIII',
  lastUpdate: '2026-10-29',
  sessions: [session],
  factions: [],
  parties: [],
  persons: [],
};

describe('speeches endpoint source of the texts', () => {
  async function getMeta(forSession: RegistrySession) {
    vi.mocked(getEntry).mockResolvedValue({ data: [createSpeech()] } as never);
    const response = await GET({
      params: {
        parliamentPeriodId: parliamentPeriod.id,
        sessionId: forSession.id,
      },
      props: { parliamentPeriod, session: forSession },
    });
    return (await response.json()).meta;
  }

  test('names the record the texts are taken from', async () => {
    const meta = await getMeta({
      ...session,
      speechesSource: { label: 'Verlaufsprotokoll', url: 'https://ratsinfo/1' },
    });

    expect(meta.speeches_source).toMatchObject({
      label: 'Verlaufsprotokoll',
      url: 'https://ratsinfo/1',
    });
  });

  test('has no source for transcribed speeches', async () => {
    expect(await getMeta(session)).not.toHaveProperty('speeches_source');
  });
});
