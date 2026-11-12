import {
  countPixels,
  isDark,
  isNearWhite,
  isVoteGreen,
  isVoteRed,
  isVoteYellow,
  medianColor,
  pixelAt,
  type Rectangle,
  type Rgb,
  type RgbFrame,
} from './rgb-frame.ts';

// Leipzig has used two board layouts so far (5 columns × 19 rows until early 2026, then 4 × 22); the grid is measured
// in every frame and only checked for plausibility.
const MINIMUM_COLUMNS = 3;
const MAXIMUM_COLUMNS = 6;

export type SeatState = 'J' | 'N' | 'E' | 'present' | 'absent' | 'unknown';

export type BoardCell =
  | { kind: 'header'; column: number; row: number }
  | { kind: 'empty'; column: number; row: number }
  | { kind: 'seat'; column: number; row: number; state: SeatState };

export type BoardLayout = {
  columns: { left: number; right: number }[];
  top: number;
  bottom: number;
  rowCount: number;
  rowHeight: number;
  numberCellWidth: number;
};

export type BoardReading = {
  layout: BoardLayout;
  cells: BoardCell[];
};

export type ResultBar = { vote: 'J' | 'N' | 'E'; top: number; bottom: number; left: number; right: number };

export class BoardLayoutError extends Error {}

const CELL_INSET = 5;

export function readBoard(frame: RgbFrame): BoardReading {
  const layout = detectLayout(frame);
  const cells: BoardCell[] = [];
  for (let column = 0; column < layout.columns.length; column++) {
    for (let row = 0; row < layout.rowCount; row++) {
      cells.push(readCell(frame, layout, column, row));
    }
  }
  return { layout, cells };
}

export function numberCellArea(layout: BoardLayout, column: number, row: number): Rectangle {
  const { top, height } = rowBand(layout, row);
  return {
    left: layout.columns[column].left + CELL_INSET,
    top,
    width: layout.numberCellWidth - 2 * CELL_INSET,
    height,
  };
}

export function nameCellArea(layout: BoardLayout, column: number, row: number): Rectangle {
  const { top, height } = rowBand(layout, row);
  const left = layout.columns[column].left + layout.numberCellWidth + CELL_INSET;
  return { left, top, width: layout.columns[column].right - CELL_INSET - left, height };
}

export function nameColumnArea(layout: BoardLayout, column: number): Rectangle {
  const first = nameCellArea(layout, column, 0);
  return { ...first, top: layout.top + 2, height: layout.bottom - layout.top - 4 };
}

// The result bars start at a common left edge below the table; each bar's length is proportional to its count and the
// count is printed right of the bar. Bars of a zero count have no coloured pixels and are reported without position.
// A single vote draws a bar of 6 px (board since February 2026) to 12 px (older board) at full HD. The round status
// dot shown during the vote is as wide as such a bar, so it is told apart by its shape, not its width: a bar is about
// as tall as a table row (32 to 38 px), the dot half of that (13 to 17 px).
const MINIMUM_BAR_WIDTH = 4;
const MINIMUM_BAR_HEIGHT_IN_ROWS = 0.75;

export function findResultBars(frame: RgbFrame, layout: BoardLayout): ResultBar[] {
  const searchTop = layout.bottom + 20;
  const searchRight = layout.columns[layout.columns.length - 1].left - 30;
  const bars: ResultBar[] = [];
  for (const [vote, matches] of [
    ['J', isVoteGreen],
    ['N', isVoteRed],
    ['E', isVoteYellow],
  ] as const) {
    const rows: number[] = [];
    for (let y = searchTop; y < frame.height; y++) {
      const line = { left: layout.columns[0].left, top: y, width: searchRight - layout.columns[0].left, height: 1 };
      if (countPixels(frame, line, matches) > 3) {
        rows.push(y);
      }
    }
    const band = groupAdjacent(rows).sort((a, b) => b.end - b.start - (a.end - a.start))[0];
    if (!band || band.end - band.start + 1 < layout.rowHeight * MINIMUM_BAR_HEIGHT_IN_ROWS) {
      continue;
    }
    const middle = Math.round((band.start + band.end) / 2);
    const extent = (y: number) => {
      let left = -1;
      let right = layout.columns[0].left;
      for (let x = layout.columns[0].left; x < searchRight; x++) {
        if (matches(pixelAt(frame, x, y))) {
          if (left < 0) left = x;
          right = x;
        }
      }
      return { left, right, width: left < 0 ? 0 : right - left + 1 };
    };
    const { left, right, width } = extent(middle);
    // A rectangle is as wide near its top edge as in the middle; a round shape is much narrower there.
    const nearTop = extent(band.start + 3);
    if (width < MINIMUM_BAR_WIDTH || nearTop.width < width * 0.8) {
      continue;
    }
    bars.push({ vote, top: band.start, bottom: band.end, left, right });
  }
  return bars;
}

function detectLayout(frame: RgbFrame): BoardLayout {
  const columns = findColumnBoxes(frame);
  const [top, bottom] = findTableTopAndBottom(frame, columns[0]);
  const numberCellWidth = findNumberCellWidth(frame, columns[0], top, bottom);
  const rowHeight = findRowHeight(
    frame,
    { left: columns[0].left + numberCellWidth, right: columns[0].right },
    top,
    bottom,
  );
  if (rowHeight < frame.height * 0.025 || rowHeight > frame.height * 0.045) {
    throw new BoardLayoutError(`Implausible row height ${rowHeight.toFixed(1)} px`);
  }
  const rowCount = Math.round((bottom - top) / rowHeight);
  return { columns, top, bottom, rowCount, rowHeight: (bottom - top) / rowCount, numberCellWidth };
}

// Thin grey lines separate the rows; header rows are grey bands, which are too thick to count as a line.
function findRowHeight(
  frame: RgbFrame,
  nameArea: { left: number; right: number },
  top: number,
  bottom: number,
): number {
  const width = nameArea.right - nameArea.left - 20;
  const lineYs: number[] = [];
  for (let y = top + 2; y < bottom - 2; y++) {
    const line = { left: nameArea.left + 10, top: y, width, height: 1 };
    if (countPixels(frame, line, isGridGrey, 2) > (width / 2) * 0.6) {
      lineYs.push(y);
    }
  }
  const separators = groupAdjacent(lineYs).filter((line) => line.end - line.start <= 4);
  const gaps = separators
    .slice(1)
    .map((line, index) => (line.start + line.end) / 2 - (separators[index].start + separators[index].end) / 2)
    .filter((gap) => gap > frame.height * 0.02)
    .sort((a, b) => a - b);
  if (gaps.length < 5) {
    throw new BoardLayoutError(`Only ${separators.length} row lines found`);
  }
  return gaps[Math.floor(gaps.length / 2)];
}

// A vertical line separates seat number and name; it is the most continuous non-white column near the box's left edge.
function findNumberCellWidth(
  frame: RgbFrame,
  box: { left: number; right: number },
  top: number,
  bottom: number,
): number {
  const height = bottom - top;
  let best = { x: 0, count: 0 };
  for (let x = box.left + 20; x < box.left + (box.right - box.left) * 0.3; x++) {
    const count = countPixels(frame, { left: x, top, width: 1, height }, (pixel) => !isNearWhite(pixel), 2);
    if (count > best.count) best = { x, count };
  }
  if (best.count < (height / 2) * 0.5) {
    throw new BoardLayoutError('Seat number column not found');
  }
  return best.x - box.left;
}

function isGridGrey([red, green, blue]: Rgb): boolean {
  return red > 120 && red < 222 && Math.abs(red - blue) < 15 && Math.abs(red - green) < 15;
}

function findColumnBoxes(frame: RgbFrame): { left: number; right: number }[] {
  const sampleTop = Math.round(frame.height * 0.2);
  const sampleHeight = Math.round(frame.height * 0.6);
  const lineXs: number[] = [];
  for (let x = 0; x < frame.width; x++) {
    const darkCount = countPixels(frame, { left: x, top: sampleTop, width: 1, height: sampleHeight }, isDark, 4);
    if (darkCount > (sampleHeight / 4) * 0.8) {
      lineXs.push(x);
    }
  }
  const lines = groupAdjacent(lineXs);
  const minimumBoxWidth = frame.width * 0.15;
  const maximumGapBetweenBoxes = frame.width * 0.012;
  const boxes: { left: number; right: number }[] = [];
  // When almost every number cell of a column is coloured, compression darkens the separator between number and name
  // cells until it looks like a border. A line that close to the box's left border is skipped; only the narrow gap
  // between two boxes starts a new one.
  let leftBorder = lines[0];
  for (const line of lines.slice(1)) {
    const left = leftBorder.end + 1;
    const right = line.start - 1;
    if (right - left > minimumBoxWidth) {
      boxes.push({ left, right });
      leftBorder = line;
    } else if (right - left <= maximumGapBetweenBoxes) {
      leftBorder = line;
    }
  }
  if (boxes.length < MINIMUM_COLUMNS || boxes.length > MAXIMUM_COLUMNS) {
    throw new BoardLayoutError(
      `Expected ${MINIMUM_COLUMNS} to ${MAXIMUM_COLUMNS} table columns, found ${boxes.length}`,
    );
  }
  return boxes;
}

function findTableTopAndBottom(frame: RgbFrame, box: { left: number; right: number }): [number, number] {
  const width = box.right - box.left;
  const lineYs: number[] = [];
  for (let y = 0; y < frame.height; y++) {
    if (countPixels(frame, { left: box.left, top: y, width, height: 1 }, isDark, 4) > (width / 4) * 0.8) {
      lineYs.push(y);
    }
  }
  const lines = groupAdjacent(lineYs);
  if (lines.length < 2) {
    throw new BoardLayoutError('Table border not found');
  }
  return [lines[0].end + 1, lines[lines.length - 1].start];
}

function readCell(frame: RgbFrame, layout: BoardLayout, column: number, row: number): BoardCell {
  const nameArea = nameCellArea(layout, column, row);
  const namePixels = collectPixels(frame, nameArea, 2);
  const nameBackground = medianColor(namePixels.filter((pixel) => !isDark(pixel)));
  if (!isNearWhite(nameBackground)) {
    return { kind: 'header', column, row };
  }
  const hasName = namePixels.filter(isDark).length > 10;
  const state = readSeatState(frame, numberCellArea(layout, column, row));
  if (!hasName) {
    return state === 'absent' ? { kind: 'empty', column, row } : { kind: 'seat', column, row, state: 'unknown' };
  }
  return { kind: 'seat', column, row, state };
}

// A coloured number cell is a cast vote; a white cell still showing the seat number belongs to a member who is
// logged in but did not vote; a white cell without number belongs to an absent member.
function readSeatState(frame: RgbFrame, area: Rectangle): SeatState {
  const pixels = collectPixels(frame, area, 1);
  const background = medianColor(pixels.filter((pixel) => !isDark(pixel)));
  const hasNumber = pixels.filter(isDark).length > 15;
  if (isVoteGreen(background)) return hasNumber ? 'J' : 'unknown';
  if (isVoteRed(background)) return hasNumber ? 'N' : 'unknown';
  if (isVoteYellow(background)) return hasNumber ? 'E' : 'unknown';
  if (isNearWhite(background)) return hasNumber ? 'present' : 'absent';
  return 'unknown';
}

function rowBand(layout: BoardLayout, row: number): { top: number; height: number } {
  const top = Math.round(layout.top + row * layout.rowHeight) + CELL_INSET;
  const bottom = Math.round(layout.top + (row + 1) * layout.rowHeight) - CELL_INSET;
  return { top, height: bottom - top };
}

function collectPixels(frame: RgbFrame, area: Rectangle, step: number): Rgb[] {
  const pixels: Rgb[] = [];
  for (let y = area.top; y < area.top + area.height; y += step) {
    for (let x = area.left; x < area.left + area.width; x += step) {
      pixels.push(pixelAt(frame, x, y));
    }
  }
  return pixels;
}

function groupAdjacent(positions: number[]): { start: number; end: number }[] {
  const groups: { start: number; end: number }[] = [];
  for (const position of positions) {
    const last = groups[groups.length - 1];
    if (last && position <= last.end + 2) {
      last.end = position;
    } else {
      groups.push({ start: position, end: position });
    }
  }
  return groups;
}
