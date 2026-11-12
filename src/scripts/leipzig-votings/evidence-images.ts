import { readBoard } from './board-reader.ts';
import { cropToPng, decodePngFrame, encodePngFrame, type RgbFrame } from './rgb-frame.ts';

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

// A vote's image is published as a quotation backing the votes read from it (§ 51 UrhG), so it shows only the board
// the votes were read from, unmarked and at a reduced size rather than as the city's full-HD frame.
const QUOTATION_IMAGE_WIDTH = 960;

export function toQuotationImage(boardPng: Uint8Array): Uint8Array {
  const frame = decodePngFrame(boardPng);
  const factor = Math.max(1, Math.round(frame.width / QUOTATION_IMAGE_WIDTH));
  return encodePngFrame(downscale(frame, factor));
}

function downscale(frame: RgbFrame, factor: number): RgbFrame {
  const width = Math.floor(frame.width / factor);
  const height = Math.floor(frame.height / factor);
  const data = new Uint8Array(width * height * 3);
  const pixelsPerBlock = factor * factor;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let channel = 0; channel < 3; channel++) {
        let sum = 0;
        for (let blockY = 0; blockY < factor; blockY++) {
          const row = (y * factor + blockY) * frame.width;
          for (let blockX = 0; blockX < factor; blockX++) {
            sum += frame.data[(row + x * factor + blockX) * 3 + channel];
          }
        }
        data[(y * width + x) * 3 + channel] = Math.round(sum / pixelsPerBlock);
      }
    }
  }
  return { width, height, data };
}
