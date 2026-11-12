import type { APIRoute } from 'astro';
import { sitePath } from '@utils/site-path';

const getRobotsTxt = (sitemapURL: URL) => `\
User-agent: *
Allow: /

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL(sitePath('/sitemap-index.xml'), site);
  return new Response(getRobotsTxt(sitemapURL));
};
