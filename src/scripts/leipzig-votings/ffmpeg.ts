import type { RgbFrame } from './rgb-frame.ts';

export type VideoReader = {
  scanFrames(url: string, framesPerSecond: number, width: number, height: number): AsyncGenerator<RgbFrame>;
  grabFramePng(url: string, seconds: number): Promise<Uint8Array>;
};

// The stream hoster now and then stops sending without closing the connection, and ffmpeg then waits forever. A read
// that stalls for this long aborts, and a frame grab is killed after GRAB_TIMEOUT_MILLISECONDS and retried.
const STALLED_READ_MICROSECONDS = '30000000';
const GRAB_TIMEOUT_MILLISECONDS = 90_000;
const SCAN_IDLE_TIMEOUT_MILLISECONDS = 120_000;

export function createFfmpegVideoReader(
  ffmpegPath: string,
  {
    grabTimeoutMilliseconds = GRAB_TIMEOUT_MILLISECONDS,
    scanIdleTimeoutMilliseconds = SCAN_IDLE_TIMEOUT_MILLISECONDS,
    retryPauseMilliseconds = 2000,
  } = {},
): VideoReader {
  return {
    async *scanFrames(url, framesPerSecond, width, height) {
      const process = Bun.spawn(
        [
          ffmpegPath,
          ...['-loglevel', 'error', '-rw_timeout', STALLED_READ_MICROSECONDS],
          ...['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '10'],
          ...['-i', url, '-an', '-vf', `fps=${framesPerSecond},scale=${width}:${height}`],
          ...['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        ],
        { stdout: 'pipe', stderr: 'pipe' },
      );
      // A scan that delivers nothing for a while has stalled somewhere ffmpeg's own timeout does not reach. The read
      // is cancelled as well, so the scan ends even if something else keeps the pipe open.
      const reader = process.stdout.getReader();
      let lastData = Date.now();
      let stalled = false;
      const watchdog = setInterval(() => {
        if (Date.now() - lastData > scanIdleTimeoutMilliseconds) {
          stalled = true;
          process.kill('SIGKILL');
          void reader.cancel().catch(() => undefined);
        }
      }, 250);
      try {
        const frameBytes = width * height * 3;
        let pending: Uint8Array = new Uint8Array(0);
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
          lastData = Date.now();
          pending = concat(pending, chunk.value);
          while (pending.length >= frameBytes) {
            yield { width, height, data: pending.slice(0, frameBytes) };
            pending = pending.slice(frameBytes);
          }
        }
        if (stalled) {
          throw new Error(`ffmpeg scan stalled: no frame for ${scanIdleTimeoutMilliseconds / 1000}s`);
        }
        const exitCode = await process.exited;
        if (exitCode !== 0) {
          throw new Error(`ffmpeg scan failed (${exitCode}): ${await new Response(process.stderr).text()}`);
        }
      } finally {
        clearInterval(watchdog);
        if (process.exitCode === null) process.kill('SIGKILL');
      }
    },

    async grabFramePng(url, seconds) {
      let lastError = '';
      for (let attempt = 1; attempt <= 3; attempt++) {
        const process = Bun.spawn(
          [
            ffmpegPath,
            ...['-loglevel', 'error', '-rw_timeout', STALLED_READ_MICROSECONDS, '-ss', seconds.toFixed(2), '-i', url],
            ...['-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
          ],
          { stdout: 'pipe', stderr: 'pipe', timeout: grabTimeoutMilliseconds, killSignal: 'SIGKILL' },
        );
        // The output is read while ffmpeg runs, since a PNG overfills the pipe; after a kill it is not waited for.
        const output = new Response(process.stdout).arrayBuffer();
        const exitCode = await process.exited;
        if (process.signalCode) {
          output.catch(() => undefined);
          lastError = `killed after ${grabTimeoutMilliseconds / 1000}s`;
        } else {
          const png = new Uint8Array(await output);
          if (exitCode === 0 && png.length > 0) return png;
          lastError = await new Response(process.stderr).text();
        }
        await Bun.sleep(retryPauseMilliseconds * attempt);
      }
      throw new Error(`ffmpeg could not grab a frame at ${seconds}s: ${lastError}`);
    },
  };
}

function concat(first: Uint8Array, second: Uint8Array): Uint8Array {
  const combined = new Uint8Array(first.length + second.length);
  combined.set(first);
  combined.set(second, first.length);
  return combined;
}
