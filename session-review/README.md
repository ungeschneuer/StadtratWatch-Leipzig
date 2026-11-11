# StadtratWatch Session Review

Maintainer tool for manually reviewing and correcting the machine-generated data of a council session before it is
published. Built with React, Vite, and TypeScript.

It is a client-only single-page app without a backend: it loads a session's data from CloudFront, and every save is a
browser file download. The downloaded files are then uploaded to S3 or committed to `data/` by hand. Where each file
goes is described in `docs/guides/session-processing/session-processing-pipeline.md`.

## Views

Each view works on one session, identified by its date (`YYYY-MM-DD`):

| Route                            | Purpose                                                                   | Saves                           |
| -------------------------------- | ------------------------------------------------------------------------- | ------------------------------- |
| `/session/{sessionDate}/votings`  | Check and correct votes, agenda items, and paper references from the OCR scan; set majority requirement and present members, see the computed voting result | `session-scan-{date}.json`      |
| `/session/{sessionDate}/speakers` | Assign speaker segments to persons, remove noise, generate speeches       | `session-speakers-{date}.json`, `session-speeches-{date}.json` |
| `/session/{sessionDate}/speeches` | Review speeches and mark chair contributions                              | `session-speeches-{date}.json`  |

### Leipzig

`/leipzig` lists the Leipzig sessions with open review cases, `/leipzig/{sessionDate}` shows the cases of one session
(see `src/scripts/leipzig-votings/README.md`, section „Review“). Unlike the Magdeburg views it saves to GitHub: a
reviewer signs in with a personal token, and each decision is committed to the session's corrections file on the
branch `data/leipzig-votings`. In development (`npm run dev`) it reads `../data/leipzig-8/` and the evidence images in
`../output/leipzig-votings/evidence/`; the published build reads the data branch from GitHub. The build needs the
dependencies of `astro/` installed, because the shared models compile with its `tsconfig.json`.

## Development

```bash
cd session-review

npm install
npm run dev       # Start dev server, then open e.g. /session/2024-06-17/votings
npm run build     # Type-check and build
npm run lint      # Run ESLint
```

The CloudFront base URL is configured in `src/constants/env.ts`.

The session scan types and the voting result calculation come from the shared models (`@srw-astro/models`, resolved
to `../src/deps/astro/` in `vite.config.ts` and `tsconfig.app.json`). The parliament period registries are bundled from
`../data/*/registry.json`, so a session must have its entry in `registry.json` before its voting result can be shown.
