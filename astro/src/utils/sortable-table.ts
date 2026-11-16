export type SortType = 'number' | 'text';
export type SortDirection = 'ascending' | 'descending';

// Rates read best from the highest down, names from A.
export function nextSortDirection(
  type: SortType,
  currentDirection: SortDirection | undefined,
): SortDirection {
  if (currentDirection === undefined) {
    return type === 'number' ? 'descending' : 'ascending';
  }
  return currentDirection === 'ascending' ? 'descending' : 'ascending';
}

// A missing value („n/a“) says nothing about rank, so it stays at the end whichever way the column is sorted.
export function compareSortValues(
  a: string,
  b: string,
  type: SortType,
  direction: SortDirection,
): number {
  if (a === '' || b === '') return Number(a === '') - Number(b === '');
  const order =
    type === 'number'
      ? Number(a) - Number(b)
      : a.localeCompare(b, 'de', { sensitivity: 'base' });
  return direction === 'ascending' ? order : -order;
}

function sortValueOf(row: HTMLTableRowElement, columnIndex: number): string {
  const cell = row.cells[columnIndex];
  return cell?.dataset.sortValue ?? cell?.textContent?.trim() ?? '';
}

// The rows are rendered on the server, so the table reads without JavaScript and is in the search index; a click on a
// column head only reorders them.
export function makeTableSortable(table: HTMLTableElement): void {
  const body = table.tBodies[0];
  if (!body) return;
  table
    .querySelectorAll<HTMLButtonElement>('button[data-sort-type]')
    .forEach((button) => {
      const header = button.closest('th') as HTMLTableCellElement;
      button.addEventListener('click', () => {
        const type = button.dataset.sortType as SortType;
        const currentDirection = (header.getAttribute('aria-sort') ||
          undefined) as SortDirection | undefined;
        const direction = nextSortDirection(type, currentDirection);
        table
          .querySelectorAll('th[aria-sort]')
          .forEach((otherHeader) => otherHeader.removeAttribute('aria-sort'));
        header.setAttribute('aria-sort', direction);
        const rows = [...body.rows].toSorted((a, b) =>
          compareSortValues(
            sortValueOf(a, header.cellIndex),
            sortValueOf(b, header.cellIndex),
            type,
            direction,
          ),
        );
        body.append(...rows);
      });
    });
}

export function makeTablesSortable(): void {
  document
    .querySelectorAll<HTMLTableElement>('table[data-sortable]')
    .forEach(makeTableSortable);
}

export function sortValue(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}
