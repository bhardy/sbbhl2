# SBBHL

The Super Best Buds Hockey League site. Two pages:

- **Lineup Helper** (`/`, `/team/...`): per-team lineups and games played against the weekly position caps, pulled live from Fantrax.
- **All-Time Records** (`/records`): records by franchise or manager across every season, including the old Yahoo seasons (2013-14 to 2019-20) and every Fantrax season since.

## Development

```bash
npm install
npm run dev # http://localhost:3001
```

Requires Node 24 (see `.nvmrc`).

## How the data works

- `app/constants/league.ts` holds `LEAGUE_ID`, the Fantrax league for the current season. Fantrax issues a new ID every time the league is renewed.
- `app/constants/matchups.ts` defines the current season's matchups: the start date, the length of each matchup in days, and any per-matchup games-played cap overrides.
- `app/data/history.json` is a frozen snapshot of every **finished** season. Only the current season (`LEAGUE_ID`) is fetched live, and only completed weeks count.
- `app/constants/franchises.ts` maps every team name ever used to its franchise, along with who managed it and from which season.

## Offseason checklist

Do these in order when a season ends and the league is renewed on Fantrax.

1. **Freeze the season that just ended.** Run this while `LEAGUE_ID` still points at it, before changing anything:

   ```bash
   npm run snapshot-season -- <old league ID>
   ```

   This adds the season to `app/data/history.json`, and it refuses to save a season that isn't finished. Commit the updated file. If you skip this step, `/records` shows a warning that the season is missing once the new season's first week is final. You can still run the command later with the old ID.

2. **Point the site at the new league.** Set `LEAGUE_ID` in `app/constants/league.ts` to the new Fantrax ID, and add it to the list of past IDs in the comments there. You can only get the new ID from Fantrax (it's in the league URL).

3. **Set up the new schedule** in `app/constants/matchups.ts`:
   - Set `SEASON_START_DATE` to period 1, usually NHL opening night.
   - Update `MATCHUP_LENGTHS` so every matchup matches Fantrax's scoring periods. Merged weeks (Christmas, the All-Star break) are longer.
   - Check the games-played caps. Fantrax defaults to 9/9/9/12/5 (C/LW/RW/D/G) and doesn't prorate short weeks. Add overrides for any matchup that needs them.
   - `https://www.fantrax.com/fxea/general/getLeagueInfo?leagueId=<ID>` lists the scoring periods, playoff settings and caps to check against.

4. **Update franchises** in `app/constants/franchises.ts` if anything changed:
   - **Renamed team:** add the new name to the end of that franchise's `names`.
   - **Team changed hands:** add `{ from: <first season year>, manager: "<name>" }` to its `managers`. Use the first calendar year of the season, e.g. `2027` for 2027-28.
   - **Expansion team:** add a new franchise entry.

   A team name that isn't in this file still shows on `/records`, but as its own separate row with an unknown manager.

5. **Check `/records` once week 1 is final.** The new season appears as "in progress" after its first completed week.

## Data quirks

These are already handled in the saved history, but they're worth knowing:

- **2019-20** playoffs were cancelled by COVID, so there's no champion. The season is skipped for playoff streaks.
- **2021-22 week 10** (Dec 20-26, 2021) was postponed and comes back 0-0 from Fantrax, so it's excluded.
- **2020-21** was the shortened NHL season. It started in January 2021 but counts as the 2020-21 season.
- **Leagues that aren't included:** the first Fantrax league (the year it overlapped with Yahoo) and Yahoo's "2021" league. Both are bogus.
- **Playoff records** only count main bracket games; consolation, 3rd and 5th place games are left out. A first-round bye counts as a playoff appearance but not a game.
- **Yahoo can't be re-downloaded.** Those seasons were scraped once into `history.json`, and 2013-14 to 2015-16 need a Yahoo login to view. Fix any mistakes there by editing the JSON directly.
