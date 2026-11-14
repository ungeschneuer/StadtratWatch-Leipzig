// The image of a page lives below /og/ at the page's own path: /wahlperiode-8/person/x/ → /og/wahlperiode-8/person/x.png;
// the start page and every page without an image of its own use /og/start.png.
export function ogImagePathOf(pagePath: string): string {
  const trimmed = pagePath.replace(/^\/+|\/+$/g, '');
  return `/og/${trimmed || 'start'}.png`;
}
