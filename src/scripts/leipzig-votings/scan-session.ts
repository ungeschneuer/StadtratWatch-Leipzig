import type { VideoReader } from './ffmpeg.ts';
import { classifyScanFrame, findVoteEvents, type ScanFrameFlags, type VoteEvent } from './vote-events.ts';

// Result bars stay visible for as little as two seconds, so the scan samples twice per second.
export const SCAN_FRAMES_PER_SECOND = 2;
const SCAN_WIDTH = 160;
const SCAN_HEIGHT = 90;

export async function scanVoteEvents(video: VideoReader, lowResolutionUrl: string): Promise<VoteEvent[]> {
  const flags: ScanFrameFlags[] = [];
  for await (const frame of video.scanFrames(lowResolutionUrl, SCAN_FRAMES_PER_SECOND, SCAN_WIDTH, SCAN_HEIGHT)) {
    flags.push(classifyScanFrame(frame));
  }
  return findVoteEvents(flags, SCAN_FRAMES_PER_SECOND);
}
