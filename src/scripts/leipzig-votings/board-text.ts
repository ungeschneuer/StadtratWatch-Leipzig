import { Buffer } from 'node:buffer';

import type { Worker } from 'tesseract.js';

import { type BoardLayout, nameColumnArea, type ResultBar } from './board-reader.ts';
import { cropForTextRecognition, type Rectangle, type RgbFrame } from './rgb-frame.ts';

export type BoardText = {
  heading: string;
  presentMembers: number | null;
  castVotes: number | null;
  resultBars: { J: number | null; N: number | null; E: number | null };
  namesByCell: { column: number; row: number; name: string }[];
};

export type TextWorkers = { text: Worker; digits: Worker };

export async function readBoardText(
  workers: TextWorkers,
  png: Uint8Array,
  layout: BoardLayout,
  resultBars: ResultBar[],
  frame: RgbFrame,
): Promise<BoardText> {
  const frameSize = frame;
  const image = Buffer.from(png);

  const headingResult = await workers.text.recognize(
    image,
    { rectangle: headingArea(layout, frameSize) },
    { blocks: true },
  );
  const heading = normalizeWhitespace(
    linesOf(headingResult.data.blocks)
      .map((line) => wordsLeftOf(line, frameSize.width * LOGO_LEFT_SHARE))
      .join(' '),
  );
  const counts = countsArea(layout, frameSize);
  const countsResult = await workers.text.recognize(image, { rectangle: counts }, { blocks: true });
  const countsLines = linesOf(countsResult.data.blocks);
  const countsText = countsLines.map((line) => line.text).join('\n');
  // A vote option without a bar has no votes; a bar whose number cannot be read stays null.
  const barCounts: BoardText['resultBars'] = { J: 0, N: 0, E: 0 };
  for (const bar of resultBars) {
    barCounts[bar.vote] = await readBarCount(workers.digits, frame, bar);
  }
  Object.assign(
    barCounts,
    inferUnreadCountsFromBarLengths(discardCountsContradictingBarLengths(barCounts, resultBars), resultBars),
  );
  const worker = workers.text;

  const namesByCell: BoardText['namesByCell'] = [];
  for (let column = 0; column < layout.columns.length; column++) {
    const area = nameColumnArea(layout, column);
    const result = await worker.recognize(image, { rectangle: area }, { blocks: true });
    for (const line of linesOf(result.data.blocks)) {
      const centerY = (line.bbox.y0 + line.bbox.y1) / 2;
      const row = Math.floor((centerY - layout.top) / layout.rowHeight);
      namesByCell.push({ column, row, name: normalizeWhitespace(line.text) });
    }
  }

  return {
    heading,
    presentMembers: await plausibleCount(findNumberAfter(countsText, /Anwesende/i), () =>
      rereadCountAfterLabel(workers.digits, frame, countsLines, /Anwesende/i),
    ),
    castVotes: await plausibleCount(findNumberAfter(countsText, CAST_VOTES_LABEL), () =>
      rereadCountAfterLabel(workers.digits, frame, countsLines, CAST_VOTES_LABEL),
    ),
    resultBars: barCounts,
    namesByCell,
  };
}

// The operator's mouse pointer sometimes rests on „Abgegebene“, so the shorter, rarely covered „Stimmen“ suffices.
export const CAST_VOTES_LABEL = /(?:Abg\S*\s*)?Stimmen:?/i;

export function findNumberAfter(text: string, label: RegExp): number | null {
  for (const line of text.split('\n')) {
    const labelMatch = line.match(label);
    if (labelMatch) {
      const number = line.slice((labelMatch.index ?? 0) + labelMatch[0].length).match(/\d+/);
      return number ? Number(number[0]) : null;
    }
  }
  return null;
}

function headingArea(layout: BoardLayout, frameSize: { width: number }): Rectangle {
  const left = layout.columns[0].left + 20;
  return { left, top: 0, width: frameSize.width - left - 10, height: layout.top - 20 };
}

// The older board shows the city logo at the top right, next to the heading.
const LOGO_LEFT_SHARE = 0.87;

function wordsLeftOf(line: Line, right: number): string {
  return line.words
    .filter((word) => word.bbox.x0 < right)
    .map((word) => word.text)
    .join(' ');
}

// „Abgegebene Stimmen“ reaches left into the column before the last one; labels keep the numbers apart.
function countsArea(layout: BoardLayout, frameSize: { height: number }): Rectangle {
  const lastColumn = layout.columns[layout.columns.length - 1];
  const left = Math.round(lastColumn.left - (lastColumn.right - lastColumn.left) * 0.45);
  const top = layout.bottom + 25;
  return {
    left,
    top,
    width: lastColumn.right - left,
    height: Math.min(130, frameSize.height - top - 45),
  };
}

// Tesseract occasionally returns nothing for a clean crop; another enlargement or offset usually reads it.
const BAR_COUNT_ATTEMPTS = [
  { offset: 4, scale: 3 },
  { offset: 8, scale: 2 },
  { offset: 8, scale: 4 },
];

// Since February 2026 the board adds the share, „14 (22 %)“. Without the bracket or the % sign the digits could have
// run together („1422“), so such a reading is rejected and the next attempt or the bar length decides.
export function parseBarCount(text: string): number | null {
  const match = text.trim().match(/^(\d{1,2})(?:\s*\(\s*\d{1,3}\s*%?\s*\)?|\s+\d{1,3}\s*%\s*\)?)?$/);
  return match ? Number(match[1]) : null;
}

async function readBarCount(worker: Worker, frame: RgbFrame, bar: ResultBar): Promise<number | null> {
  for (const { offset, scale } of BAR_COUNT_ATTEMPTS) {
    const area = { left: bar.right + offset, top: bar.top - 4, width: 150, height: bar.bottom - bar.top + 8 };
    const text = (await worker.recognize(Buffer.from(cropForTextRecognition(frame, area, scale)))).data.text;
    const count = parseBarCount(text);
    if (count !== null) return count;
  }
  return null;
}

// Bar lengths are proportional to the counts, scaled to the longest bar. A count that does not fit its bar's length
// was misread (a thin 1 read as 7) and is discarded, so the vote is reviewed instead of carrying a wrong number.
export function discardCountsContradictingBarLengths(
  counts: BoardText['resultBars'],
  bars: ResultBar[],
): BoardText['resultBars'] {
  const longest = [...bars].sort((a, b) => b.right - b.left - (a.right - a.left))[0];
  const longestCount = longest ? counts[longest.vote] : null;
  if (!longest || !longestCount) return counts;
  const pixelsPerVote = (longest.right - longest.left + 1) / longestCount;
  const checked = { ...counts };
  for (const bar of bars) {
    const count = counts[bar.vote];
    const expected = (bar.right - bar.left + 1) / pixelsPerVote;
    if (count !== null && Math.abs(count - expected) > Math.max(0.6, expected * 0.04)) {
      checked[bar.vote] = null;
    }
  }
  return checked;
}

// Tesseract often misses a lone digit next to a short bar. The bars are scaled to the longest one, whose count was read,
// so a missing count follows from its bar's length as long as that length lands close to a whole number of votes.
export function inferUnreadCountsFromBarLengths(
  counts: BoardText['resultBars'],
  bars: ResultBar[],
): BoardText['resultBars'] {
  const longest = [...bars].sort((a, b) => b.right - b.left - (a.right - a.left))[0];
  const longestCount = longest ? counts[longest.vote] : null;
  if (!longest || !longestCount) return counts;
  const pixelsPerVote = (longest.right - longest.left + 1) / longestCount;
  const inferred = { ...counts };
  for (const bar of bars) {
    if (counts[bar.vote] !== null) continue;
    const estimate = (bar.right - bar.left + 1) / pixelsPerVote;
    if (Math.abs(estimate - Math.round(estimate)) <= 0.3) inferred[bar.vote] = Math.round(estimate);
  }
  return inferred;
}

type Block = { paragraphs: { lines: Line[] }[] };
type Line = {
  text: string;
  bbox: { x0?: number; x1?: number; y0: number; y1: number };
  words: { text: string; bbox: { x0: number; x1?: number } }[];
};

// The board has 71 seats. A larger count was misread („52“ as „582“); the number is then read again on its own.
const SEAT_COUNT_LIMIT = 71;

export async function plausibleCount(
  count: number | null,
  reread: () => Promise<number | null>,
): Promise<number | null> {
  if (count !== null && count <= SEAT_COUNT_LIMIT) return count;
  const second = await reread();
  return second !== null && second <= SEAT_COUNT_LIMIT ? second : null;
}

async function rereadCountAfterLabel(
  worker: Worker,
  frame: RgbFrame,
  lines: Line[],
  label: RegExp,
): Promise<number | null> {
  const line = lines.find((candidate) => label.test(candidate.text));
  const labelWord = line?.words.findLast((word) => label.test(word.text) || /:$/.test(word.text));
  if (!line || !labelWord || line.bbox.x1 === undefined) return null;
  const left = (labelWord.bbox.x1 ?? labelWord.bbox.x0) + 4;
  const area = { left, top: line.bbox.y0 - 4, width: line.bbox.x1 - left + 8, height: line.bbox.y1 - line.bbox.y0 + 8 };
  if (area.width <= 0) return null;
  const text = (await worker.recognize(Buffer.from(cropForTextRecognition(frame, area, 3)))).data.text.trim();
  return /^\d{1,2}$/.test(text) ? Number(text) : null;
}

function linesOf(blocks: Block[] | null): Line[] {
  return (blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines));
}

function normalizeWhitespace(text: string): string {
  return text.replaceAll(/\s+/g, ' ').trim();
}

// A name the column-wide recognition garbled („[ia Juliane“) is read again from its own cell, enlarged.
export async function rereadNameCell(worker: Worker, frame: RgbFrame, area: Rectangle): Promise<string> {
  const result = await worker.recognize(Buffer.from(cropForTextRecognition(frame, area, 2)));
  return normalizeWhitespace(result.data.text);
}
