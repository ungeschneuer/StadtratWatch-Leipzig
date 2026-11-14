# leipzig-minutes-watch

## Purpose

The ALLRIS runner (`minutes-runner/`) fetches the minutes on the operator's server, outside GitHub. Nobody would notice
if it stopped, because the minutes come weeks after a session anyway. This script lists the sessions whose minutes are
overdue; the workflow `leipzig-minutes-watch` turns the list into an issue every week and closes it when nothing is
overdue.

## How it works

For every session with a votings file on the data branch it checks, counted from the session day:

| Missing                                        | after   |
| ---------------------------------------------- | ------- |
| any result from ALLRIS (`minutes-<date>.json`) | 14 days |
| `verlaufsprotokoll-<date>.json`                | 45 days |
| the signed Beschlussprotokoll (`kind`)         | 75 days |

The city published all three for 30.09.2026 within six weeks; the deadlines leave a margin. The council does not meet in
July and August, so the summer break raises nothing: there is no session whose minutes could be late.

## Usage

```bash
bun src/scripts/leipzig-minutes-watch/index.ts -d data/leipzig-8/ [--today 2026-11-20]
```

Prints Markdown, or nothing when all minutes are in time.

## Tests

```bash
bun run test
```
