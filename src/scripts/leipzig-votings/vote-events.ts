import { countPixels, isNearWhite, isVoteGreen, isVoteRed, isVoteYellow, type RgbFrame } from './rgb-frame.ts';

export type ScanFrameFlags = { isBoard: boolean; hasResultBars: boolean };

export type VoteEvent = { startSeconds: number; endSeconds: number };

// The voting board is a white full-screen slide. After a vote closes, coloured result bars (Ja/Nein/Enthaltung)
// appear below the table at the left; they vanish when the board resets for the next vote.
export function classifyScanFrame(frame: RgbFrame): ScanFrameFlags {
  const whiteShare =
    countPixels(frame, { left: 0, top: 0, width: frame.width, height: frame.height }, isNearWhite, 2) /
    Math.ceil(frame.width / 2) /
    Math.ceil(frame.height / 2);
  const isBoard = whiteShare > 0.5;
  const barArea = {
    left: Math.round(frame.width * 0.06),
    top: Math.round(frame.height * 0.84),
    width: Math.round(frame.width * 0.44),
    height: Math.round(frame.height * 0.12),
  };
  const barPixels = countPixels(
    frame,
    barArea,
    (pixel) => isVoteGreen(pixel) || isVoteRed(pixel) || isVoteYellow(pixel),
  );
  return { isBoard, hasResultBars: isBoard && barPixels > barArea.width * barArea.height * 0.02 };
}

export function findVoteEvents(flags: ScanFrameFlags[], framesPerSecond: number): VoteEvent[] {
  const events: VoteEvent[] = [];
  let startIndex: number | undefined;
  flags.forEach((frame, index) => {
    if (frame.hasResultBars && startIndex === undefined) {
      startIndex = index;
    }
    if (!frame.hasResultBars && startIndex !== undefined) {
      events.push(toEvent(startIndex, index - 1, framesPerSecond));
      startIndex = undefined;
    }
  });
  if (startIndex !== undefined) {
    events.push(toEvent(startIndex, flags.length - 1, framesPerSecond));
  }
  return events;
}

function toEvent(firstIndex: number, lastIndex: number, framesPerSecond: number): VoteEvent {
  return { startSeconds: firstIndex / framesPerSecond, endSeconds: lastIndex / framesPerSecond };
}
