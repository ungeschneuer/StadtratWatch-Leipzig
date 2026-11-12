# leipzig-members

## Purpose

Builds the members of the Leipzig city council (Ratsversammlung) for one parliament period and links each of them to
their faction and their party. The votes read by [`leipzig-votings`](../leipzig-votings/README.md) name people by their
OParl ID; this module says who they are, which faction they sat in on a given day and on which list they were elected.

## Sources

| Source                                                            | Used for                                         | Licence                                              |
| ----------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| OParl `https://www.leipzig.sitzung-online.de/oparl/bodies/2387`   | Persons, council and faction memberships, dates  | CC BY 4.0, Stadt Leipzig                             |
| Open Data „Stadtratswahl 2024: Bewerberinnen und Bewerber“ (CSV)  | The list each member stood on in 2024            | Datenlizenz Deutschland – Namensnennung 2.0, Leipzig |
| `data/leipzig-8/{date}/votes-{date}.csv` (from `leipzig-votings`) | Who sat on the voting board on which session day | —                                                    |
| `data/leipzig-8/member-overrides.json`                            | Corrections, each with reason and source         | —                                                    |

## How it works

1. **Council members.** Every membership in the council (`organizations/gr/2387`) that lasts into the period, cut to
   the period. The member with the role „Oberbürgermeister“ is the mayor.
2. **Factions.** Memberships in organizations with `classification: "Fraktion"`, cut to the council membership. A new
   role in the same faction (chair, deputy) starts a new OParl membership; consecutive ones are merged. Time without a
   faction is `fraktionslos`; the mayor belongs to the pseudo-faction `oberbuergermeister`, as in StadtratWatch.
   Overlapping faction memberships are reported, not resolved.
3. **Party.** Family name and first given name are matched in the candidates list, ignoring case, accents and titles.
   A member who has since taken a double name („Schreyer-Krieg“) is found by one part of it (`match: former-name`).
   The list says where someone stood in 2024, not whether they are a party member; the field is `partySource`, and a
   different party needs an override with a source.
4. **Board.** OParl starts a successor's membership on the day after the session that swore them in, where they already
   vote. A member read from the board up to 7 days before their OParl start starts on that session day. A member on
   the board outside their membership otherwise is reported.
5. **Overrides** are applied on every run: `exclude` (a membership OParl lists although the seat was not taken),
   `name`/`givenName`/`familyName` (misspellings), `party`. Every entry needs `reason` and `source`.
6. **Checks.** Exactly 71 members (70 councillors and the mayor) sit on the day of the run; each of them has a faction
   or is `fraktionslos`; each member has a party; overrides refer to members of the period; IDs are unique. A failed
   check exits with code 1 after writing the files, so the change is visible.

## Usage

From the repository root:

```bash
bun src/scripts/leipzig-members/index.ts
```

| Flag                  | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| `-d, --data-dir`      | Directory of the parliament period. Default: `data/leipzig-8/`. |
| `--parliament-period` | ID of the parliament period. Default: `leipzig-8`.              |
| `--period-start`      | Day of the constituent session. Default: `2024-09-18`.          |
| `-h, --help`          | Show the help text and exit.                                    |

| Environment variable | Description                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| `SCRAPER_USER_AGENT` | Optional User-Agent; the default names the project and its repository. |

The workflow `.github/workflows/leipzig-members.yml` runs daily and proposes changes as a pull request; a failed check
opens an issue. The faction and party columns of the votes tables are written by `leipzig-votings` from `members.json`.

## Output

| File                                     | Content                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `data/leipzig-8/members.json`            | Factions, parties and persons in StadtratWatch registry form, with history |
| `data/leipzig-8/persons.csv`             | One row per person                                                         |
| `data/leipzig-8/faction-memberships.csv` | One row per faction membership, with start and end                         |

`members.json` has the type `LeipzigMembersFile` (`astro/src/models/leipzig-members.ts`). Factions, parties and persons
have the fields of the StadtratWatch registry (`factionId` and `partyId` are the latest), plus:

| Field                | Meaning                                                                          |
| -------------------- | -------------------------------------------------------------------------------- |
| `oparlId`            | OParl person or organization; the key the votes use                              |
| `factionMemberships` | Faction per period; `factionOn(person, date)` gives the faction on a session day |
| `partySource`        | `election-list` with the list name and how the name matched, or `override`       |
| `start`, `end`       | Council membership; `null` from the start of the period or while it lasts        |
| `seats`              | Members of the faction or party on the day of the run                            |

## Tests

```bash
bun run test
```
