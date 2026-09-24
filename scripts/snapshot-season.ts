// Freezes a finished Fantrax season into app/data/history.json.
// Run once a season wraps up, with that season's league ID (see app/constants/league.ts):
//   npm run snapshot-season -- 4o1j5jn2moolnhef
import { readFileSync, writeFileSync } from "node:fs";
import { fetchFantraxSeason } from "../app/lib/fantrax.ts";
import { seasonLabel, type Season } from "../app/lib/history.ts";

const leagueId = process.argv[2];
if (!leagueId) {
  console.error("Usage: npm run snapshot-season -- <fantraxLeagueId>");
  process.exit(1);
}

const path = new URL("../app/data/history.json", import.meta.url);
const history: Season[] = JSON.parse(readFileSync(path, "utf8"));

async function main() {
  const season = await fetchFantraxSeason(leagueId);
  if (season.inProgress) {
    console.error(`${seasonLabel(season.year)} (${leagueId}) is not finished yet.`);
    process.exit(1);
  }

  const next = [...history.filter((s) => s.year !== season.year), season].sort(
    (x, y) => x.year - y.year,
  );
  writeFileSync(path, JSON.stringify(next, null, 1) + "\n");
  console.log(
    `Saved ${seasonLabel(season.year)}: ${season.games.length} games, champion ${season.champion}, runner-up ${season.runnerUp}`,
  );
}

main();
