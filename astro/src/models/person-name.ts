// Academic titles stay part of the displayed name but do not decide where a person is sorted: "Dr. Sabine Heymann"
// belongs under S like "Sabine Hartmann", not under D.
const LEADING_ACADEMIC_TITLES =
  /^(?:(?:Prof|Dr|PD|Dipl\.-[\p{L}]+)\.(?:\s+(?:med|phil|jur|rer\.\s?nat|habil|h\.\s?c)\.)*\s+)+/u;

export function nameForSorting(name: string): string {
  return name.replace(LEADING_ACADEMIC_TITLES, '');
}

export function compareNamesForSorting(a: string, b: string): number {
  return nameForSorting(a).localeCompare(nameForSorting(b), 'de');
}
