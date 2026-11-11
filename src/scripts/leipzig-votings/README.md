# leipzig-votings

## Purpose

Reads every electronic vote of a Leipzig council session, seat by seat, from the voting board that the city shows
full-screen in its recording. Each vote is cross-checked against independent sources and marked `verified` or
`needs-review`. Input is the recordings manifest written by [`leipzig-recordings`](../leipzig-recordings/README.md).

## How it works

1. **Scan.** The lowest HLS variant (360p) is decoded at 2 frames per second and shrunk to 160×90 px. A frame counts as
   _board_ when it is mostly white, and as _result_ when coloured result bars (Ja/Nein/Enthaltung) sit below the
   table. Every run of result frames is one vote. The board resets between votes, so consecutive votes stay apart.
2. **Read.** Two full-HD frames of each result phase are grabbed. The table grid (4 columns × 22 rows) is located
   from its border lines in every frame, not assumed. Per row:
   - grey name cell: faction heading; white name cell without text: empty row; otherwise a seat
   - number cell green / red / yellow: Ja / Nein / Enthaltung
   - white number cell with seat number: present, did not vote; without number: absent
3. **Text.** Tesseract reads the heading (TOP, paper reference, title), „Anwesende“, „Abgegebene Stimmen“ and the
   number next to each result bar. A bar number that does not fit the bar's length is discarded as misread; one that
   is missing is derived from the bar's length when that lands on a whole number of votes. Seat names are read once and again only when the name columns change; they are
   matched to the OParl roster of the session day; a name that matches no one is read again from its own cell.
   The board layout is measured, not assumed: until early 2026 Leipzig used 5 columns × 19 rows with the city logo
   next to the heading, since then 4 × 22.
4. **Check.** Each vote is compared with:

   | Check                                | Source                                                |
   | ------------------------------------ | ----------------------------------------------------- |
   | `seats-complete`                     | one seat per OParl member of the day, none unreadable |
   | `second-frame-agrees`                | second frame of the result phase                      |
   | `colours-match-result-bars`          | numbers printed next to the result bars               |
   | `colours-match-cast-votes`           | „Abgegebene Stimmen“                                  |
   | `seat-numbers-match-present-members` | „Anwesende“                                           |
   | `names-match-roster`                 | OParl members of the council on the session day       |
   | `agenda-item-in-oparl`               | OParl agenda of the meeting and the neighbouring day  |
   | `paper-matches-oparl`                | paper of the OParl agenda item, period numeral aside  |
   | `outcome-matches-oparl`              | OParl result, if the agenda item has exactly one vote |
   | `announcement-matches`               | result the chair announces, read from the subtitles   |
   | `result-shown-long-enough`           | result bars visible for at least 1.5 s                |
   | `most-present-members-voted`         | at least half of „Anwesende“ cast a vote              |
   | `not-repeated`                       | the chair did not have the vote repeated              |
   | `matches-official`                   | official result, or members added by hand named       |
   | `official-sources-agree`             | minutes and Verlaufsprotokoll give the same result    |

   | Status         | Meaning                                                                                                                                                          |
   | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `verified`     | every check passed and the board equals the official result                                                                                                      |
   | `corrected`    | the official result differs, and the protocol names who was added by hand; their seats were changed                                                              |
   | `provisional`  | every check passed, but no official result is published yet                                                                                                      |
   | `needs-review` | at least one check failed                                                                                                                                        |
   | `skipped`      | a check failed on a procedural motion (postponement, end of debate, order of the agenda), which is not reviewed                                                  |
   | `reviewed`     | a human corrected or approved the vote in the corrections file                                                                                                   |
   | `discarded`    | no valid vote (bars that only flashed up, count in progress, repeated or duplicated vote), found by the checks or a human; kept in the JSON, left out of the CSV |

   Details of the checks:
   - The expected seat count is the number of OParl members of the day, mayor included; a vacant mandate has no seat.
     OParl starts a successor's membership the day after the session that swore them in, so members starting within a
     week after the session are matched as well and counted when the board shows them.
   - The longest bar always has the same length, so a misread number next to it escapes the length check. Bar numbers
     that do not add up to „Abgegebene Stimmen“ count as misread; then, or when a bar number stays unread, the
     colours stand if the cast votes and the spoken announcement confirm them.
   - Since February 2026 the bar numbers carry the share, „14 (22 %)“; the count before the bracket is used.
   - Two-day sessions share one agenda that OParl splits between two meetings, so both are searched.
   - Sub-items for amendments (18.16.1) are missing in OParl. They pass when the board's paper has the kind and serial number of the
     parent item's paper, taken from OParl or, if OParl only has a „bereits behandelt“ placeholder, from the board of
     the parent item's own vote.
   - The board and OParl sometimes number the amendments of one item differently (OParl lists one the board skips).
     If the board's paper differs from its TOP's paper and exactly one sibling item has the board's paper, the vote is
     linked to that item (`oparl.matchedByPaper`); the paper is more specific than the number.
   - The board may name the original paper where OParl links its revision (`…-02011` vs. `…-02011-NF-01`); that
     passes, two different revisions do not.
   - A round green status dot below the table during the vote is not a result bar: bars are rectangles.
   - OCR cannot tell the period numerals VII and VIII apart, and papers of the previous period are still voted on;
     the paper comparison ignores the numeral.
   - In the subtitles a point or comma separates counts only without a space („13.33.13“); „Beschlusspunkt 1. 18 zu
     44 zu 2“ is 18/44/2.
   - The board also shows bars while members are still voting, and for a moment when the operator loads the next item
     before resetting the board. Such a phase lasts under a second; it, or a board on which fewer than half of those
     present voted, goes to review with the suggestion to discard it.
   - Announcements without abstentions („22 zu 31 abgelehnt“) compare Ja and Nein only. Counts the subtitles ran
     together beyond the 71 seats („48 zu 92“) are split, and a figure the chair corrects at once („11 zu 49 zu 3 …
     12, Entschuldigung, 12 zu 49 zu 3“) is replaced by the corrected one.
   - The stream shows the board up to about 20 seconds after the chair has read out the result. Announcements are
     searched from 30 seconds before the board; one that equals a neighbouring vote's board belongs to that vote.

   **Sources and their order.** Each source is used for what it is good at:

   | Source                                                | Gives                                                                 | Available   |
   | ----------------------------------------------------- | --------------------------------------------------------------------- | ----------- |
   | Board in the video                                    | the vote of each person; nothing else has it                          | same day    |
   | ALLRIS agenda item pages (`to020`)                    | official result per item and point                                    | a few days  |
   | Minutes (Beschlussprotokoll, OParl `resultsProtocol`) | official result per item and point, procedural motions with counts    | some weeks  |
   | Verlaufsprotokoll (attachment of the meeting page)    | every result in session order and who was added by hand               | ~two months |
   | AI subtitles                                          | announcement and names, standing in until an official result is there | same day    |
   | OParl agenda                                          | agenda item and paper                                                 | same day    |
   1. The board's own checks decide whether its seats can be used.
   2. The official result comes from the minutes, until they appear from the agenda item pages; boards are matched to
      it by agenda item and paper first, counts second, and a board without heading is placed by the Verlaufsprotokoll,
      which follows the session and is aligned with the boards in order. If both are there, they must agree.
   3. If the official result differs from the board, someone was added by hand. Members the Verlaufsprotokoll (or,
      until it appears, the announcement) names who explain the whole difference become a correction (`corrected`);
      the board reading is kept in `boardVote`. If nobody is named but exactly as many members are present without a
      vote as were added, they are taken as the ones added (`basis: only-non-voters`). Otherwise the vote needs review.
   4. An announcement that differs from the board no longer counts once the official result is there.
   5. Boards that are no result of their own are discarded: bars that only flashed up, a count in progress, a vote the
      chair had repeated (only the repetition counts) and the same board shown twice. An official result equal to the
      board settles these checks first, so a real result stays.
   6. Procedural motions are not reviewed. The minutes mark them; a board without heading counts as one when the call
      before it (Verlaufsprotokoll, else subtitles) speaks of postponement, end of debate, order of the agenda and the
      like. They keep `procedural: true` in the JSON and the CSV.

   Parsed sources are stored as `minutes-<date>.json` and `verlaufsprotokoll-<date>.json`; the PDFs are cached, so a
   better parser reads them again without downloading. Until a source is there, every run looks again (`--offline`
   skips that).

   Spoken corrections („Herr X wird hinzugezählt“) make the announcement check fail on purpose: the board then differs
   from the official result and needs a human. `checkStatus` keeps the status from the checks alone.

Votes taken without the board (show of hands, secret ballots) are not visible in the video and are not captured.

## Usage

From the repository root:

```bash
bun src/scripts/leipzig-votings/index.ts                   # every available recording without votings file
bun src/scripts/leipzig-votings/index.ts -s 2026-10-29     # one session
```

| Flag              | Description                                                     |
| ----------------- | --------------------------------------------------------------- |
| `-d, --data-dir`  | Directory of the parliament period. Default: `data/leipzig-8/`. |
| `-c, --cache-dir` | Directory for scan results. Default: `output/leipzig-votings/`. |
| `-s, --session`   | Session to process; repeatable.                                 |
| `--rescan`        | Scan the video again although a cached scan exists.             |
| `--force`         | Process sessions that already have a votings file.              |
| `-h, --help`      | Show the help text and exit.                                    |

| Environment variable | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `FFMPEG_PATH`        | ffmpeg binary. Default: `ffmpeg` from `PATH`.        |
| `SCRAPER_USER_AGENT` | Optional User-Agent for OParl and the stream hoster. |

Tesseract downloads its German language data on the first run.

## Corrections

Human corrections live next to the data in `data/leipzig-8/{date}/corrections-{date}.json` and are applied after every
run, so a re-extraction never loses them:

```json
[
  {
    "voting": { "videoSeconds": 2711, "agendaItemNumber": "19.10.2" },
    "seats": [{ "personId": "https://www.leipzig.sitzung-online.de/oparl/persons/…", "vote": "J" }],
    "reason": "Herr Stange mündlich hinzugezählt",
    "source": "Untertitel 00:45:12"
  },
  { "voting": { "videoSeconds": 5600 }, "approve": true, "reason": "Belegbild geprüft" }
]
```

For every vote whose checks end in `needs-review`, the extraction saves the full-HD frame it read as
`<cache-dir>/evidence/<date>/<date>-<index>-board.png`, plus `-heading.png` and `-bars.png` cut from it. CI publishes
them as assets of the release `evidence-<date>`, so a review stays possible after the recording is gone from the
Mediathek.

- `voting.videoSeconds` is the `videoSeconds.start` of the vote (±15 s); `agendaItemNumber` is optional and narrows
  the match.
- `seats` change single votes; `approve` accepts a vote as read; `discard` marks it as no valid vote; `agendaItemNumber` assigns the TOP to a vote whose
  board names none (the older board shows only „ABSTIMMUNG“ for votes on procedural motions). Every entry needs a
  `reason`.
- Corrected seats keep the board reading in `boardVote`; the vote's status becomes `reviewed`.
- A correction that matches no vote or several votes fails the run before anything is written.

After editing the file, apply it without reading the video again:

```bash
bun src/scripts/leipzig-votings/index.ts --corrections-only -s 2026-10-29
```

## Hangs and loops

The stream hoster now and then stops sending without closing the connection, and ffmpeg would then wait forever.
Every step that waits has a limit, and a step over its limit fails visibly instead of blocking the run:

| Step                | Limit                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| ffmpeg read         | `-rw_timeout` 30 s                                                                     |
| Frame grab          | killed after 90 s, three attempts                                                      |
| Scan of a recording | killed when no frame arrived for 2 min                                                 |
| One vote            | 8 min; the vote is marked unreadable and goes to review                                |
| One session         | 2 h; the session fails before its next vote, nothing is written, the next session runs |
| HTTP request        | 60 s, two retries for timeouts, 429 and 5xx                                            |
| OParl paging        | fails when a page repeats or after 500 pages                                           |
| CI extraction step  | 300 min, before the job's 350 min, so what was read is still committed                 |

## Review

Several people can review side by side; the steps are automated by GitHub Actions:

1. **Extraction** (`.github/workflows/leipzig-votings.yml`, after a recordings update reaches `main`, weekly, or by
   hand): new sessions are read, the evidence images are published, and data goes to the branch
   `data/leipzig-votings` with one pull request into `main`.
2. **Notification:** one issue per session with open cases (label `leipzig-review`), with a checklist and a link to
   each case. Logins in the repository variable `LEIPZIG_REVIEWERS` (comma-separated) are assigned and notified. A
   weekly reminder comments on open issues (`leipzig-review-reminder.yml`).
3. **Review UI** (`session-review`, route `/leipzig`, published on GitHub Pages under `/review/`): per case the
   recording at the right second, the evidence images, the subtitles around the vote, neighbouring votes, ALLRIS and
   OParl links, and ready-made suggestions. A reviewer signs in with a personal fine-grained token for this repository
   („Contents: Read and write“); each decision is committed to `corrections-<date>.json` on the data branch with the
   reviewer's login and time. Without a token, a decision is submitted as a pre-filled issue.
4. **Recheck** (`leipzig-review-recheck.yml`, on every push of a corrections file): validates the file, applies it
   with `--corrections-only`, commits the updated data and ticks the case off in the issue. A broken file fails this
   check on the pull request.
5. **Release:** once every case is decided, the issue closes itself; merging the pull request publishes the data.

`review-<date>.json` holds the cases of a session as the UI shows them (type `ReviewCasesFile` in
`astro/src/models/leipzig-review.ts`); `review-index.json` lists the sessions. Suggestions:

| Case                       | Suggestion                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Spoken correction          | Members named in the subtitles are moved to the option the announcement has more of, until counts agree |
| Board without TOP          | TOP numbers spoken up to three minutes before the vote, then the TOP of the votes before and after      |
| Paper, outcome, bar number | Confirm the board reading, with the reason prefilled                                                    |

One-time setup of the fork: GitHub Pages with source „GitHub Actions“; write access for the reviewers; optionally the
variable `LEIPZIG_REVIEWERS`.

## Output

| File                                        | Content                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `data/leipzig-8/{date}/votings-{date}.json` | Every vote with heading, OParl link, board numbers, seats, checks, status |
| `data/leipzig-8/{date}/votes-{date}.csv`    | One row per seat and vote                                                 |
| `data/leipzig-8/{date}/review-{date}.json`  | The votes a human has to check, with evidence, links and suggestions      |
| `data/leipzig-8/review-index.json`          | Sessions with their number of open and decided review cases               |

Vote codes follow StadtratWatch: `J`, `N`, `E`, `O` (did not vote). `attendance` tells present non-voters from absent
members. In the CSV, `boardVote` is the vote as read from the board and `vote` the vote after corrections.

## Tests

```bash
bun run test
```

The board fixtures are frames of the 2026-10-29 recording with reduced colour depth.
