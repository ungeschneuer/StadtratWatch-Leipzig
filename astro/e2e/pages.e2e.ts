import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// One page of every kind, with every tab: regressions in tables, contrast, labels or layout show up here first.
const PAGES = [
  '',
  'wahlperiode-8/',
  'wahlperiode-8/sitzungen/',
  'wahlperiode-8/sitzung/2026-09-30/?tab=votings',
  'wahlperiode-8/sitzung/2026-01-28/?tab=speeches',
  'wahlperiode-8/sitzung/2026-01-28/?tab=speaking-times',
  'wahlperiode-8/sitzung/2026-09-30/abstimmung/12.6.2-2/',
  'wahlperiode-8/sitzung/2026-05-28/abstimmung/18.7.1/',
  'wahlperiode-8/fraktionen/',
  'wahlperiode-8/fraktion/spd/?tab=councilors',
  'wahlperiode-8/fraktion/spd/?tab=motions',
  'wahlperiode-8/fraktion/spd/?tab=statistics',
  'wahlperiode-8/parteien/',
  'wahlperiode-8/partei/fdp/?tab=statistics',
  'wahlperiode-8/personen/?tab=list',
  'wahlperiode-8/personen/?tab=graph',
  'wahlperiode-8/person/jens-lehmann/?tab=statistics',
  'wahlperiode-8/person/jens-lehmann/?tab=speeches',
  'wahlperiode-8/person/jens-lehmann/?tab=voting-matrix',
  'wahlperiode-8/person/jens-lehmann/?tab=bodies',
  'suche/',
  'api/',
  'api/v1/README/',
  'impressum/',
  'datenschutz/',
  'kontakt/',
];

async function openPage(page: Page, path: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(path, { waitUntil: 'networkidle' });
  expect(response?.status(), path).toBe(200);
  return errors;
}

for (const path of PAGES) {
  test(`${path || 'Startseite'}`, async ({ page }) => {
    const errors = await openPage(page, path);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'Seite breiter als der Bildschirm').toBeLessThanOrEqual(0);
    expect(await page.locator('h1').count(), 'genau eine Hauptüberschrift').toBe(1);

    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const violations = accessibility.violations.map(
      (violation) =>
        `${violation.id}: ${violation.help} (${violation.nodes.length}×, z. B. ${violation.nodes[0]?.target.join(' ')})`,
    );
    expect(violations, 'Barrierefreiheit (WCAG 2.1 AA)').toEqual([]);
    expect(errors, 'JavaScript-Fehler').toEqual([]);
  });
}
