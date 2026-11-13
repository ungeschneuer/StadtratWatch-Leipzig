import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { expect, test } from 'vitest';
import VotingQuotationImage from './VotingQuotationImage.astro';

// The site, not a person, quotes the board image (§ 51 UrhG); the caption names it with its contact address.
test('credits the quotation to the project', async () => {
  const container = await AstroContainer.create();
  const html = await container.renderToString(VotingQuotationImage, {
    props: {
      imageUrl: 'x.png',
      sessionDate: '2026-09-30',
      videoTimestamp: '1:44:30',
    },
  });
  const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  expect(text).toContain(
    'Zitiert von StadtratWatch Leipzig (hallo [at] schneuer [punkt] online) als Beleg',
  );
});
