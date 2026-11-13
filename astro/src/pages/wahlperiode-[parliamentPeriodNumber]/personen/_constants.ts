export type FactionColor = { light: string; dark: string };

// Each faction keeps the hue it is known by. The light values sit on white, the dark ones on the dark surface; both
// were checked for at least 3:1 against their surface and for separation from the neighbouring colour under colour
// vision deficiency. Members without a faction and the mayor are deliberately neutral grey, set clearly apart in
// lightness. The graph names every member in its tooltip and the legend, so no faction relies on colour alone.
export const factionColorsByParliamentPeriod = new Map<
  string,
  Map<string, FactionColor>
>([
  [
    'leipzig-8',
    new Map([
      ['AfD', { light: '#0845c5', dark: '#3776f9' }],
      ['CDU', { light: '#16b9de', dark: '#06a2c4' }],
      ['DIE LINKE', { light: '#c535e5', dark: '#c535e5' }],
      ['Bündnis 90/Die Grünen', { light: '#3ead3e', dark: '#3ead3e' }],
      ['BSW', { light: '#8a2c58', dark: '#b3577e' }],
      ['SPD', { light: '#f33f2f', dark: '#d71a0f' }],
      ['Die Freie Fraktion', { light: '#f29200', dark: '#d17f0f' }],
      ['fraktionslos', { light: '#4f5560', dark: '#6f7580' }],
      ['Oberbürgermeister', { light: '#8a8f98', dark: '#aab0b9' }],
    ]),
  ],
]);

export function factionColorProperty(index: number): string {
  return `--faction-color-${index}`;
}

export function factionColorStyles(colors: Map<string, FactionColor>): string {
  const entries = [...colors.values()];
  const declarations = (mode: keyof FactionColor) =>
    entries
      .map((color, index) => `${factionColorProperty(index)}: ${color[mode]};`)
      .join(' ');
  return `:root { ${declarations('light')} } @media (prefers-color-scheme: dark) { :root { ${declarations('dark')} } }`;
}
