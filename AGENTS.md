# AGENTS.md

This file provides guidance to AI Agents when working with code in this repository.

## Project Overview

StadtratWatch Leipzig tracks how each member of the Leipzig city council (Ratsversammlung) votes. Votes are read from
the voting board in the city's video recordings, cross-checked against the city's minutes, and published as a static
site, an API and open data, together with speeches from the Verlaufsprotokoll. It is a fork of StadtratWatch for
Magdeburg (Code for Magdeburg); the credit and the upstream MIT copyright notice stay, everything Magdeburg-specific is
gone (ADR-0008).

## Repository Structure

- **astro/** - Web application (Node.js/npm, Astro 7, Alpine.js, Tailwind 4 + DaisyUI, Chart.js, D3)
- **src/scripts/leipzig-*/** - Data pipeline (Bun); each folder's README describes its sources, steps and outputs
- **session-review/** - Review app (React/Vite) for votes whose checks failed
- **data/leipzig-8/** - Committed data of the parliament period
- **docs/arc42/** - Architecture description (German); start at `docs/arc42/index.adoc` and keep it up to date when
  making architectural changes

## Common Commands

```bash
# Scripts (repository root)
bun install
bun run format          # bun fmt for src/ (format:check to check only)
bun run typecheck
bun run test            # never pass paths
deno lint               # Deno only lints src/

# Site (astro/)
npm run dev | build | check | test | format | format:check
```

Bun and Deno may be missing on the machine; run them via `npx -y bun@1.4.4` / `npx -y deno@2`.

## Architecture

### Data Flow

1. `leipzig-recordings` finds recordings in the city's Mediathek and archives their subtitles (`recordings.json`)
2. `leipzig-members` builds members, factions over time and election lists from OParl and Open Data (`members.json`)
3. `leipzig-votings` reads every board, checks it and links it to OParl and the minutes (`votings-<date>.json`)
4. `leipzig-papers` links each vote to its OParl paper (`papers.json`)
5. `leipzig-site-data` writes what the site reads: `registry.json`, `session-scan-*.json`, `session-speeches-*.json`
6. Astro builds the static site from `data/`; `deploy.yml` publishes it with the review app on GitHub Pages

The workflows in `.github/workflows/` run these steps. New data and corrections collect on the branch
`data/leipzig-votings` and reach `main` through its pull request; reviewers decide failed checks in the review app.

### Key Models

Models are shared between Astro and the scripts: the canonical definitions live in `astro/src/models/` and are
re-exported through the `@srw-astro/models` workspace package in `src/deps/astro/`. `registry.json` is the source of
truth for a parliament period (persons, factions, parties, sessions); persons carry `factionMemberships` and
`partyMemberships`, and analyses use the affiliation of the session day. A vote's `reviewStatus` (`provisional`,
`needs-review`) marks it as not finally checked; the site says so on every such vote.

### Site

- Site settings (name, contact, repositories, data pull request link) live in `astro/src/utils/site-config.ts`.
- The site is served below a base path (GitHub project page). Every internal link goes through `sitePath()`
  (`astro/src/utils/site-path.ts`), Alpine expressions use `window.sitePath()`, tabs change only the query.
- Build variables: `SITE_URL`, `SITE_BASE`, `DATA_REPOSITORY`, `DATA_PULL_REQUEST_URL`, `DEFAULT_PARLIAMENT_PERIOD`
  (see `astro/astro.config.mjs`).
- Public API v1 in `astro/src/pages/api/v1/` (docs: its `README.md`).

## Testing Changes

- Enable the versioned pre-commit hook once per clone: `git config core.hooksPath .githooks`
- Astro: Vitest (`npm test` in `astro/`); scripts: `bun:test` (`bun run test`)
- CI (`.github/workflows/ci.yml`) runs Deno lint, Bun checks and Astro checks; all must pass before merging

## Code Conventions

- **Shared models**: Define canonical model changes in `astro/src/models/`. A new model file also needs a one-line re-export in `src/deps/astro/` and an entry in the `exports` map of `src/deps/astro/package.json`
- **`src/` formatting**: `bun fmt`, single quotes, 120 char line width (see `bunfig.toml`)
- **Astro formatting**: Uses Prettier with .prettierrc
- **File naming**: Use kebab-case for directories and TypeScript files. Existing camelCase and PascalCase files keep their names
- **Session IDs**: Always use ISO date format YYYY-MM-DD
- **Code Style**:
  - **Always** write self-documenting code with clear, descriptive names
  - **Always** refactor unclear code rather than adding explanatory comments
  - **Always** extract complex logic into well-named functions
  - **Never** add comments explaining what code does. Exception: Comments explaining why (business rules, external constraints) are fine. Comments explaining *what* means the code needs refactoring.
  - **Never** use cryptic abbreviations or unclear variable names

## Boundaries

- **Always** give commits and PR descriptions human attribution only: no AI co-author trailers, no "Generated with" footers
- **Never** commit secrets or `.env` files
- **Never** force push to main
- Code goes to `main` by pull request; data under `data/leipzig-8/` goes through the data branch and its pull request
- Corrections to approved session data go in their own PR whose title names the error; never mix them into a PR that adds new sessions
- Use only free services (GitHub Actions, Pages, Releases) and public sources; no contact with the city of Leipzig

## Important Notes

- Votes are read by colour from the board, so a misread vote attributes behaviour to a real person: publish it only with its check status
- Speeches: full texts only on the session page (§ 48 UrhG); the person page lists date and duration
- "Partei" means the 2024 election list unless an override with a source says otherwise
- Some parties may have an "EXTREMIST_CLASSIFICATION" field in registry due to constitutional protection office classifications (LfV Sachsen)

## Agent skills

### Issue tracker

Issues live in GitHub Issues (ungeschneuer/StadtratWatch-Leipzig), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at the repo root + ADRs in `docs/arc42/09-architekturentscheidungen/`. See `docs/agents/domain.md`.
