# StadtratWatch Leipzig: Web Application

Web frontend of StadtratWatch Leipzig: votes, speeches and analyses of the Leipzig city council (Ratsversammlung). Built with Astro 7, Alpine.js, Tailwind CSS, and Chart.js.

## Prerequisites

- Node.js 22 (a recent 22.x; Astro 7 refuses old minor versions) and npm
- The data of `data/leipzig-8/` (on `main` once the data pull request is merged, otherwise on the branch `data/leipzig-votings`)

## Getting Started

```sh
# Install dependencies
npm install

# Start development server
npm run dev
```

The dev server runs at `http://localhost:4321`

## Project Structure

```text
astro/
├── public/              # Static assets (images, fonts)
├── src/
│   ├── components/      # Reusable Astro/Alpine.js components
│   ├── data-analysis/   # Voting analysis algorithms
│   ├── layouts/         # Page layouts
│   ├── models/          # TypeScript models (shared with the Bun scripts)
│   ├── pages/           # Routes (file-based routing)
│   │   └── api/v1/      # REST API endpoints
│   ├── styles/          # Global CSS
│   └── utils/           # Helpers, site settings (site-config.ts), base path (site-path.ts)
└── astro.config.mjs     # Astro configuration + env vars
```

## Commands

| Command                | Action                                                                                     |
| :--------------------- | :----------------------------------------------------------------------------------------- |
| `npm install`          | Install dependencies                                                                       |
| `npm run dev`          | Start dev server at `localhost:4321`                                                       |
| `npm run build`        | Build production site to `./dist/`, then the Pagefind search index into `./dist/pagefind/` |
| `npm run preview`      | Preview production build locally                                                           |
| `npm test`             | Run Vitest tests                                                                           |
| `npm run format`       | Format code with Prettier                                                                  |
| `npm run format:check` | Check code formatting                                                                      |

## Configuration

All variables are optional and set by `.github/workflows/deploy.yml` (schema in `astro.config.mjs`):

- `SITE_URL`, `SITE_BASE` - Address and base path of the site (default: the GitHub project page `/StadtratWatch-Leipzig`)
- `DATA_REPOSITORY` - GitHub repository for source and data links
- `DATA_PULL_REQUEST_URL` - Open pull request of the data branch (default: a search that finds it)
- `DEFAULT_PARLIAMENT_PERIOD` - Default period ID (default `leipzig-8`)

Every internal link goes through `sitePath()` so the site works below its base path.

## Data Sources

The application reads from the `../data/` directory. Its layout is described in `docs/arc42/05-bausteinsicht/index.adoc` (section "Aufbau der Datenablage"); the files are written by `src/scripts/leipzig-site-data`.

## Tech Stack

- **Astro 7** - Static site generator
- **Alpine.js** - Lightweight JavaScript framework
- **Tailwind CSS 4 + DaisyUI** - Styling
- **Chart.js + D3.js** - Data visualization

### Search

The search page `/suche` uses [Pagefind](https://pagefind.app): `npm run build` indexes the built pages, and the
browser searches the index; there is no search service. Pages are indexed through `data-pagefind-body` in
`PageLayout`; the name lists of each vote are left out (`data-pagefind-ignore`), so a name finds the person's page.
`astro dev` has no index.

## API

Public REST API available at `/api/v1/`. See `src/pages/api/v1/README.md` for documentation.
