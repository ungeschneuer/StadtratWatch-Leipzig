import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type BoardCell, BoardLayoutError, findResultBars, readBoard } from './board-reader.ts';
import { decodePngFrame, type RgbFrame } from './rgb-frame.ts';

// Frames of the 2026-10-29, 2026-01-28 and 2025-12-18 recordings, colour depth reduced to keep the fixtures small.
function fixture(name: string): RgbFrame {
  return decodePngFrame(new Uint8Array(readFileSync(join(import.meta.dir, 'test-fixtures', name))));
}

function countBy(cells: BoardCell[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const cell of cells) {
    const key = cell.kind === 'seat' ? cell.state : cell.kind;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function stateAt(cells: BoardCell[], column: number, row: number): string {
  const cell = cells.find((candidate) => candidate.column === column && candidate.row === row);
  return cell?.kind === 'seat' ? cell.state : (cell?.kind ?? 'missing');
}

describe('readBoard', () => {
  it('finds the table below a two-line heading', () => {
    const { layout } = readBoard(fixture('board-13-33-13-two-line-heading.png'));

    expect(layout.columns.map((column) => column.left)).toEqual([120, 542, 964, 1386]);
    expect(layout.rowCount).toEqual(22);
    expect(layout.top).toEqual(140);
    expect(layout.bottom).toEqual(883);
  });

  it('reads every seat of the 13/33/13 vote', () => {
    const { cells } = readBoard(fixture('board-13-33-13-two-line-heading.png'));

    expect(countBy(cells)).toEqual({ header: 9, empty: 8, J: 13, N: 33, E: 13, present: 1, absent: 11 });
  });

  it('tells present non-voters from absent members', () => {
    const { cells } = readBoard(fixture('board-13-33-13-two-line-heading.png'));

    expect(stateAt(cells, 3, 17)).toEqual('present');
    expect(stateAt(cells, 0, 3)).toEqual('absent');
    expect(stateAt(cells, 0, 0)).toEqual('header');
    expect(stateAt(cells, 0, 14)).toEqual('empty');
  });

  it('reads a single abstention', () => {
    const { cells } = readBoard(fixture('board-42-16-1.png'));

    expect(countBy(cells)).toMatchObject({ J: 42, N: 16, E: 1, present: 1, absent: 11 });
  });

  it('measures the older five-column layout', () => {
    const { layout, cells } = readBoard(fixture('board-2025-five-columns-26-27-6.png'));

    expect(layout.columns).toHaveLength(5);
    expect(layout.rowCount).toEqual(19);
    expect(countBy(cells)).toEqual({ header: 9, empty: 15, J: 26, N: 27, E: 6, absent: 12 });
  });

  it('keeps a column whose number cells are almost all green', () => {
    const { layout, cells } = readBoard(fixture('board-2026-01-green-number-column-54-11-0.png'));

    expect(layout.columns[2]).toEqual({ left: 774, right: 1145 });
    expect(countBy(cells)).toMatchObject({ J: 54, N: 11, present: 1, absent: 4 });
  });

  it('finds the narrow bar of a single vote on the board since February 2026', () => {
    const frame = fixture('board-2026-02-single-abstention-63-1-1.png');

    expect(findResultBars(frame, readBoard(frame).layout).map((bar) => bar.vote)).toEqual(['J', 'N', 'E']);
  });

  it('finds no result bars while the vote is still open', () => {
    const frame = fixture('board-2026-02-voting-in-progress.png');

    expect(findResultBars(frame, readBoard(frame).layout)).toEqual([]);
  });

  it('rejects frames without the board', () => {
    const blank = { width: 1920, height: 1080, data: new Uint8Array(1920 * 1080 * 3).fill(30) };

    expect(() => readBoard(blank)).toThrow(BoardLayoutError);
  });
});

describe('findResultBars', () => {
  it('finds all three bars, including one for a single vote', () => {
    const frame = fixture('board-42-16-1.png');
    const bars = findResultBars(frame, readBoard(frame).layout);

    expect(bars.map((bar) => bar.vote)).toEqual(['J', 'N', 'E']);
    expect(bars[0].right).toBeGreaterThan(bars[1].right);
    expect(bars[1].right).toBeGreaterThan(bars[2].right);
  });

  it('places equal counts at equal length', () => {
    const frame = fixture('board-13-33-13-two-line-heading.png');
    const [yes, , abstentions] = findResultBars(frame, readBoard(frame).layout);

    expect(Math.abs(yes.right - abstentions.right)).toBeLessThan(6);
  });
});
