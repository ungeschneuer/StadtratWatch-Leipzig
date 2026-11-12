import { decode, encode } from 'fast-png';

export type RgbFrame = {
  width: number;
  height: number;
  data: Uint8Array;
};

export type Rgb = [number, number, number];

export type Rectangle = { left: number; top: number; width: number; height: number };

export function decodePngFrame(png: Uint8Array): RgbFrame {
  const decoded = decode(png);
  if (decoded.depth !== 8 || decoded.channels < 3) {
    throw new Error(`Unsupported PNG: depth ${decoded.depth}, ${decoded.channels} channels`);
  }
  if (decoded.channels === 3) {
    return { width: decoded.width, height: decoded.height, data: Uint8Array.from(decoded.data) };
  }
  const rgb = new Uint8Array(decoded.width * decoded.height * 3);
  for (let source = 0, target = 0; target < rgb.length; source += decoded.channels, target += 3) {
    rgb[target] = decoded.data[source];
    rgb[target + 1] = decoded.data[source + 1];
    rgb[target + 2] = decoded.data[source + 2];
  }
  return { width: decoded.width, height: decoded.height, data: rgb };
}

export function encodePngFrame(frame: RgbFrame): Uint8Array {
  return encode({ width: frame.width, height: frame.height, data: frame.data, channels: 3, depth: 8 });
}

export function pixelAt(frame: RgbFrame, x: number, y: number): Rgb {
  const offset = (y * frame.width + x) * 3;
  return [frame.data[offset], frame.data[offset + 1], frame.data[offset + 2]];
}

export function countPixels(frame: RgbFrame, area: Rectangle, matches: (pixel: Rgb) => boolean, step = 1): number {
  let count = 0;
  for (let y = area.top; y < area.top + area.height; y += step) {
    for (let x = area.left; x < area.left + area.width; x += step) {
      if (matches(pixelAt(frame, x, y))) {
        count++;
      }
    }
  }
  return count;
}

export function medianColor(pixels: Rgb[]): Rgb {
  const channel = (index: number) => {
    const sorted = pixels.map((pixel) => pixel[index]).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  return [channel(0), channel(1), channel(2)];
}

export function isNearWhite([red, green, blue]: Rgb): boolean {
  return red > 225 && green > 225 && blue > 225;
}

export function isDark([red, green, blue]: Rgb): boolean {
  return red + green + blue < 300;
}

export function isVoteGreen([red, green, blue]: Rgb): boolean {
  return green > 150 && red < 130 && blue < 130;
}

export function isVoteRed([red, green, blue]: Rgb): boolean {
  return red > 170 && green < 130 && blue < 120;
}

export function isVoteYellow([red, green, blue]: Rgb): boolean {
  return red > 180 && green > 170 && blue < 100;
}

// Small printed numbers are recognised more reliably when enlarged. Greyscale works better than black and white,
// which turned a thin 1 into a 7.
export function cropForTextRecognition(frame: RgbFrame, area: Rectangle, scale: number): Uint8Array {
  const left = Math.max(0, area.left);
  const top = Math.max(0, area.top);
  const width = Math.min(area.width, frame.width - left);
  const height = Math.min(area.height, frame.height - top);
  const data = new Uint8Array(width * scale * height * scale);
  for (let y = 0; y < height * scale; y++) {
    for (let x = 0; x < width * scale; x++) {
      const [red, green, blue] = pixelAt(frame, left + Math.floor(x / scale), top + Math.floor(y / scale));
      data[y * width * scale + x] = Math.round((red + green + blue) / 3);
    }
  }
  return encode({ width: width * scale, height: height * scale, data, channels: 1, depth: 8 });
}

export function cropToPng(frame: RgbFrame, area: Rectangle): Uint8Array {
  const left = Math.max(0, area.left);
  const top = Math.max(0, area.top);
  const width = Math.min(area.width, frame.width - left);
  const height = Math.min(area.height, frame.height - top);
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const sourceStart = ((top + y) * frame.width + left) * 3;
    data.set(frame.data.subarray(sourceStart, sourceStart + width * 3), y * width * 3);
  }
  return encode({ width, height, data, channels: 3, depth: 8 });
}
