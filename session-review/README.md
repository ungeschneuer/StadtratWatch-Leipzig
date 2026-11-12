# StadtratWatch Leipzig: Prüfoberfläche

Tool for reviewers to decide the Leipzig votes whose automatic checks failed, before they count as checked. Built with
React, Vite and TypeScript. It is a client-only single-page app without a backend.

## Views

| Route                     | Purpose                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `/leipzig`                | Sessions with open review cases                                                      |
| `/leipzig/{sessionDate}`  | The cases of one session, with the board image, the video at the vote and a decision |

Other paths redirect to `/leipzig`. The cases and how they are decided are described in
`src/scripts/leipzig-votings/README.md`, section „Review“.

A reviewer signs in with a personal GitHub token, and each decision is committed to the session's corrections file on
the branch `data/leipzig-votings`; the open pull request of that branch carries it to `main`. In development
(`npm run dev`) the app reads `../data/leipzig-8/` and the evidence images in `../output/leipzig-votings/evidence/`;
the published build reads the data branch from GitHub. The deploy workflow publishes it below `/review/` of the site.

## Development

```bash
cd session-review

npm install
npm run dev       # Start dev server, then open /leipzig
npm run build     # Type-check and build
npm run lint      # Run ESLint
```

The build needs the dependencies of `astro/` installed, because the shared models (`@srw-astro/models`, resolved to
`../src/deps/astro/` in `vite.config.ts` and `tsconfig.app.json`) compile with its `tsconfig.json`.
