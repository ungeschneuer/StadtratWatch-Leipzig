import { readBoard } from './board-reader.ts';
import { cropToPng, decodePngFrame } from './rgb-frame.ts';

// The heading and the result area are what a reviewer compares first; they are cut out of the full board frame.
export function cropEvidence(boardPng: Uint8Array): { heading: Uint8Array; bars: Uint8Array } | null {
  const frame = decodePngFrame(boardPng);
  try {
    const { layout } = readBoard(frame);
    return {
      heading: cropToPng(frame, { left: 0, top: 0, width: frame.width, height: layout.top }),
      bars: cropToPng(frame, { left: 0, top: layout.bottom, width: frame.width, height: frame.height - layout.bottom }),
    };
  } catch {
    return null;
  }
}
