import { formatDate } from './format-date.ts';

export function formatPeriod(start: string | null, end: string | null): string {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `seit ${formatDate(start)}`;
  if (end) return `bis ${formatDate(end)}`;
  return '';
}
