import { describe, expect, it } from 'bun:test';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFfmpegVideoReader } from './ffmpeg.ts';

// Stand-ins for ffmpeg that behave like the stream when it stops sending without closing the connection. `exec` keeps
// them a single process like ffmpeg, so killing it closes the pipe.
function fakeFfmpeg(script: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'fake-ffmpeg-')), 'ffmpeg');
  writeFileSync(path, `#!/bin/sh\n${script}\n`);
  chmodSync(path, 0o755);
  return path;
}

const fast = { grabTimeoutMilliseconds: 300, scanIdleTimeoutMilliseconds: 1500, retryPauseMilliseconds: 0 };

describe('createFfmpegVideoReader', () => {
  it('gives up on a frame grab that hangs, after its retries', async () => {
    const reader = createFfmpegVideoReader(fakeFfmpeg('exec sleep 30'), fast);
    const started = Date.now();

    await expect(reader.grabFramePng('https://stream.example/playlist.m3u8', 10)).rejects.toThrow('killed after 0.3s');
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('stops a scan that delivers no frame for too long', async () => {
    // One 2×1 frame (6 bytes), then silence.
    const reader = createFfmpegVideoReader(fakeFfmpeg("printf 'abcdef'; exec sleep 30"), fast);
    const frames: number[] = [];

    await expect(
      (async () => {
        for await (const frame of reader.scanFrames('https://stream.example/playlist.m3u8', 2, 2, 1)) {
          frames.push(frame.data.length);
        }
      })(),
    ).rejects.toThrow('ffmpeg scan stalled');
    expect(frames).toEqual([6]);
  });

  it('does not wait for a pipe that a leftover child process keeps open', async () => {
    const grabber = createFfmpegVideoReader(fakeFfmpeg('sleep 30'), fast);
    await expect(grabber.grabFramePng('https://stream.example/playlist.m3u8', 10)).rejects.toThrow('killed after');

    const scanner = createFfmpegVideoReader(fakeFfmpeg("printf 'abcdef'; sleep 30"), fast);
    const started = Date.now();
    await expect(
      (async () => {
        for await (const frame of scanner.scanFrames('https://stream.example/playlist.m3u8', 2, 2, 1)) void frame;
      })(),
    ).rejects.toThrow('ffmpeg scan stalled');
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('returns the frame of a grab that works', async () => {
    const reader = createFfmpegVideoReader(fakeFfmpeg("printf 'PNG'"), fast);

    expect(new TextDecoder().decode(await reader.grabFramePng('https://stream.example/playlist.m3u8', 10))).toEqual(
      'PNG',
    );
  });
});
