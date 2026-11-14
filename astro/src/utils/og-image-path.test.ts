import { expect, test } from 'vitest';
import { ogImagePathOf } from './og-image-path';

test('puts the image of a page at the page path below /og/', () => {
  expect(ogImagePathOf('/wahlperiode-8/person/jens-lehmann/')).toEqual(
    '/og/wahlperiode-8/person/jens-lehmann.png',
  );
  expect(ogImagePathOf('/')).toEqual('/og/start.png');
  expect(ogImagePathOf('')).toEqual('/og/start.png');
});
