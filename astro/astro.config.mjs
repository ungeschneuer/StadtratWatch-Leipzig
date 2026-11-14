// @ts-check
import { defineConfig, envField, passthroughImageService } from 'astro/config';
import alpinejs from '@astrojs/alpinejs';
import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// The site is served by GitHub Pages as a project page, i.e. below the repository name. SITE_URL and SITE_BASE
// switch it to another address (e.g. an own domain with base '/') without touching any link.
const siteUrl = process.env.SITE_URL ?? 'https://ungeschneuer.github.io';
const siteBase = process.env.SITE_BASE ?? '/StadtratWatch-Leipzig';

export default defineConfig({
  // The default theme (github-dark) renders comments below the WCAG AA contrast ratio.
  markdown: { shikiConfig: { theme: 'github-dark-default' } },
  site: siteUrl,
  base: siteBase,
  trailingSlash: 'ignore',
  env: {
    schema: {
      DEFAULT_PARLIAMENT_PERIOD: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
        default: 'leipzig-8',
      }),
      DATA_REPOSITORY: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
        default: 'ungeschneuer/StadtratWatch-Leipzig',
      }),
      // Set by the deploy workflow to the open pull request of the data branch; without it the site links a search
      // that finds that pull request.
      DATA_PULL_REQUEST_URL: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
    },
  },

  // /pp/, /privacy/ and /contact/ only forward the addresses of the time before the German ones.
  integrations: [
    alpinejs(),
    sitemap({
      filter: (page) =>
        !/\/(pp|privacy|contact)\//.test(new URL(page).pathname),
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  image: {
    service: passthroughImageService(),
  },
});
