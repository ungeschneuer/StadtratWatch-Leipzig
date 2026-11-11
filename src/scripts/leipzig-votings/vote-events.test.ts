import { describe, expect, it } from 'bun:test';

import type { RgbFrame } from './rgb-frame.ts';
import { classifyScanFrame, findVoteEvents, type ScanFrameFlags } from './vote-events.ts';

const WIDTH = 160;
const HEIGHT = 90;

function frame(background: number, bar?: [number, number, number]): RgbFrame {
  const data = new Uint8Array(WIDTH * HEIGHT * 3).fill(background);
  if (bar) {
    for (let y = 77; y < 80; y++) {
      for (let x = 15; x < 50; x++) {
        data.set(bar, (y * WIDTH + x) * 3);
      }
    }
  }
  return { width: WIDTH, height: HEIGHT, data };
}

describe('classifyScanFrame', () => {
  it('recognises the board with result bars', () => {
    expect(classifyScanFrame(frame(250, [40, 220, 40]))).toEqual({ isBoard: true, hasResultBars: true });
  });

  it('recognises the board while voting is still open', () => {
    expect(classifyScanFrame(frame(250))).toEqual({ isBoard: true, hasResultBars: false });
  });

  it('ignores coloured areas outside the board', () => {
    expect(classifyScanFrame(frame(60, [40, 220, 40]))).toEqual({ isBoard: false, hasResultBars: false });
  });
});

describe('findVoteEvents', () => {
  const bars: ScanFrameFlags = { isBoard: true, hasResultBars: true };
  const board: ScanFrameFlags = { isBoard: true, hasResultBars: false };
  const camera: ScanFrameFlags = { isBoard: false, hasResultBars: false };

  it('turns runs of result frames into events', () => {
    expect(findVoteEvents([camera, board, bars, bars, board, bars, camera], 2)).toEqual([
      { startSeconds: 1, endSeconds: 1.5 },
      { startSeconds: 2.5, endSeconds: 2.5 },
    ]);
  });

  it('closes an event at the end of the recording', () => {
    expect(findVoteEvents([board, bars], 2)).toEqual([{ startSeconds: 0.5, endSeconds: 0.5 }]);
  });
});
