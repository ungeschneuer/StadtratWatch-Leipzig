# leipzig-papers

## Purpose

Links every vote read by [`leipzig-votings`](../leipzig-votings/README.md) to the OParl paper it was about, with the
paper's title, type, page in the council information system and submitters. [`leipzig-site-data`](../leipzig-site-data/README.md)
takes the submitters as the authors of a motion and the exact reference from it.

## How it works

1. The vote's agenda item leads to its consultation and on to the paper (`agendaItem` → `consultation` → `paper`).
2. If the board names another paper than the agenda item, it is an amendment, which has no agenda item of its own in
   OParl. It is looked up among the main paper's `subordinatedPaper`, ignoring deleted papers and the period numeral
   that OCR confuses (VII/VIII).
3. The submitters are the organizations in `underDirectionOf`: the office of a faction („Geschäftsstelle der Fraktion
   Bündnis 90/Die Grünen“) or of the administration („02.8 Dezernat Wirtschaft, Arbeit und Digitales“).

4. **Family.** Each paper keeps the paper it belongs to (`superordinatedPaper`: the original of a revision, the main
   paper of an amendment). Papers above a voted one are added too, voted or not, so the site can show a main paper with
   its revisions, amendments and the administration's statement. Papers written before keep their data and only get
   the relation.

A vote once linked keeps its paper, so a run fetches only votes of new sessions or votes linked to no paper so far.
Discarded votes are not linked.

## Usage

From the repository root:

```bash
bun src/scripts/leipzig-papers/index.ts
```

| Flag             | Description                                                     |
| ---------------- | --------------------------------------------------------------- |
| `-d, --data-dir` | Directory of the parliament period. Default: `data/leipzig-8/`. |
| `-h, --help`     | Show the help text and exit.                                    |

| Environment variable | Description                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| `SCRAPER_USER_AGENT` | Optional User-Agent; the default names the project and its repository. |

The workflow `leipzig-votings.yml` runs it after the extraction.

## Output

`data/leipzig-8/papers.json`:

| Field     | Content                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `papers`  | Per OParl paper ID: `reference`, `name`, `paperType`, `date`, `web`, `originators` (ID, name), `superordinatedPaperIds` |
| `votings` | Per session day and vote index in the scan: the OParl paper ID                                                          |

OParl data: CC BY 4.0, Stadt Leipzig.

## Tests

```bash
bun run test
```
