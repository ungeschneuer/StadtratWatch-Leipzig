// People are sorted by surname, as in the council's own lists. Academic titles stay part of the displayed name but
// do not decide the order: "Dr. Sabine Heymann" belongs under H. Names come as "Sabine Heymann" (registry) or as
// "Heymann, Sabine" (voting board).
const LEADING_ACADEMIC_TITLES =
  /^(?:(?:Prof|Dr|PD|Dipl\.-[\p{L}]+)\.(?:\s+(?:med|phil|jur|rer\.\s?nat|habil|h\.\s?c)\.)*\s+)+/u;

export function nameForSorting(name: string): string {
  const withoutTitles = name.replace(LEADING_ACADEMIC_TITLES, '').trim();
  if (withoutTitles.includes(',')) {
    const [surname, givenNames] = withoutTitles.split(',', 2);
    return `${surname.trim()} ${givenNames.trim()}`;
  }
  const words = withoutTitles.split(/\s+/);
  const surname = words.pop() ?? '';
  return [surname, ...words].join(' ');
}

export function compareNamesForSorting(a: string, b: string): number {
  return nameForSorting(a).localeCompare(nameForSorting(b), 'de');
}
