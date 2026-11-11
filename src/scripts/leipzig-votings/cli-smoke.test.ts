import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Runs the command line end to end on a session without votes, so a mistake in the entry point itself (an import, a
// constant used before it is set) fails here and not in a long run.
describe('leipzig-votings command line', () => {
  it('applies corrections and writes the review files', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'leipzig-votings-cli-'));
    const recording = {
      sessionId: '2026-10-29',
      date: '2026-10-29',
      oparlMeetingId: null,
      meetingName: null,
      mediathekUrl: 'https://www.leipzig.de/mediathek/video/x',
      pageTitle: '',
      serverApp: '',
      streamName: '',
      hlsUrl: 'https://stream.example/playlist.m3u8',
      durationSeconds: null,
      subtitleUrl: null,
      subtitleFile: null,
      subtitleSha256: null,
      firstSeen: '2026-10-30',
      goneSince: null,
    };
    writeFileSync(
      join(dataDir, 'recordings.json'),
      JSON.stringify({ description: '', sources: [], recordings: [recording] }),
    );
    mkdirSync(join(dataDir, '2026-10-29'));
    writeFileSync(join(dataDir, '2026-10-29', 'votings-2026-10-29.json'), JSON.stringify({ votings: [] }));

    const run = Bun.spawnSync(
      [
        process.execPath,
        join(import.meta.dir, 'index.ts'),
        '-d',
        dataDir,
        '-c',
        join(dataDir, 'cache'),
        '--corrections-only',
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    );

    expect(run.stderr.toString()).toEqual('');
    expect(run.exitCode).toEqual(0);
    expect(JSON.parse(readFileSync(join(dataDir, 'review-index.json'), 'utf-8'))).toEqual({
      sessions: [{ sessionId: '2026-10-29', videoAvailable: true, cases: 0, open: 0, reviewed: 0 }],
    });
  });
});
