# leipzig-site-data

## Purpose

Turns the Leipzig data of a parliament period into the files the StadtratWatch site reads. The site, its analyses and
the API v1 then work for Leipzig as they do for Magdeburg. The script reads only committed files and needs no network.

| Input                                                 | From                                                    |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `data/leipzig-8/papers.json`                          | [`leipzig-papers`](../leipzig-papers/README.md)         |
| `data/leipzig-8/members.json`                         | [`leipzig-members`](../leipzig-members/README.md)       |
| `data/leipzig-8/recordings.json`                      | [`leipzig-recordings`](../leipzig-recordings/README.md) |
| `data/leipzig-8/{date}/votings-{date}.json`, minutes  | [`leipzig-votings`](../leipzig-votings/README.md)       |
| `data/leipzig-8/{date}/verlaufsprotokoll-{date}.json` | [`leipzig-votings`](../leipzig-votings/README.md)       |
| `data/leipzig-8/{date}/subtitles-{date}.vtt`          | [`leipzig-recordings`](../leipzig-recordings/README.md) |

## How it works

- **Which votes.** Votes with the status `verified`, `corrected`, `reviewed` or `provisional` are published. Votes that
  wait for a human (`needs-review`), are no valid result (`discarded`) or are procedural motions with failed checks
  (`skipped`) stay off the site until a reviewer decides them.
- **Session approved.** `approved` is true once no vote of the session waits for review or for its official result;
  until then the site shows its notice that the check of the session is not finished.
- **Names.** Votes name people as `members.json` does, which is how the site matches them to the registry.
- **Subject.** TOP from the board (or the official result), paper from the board (or OParl), title from the OParl
  agenda item (the board's heading is OCR and only stands in). The type follows the paper reference: `-ÄA-` is an
  Änderungsantrag, `A` an Antrag, `DS` a Beschlussvorlage; procedural motions are Geschäftsordnung.
- **Video.** Leipzig's recordings are in the city's Mediathek, not on YouTube: `youtubeUrl` is empty and `video` links
  the Mediathek page while it is online. The Mediathek has no links to a time.
- **IDs.** `votingFilename` is `<date>-<NNN>.png` with the position of the vote in the scan, so a vote keeps its address
  on the site when another vote of the session is decided later.

Authors come from `papers.json` ([`leipzig-papers`](../leipzig-papers/README.md)): a faction's office becomes the
faction's name, as the site credits motions by it; offices of the administration keep their name. OParl names one
submitter per paper, so a joint motion counts for that faction only. The paper reference is taken from OParl where the
vote is linked, which corrects the period numeral OCR confuses.

**History.** The registry carries each person's `factionMemberships` and `partyMemberships`, so the site counts every
vote for the faction and party of its session day.

Not yet carried over: the majority a vote needed (always simple).

## Speeches

Speaker and text come from the Verlaufsprotokoll, the edited record of the session, about two months after it; the
times come from the subtitles. A session gets speeches once both are there.

- **Times.** Every sequence of five words that occurs exactly once in the protocol and exactly once in the subtitles
  ties a protocol word to a time; of these ties, the longest run in the same order is kept, so a phrase said twice
  cannot move a contribution. Between two ties the time is interpolated; where the gap holds much more time than its
  words take (a break, a vote), a contribution starts right before its first tied words and ends right after its last.
  A session has 6,000 to 26,000 ties; about 70 % of the contributions contain one, the others are short calls of the
  chair between them.
- **Check.** The results in the protocol lie within 90 seconds of the board of the same vote in the video (433 of 434
  in the 13 sessions of 2025-12 to 2026-09).
- **Speakers.** Councillors by family name (or one part of a double name), told apart by the faction or party in
  brackets, and named as `members.json` names them; the mayor as a member. Whoever chairs is `isChairPerson`, which
  keeps the chair out of the speaking times. Deputy mayors and other guests keep the name the protocol gives them and
  `onBehalfOf` their role. Residents („Einwohner“) are private persons and left out. A councillor not in
  `members.json` keeps the protocol's name and is reported as a warning.
- **Rights.** § 48 Abs. 1 Nr. 2 UrhG allows publishing speeches made in public sessions of a municipal council, but not
  a collection that consists mostly of one person's speeches (Abs. 2). The registry therefore names the protocol as
  `speechesSource`; the site shows the texts only on the session page, the person page lists date and length with a
  link, and the API marks the texts as not under CC0.

## Usage

From the repository root:

```bash
bun src/scripts/leipzig-site-data/index.ts
```

| Flag                       | Description                                                     |
| -------------------------- | --------------------------------------------------------------- |
| `-d, --data-dir`           | Directory of the parliament period. Default: `data/leipzig-8/`. |
| `--parliament-period`      | ID of the parliament period. Default: `leipzig-8`.              |
| `--parliament-period-name` | Name shown on the site. Default: `Leipzig – Wahlperiode VIII`.  |
| `-h, --help`               | Show the help text and exit.                                    |

The workflows `leipzig-votings.yml` and `leipzig-review-recheck.yml` run it after every extraction and every review
decision. A change of `members.json` reaches the site with the next of these runs.

## Output

| File                                                 | Content                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| `data/leipzig-8/registry.json`                       | Period, sessions, factions, parties, persons (type `Registry`) |
| `data/leipzig-8/{date}/session-scan-{date}.json`     | The published votes of a session (type `SessionScan`)          |
| `data/leipzig-8/{date}/session-speeches-{date}.json` | The speeches of a session (type `SessionSpeech[]`)             |
| `data/leipzig-8/voting-paper-map.json`               | Empty: Leipzig papers have no pages on the site yet            |

The Astro build loads every `registry.json` under `data/`, so writing it puts the period on the site.

## Tests

```bash
bun run test
```
