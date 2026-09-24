// Builds a normalized Season from Fantrax's standings endpoints. Used both for
// the live season on /records and by scripts/snapshot-season.ts to freeze a
// finished season into app/data/history.json.
import type { Game, PlayoffRound, Season } from "./history";

type Cell = { content: string; teamId?: string };
type Table = { caption: string; subCaption?: string; rows: { cells: Cell[]; fixedCells?: Cell[] }[] };
type PlayoffTree = {
  rounds: {
    caption: string;
    subCaption: string;
    playoffList: {
      awayTeamName: string;
      awayId: string;
      awayScore: string;
      homeTeamName: string;
      homeId: string;
      homeScore: string;
    }[];
  }[];
};

const VIEWS = ["SCHEDULE", "PLAYOFFS", "COMBINED"] as const;

// Scoring periods end Sunday night Eastern; treat a period as final once that passes.
const endOfDayEastern = (date: string) => new Date(`${date} 23:59:59 GMT-0500`);

const toPts = (s: string) => Number(s.replace(/,/g, ""));

export async function fetchFantraxSeason(
  leagueId: string,
  { now = new Date(), init = {} }: { now?: Date; init?: RequestInit } = {},
): Promise<Season> {
  const res = await fetch(`https://www.fantrax.com/fxpa/req?leagueId=${leagueId}`, {
    ...init,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msgs: VIEWS.map((view) => ({ method: "getStandings", data: { leagueId, view } })),
    }),
  });
  if (!res.ok) throw new Error(`Fantrax standings request failed: ${res.status}`);
  const json = await res.json();
  const [schedule, playoffs, combined] = json.responses.map(
    (r: { data: unknown }) => r.data,
  ) as [{ tableList: Table[] }, { playoffTree?: PlayoffTree }, { tableList: Table[] }];

  // "(Tue Oct 7, 2025 - Sun Oct 12, 2025)". The 2020-21 season started in
  // January, so derive the season year from the first period's month.
  const periods = schedule.tableList.map((t) => {
    const [, startStr, endStr] = t.subCaption!.match(/\((.+?) - (.+?)\)/)!;
    return {
      week: Number(t.caption.replace(/\D/g, "")),
      start: new Date(startStr),
      end: endOfDayEastern(endStr),
      rows: t.rows,
    };
  });
  const first = periods[0].start;
  const year = first.getMonth() >= 6 ? first.getFullYear() : first.getFullYear() - 1;

  const games: Game[] = [];
  let inProgress = false;
  for (const p of periods) {
    if (now <= p.end) {
      inProgress = true;
      continue;
    }
    for (const { cells } of p.rows) {
      const [a, aPts, b, bPts] = [cells[0].content, toPts(cells[1].content), cells[2].content, toPts(cells[3].content)];
      // Postponed weeks (e.g. Dec 20-26, 2021) come back 0-0 for everyone.
      if (aPts === 0 && bPts === 0) continue;
      games.push({ week: p.week, a, aPts, b, bPts });
    }
  }

  // playoffTree only holds the main bracket; consolation games live elsewhere.
  const rounds = playoffs.playoffTree?.rounds ?? [];
  const playoffTeams = new Set<string>();
  let champion: string | null = null;
  let runnerUp: string | null = null;
  rounds.forEach((round, i) => {
    const fromFinal = rounds.length - 1 - i;
    const label: PlayoffRound = fromFinal === 0 ? "F" : fromFinal === 1 ? "SF" : "QF";
    // "23 (Mar 28 - Apr 3)": playoff dates are always in the second calendar year.
    const [, week, endStr] = round.subCaption.match(/^(\d+) \(.+? - (.+?)\)/)!;
    const over = now > endOfDayEastern(`${endStr}, ${year + 1}`);
    if (!over) inProgress = true;
    for (const m of round.playoffList) {
      for (const [id, name] of [[m.awayId, m.awayTeamName], [m.homeId, m.homeTeamName]]) {
        if (!id.startsWith("-") && name) playoffTeams.add(name);
      }
      if (!over || m.awayId.startsWith("-") || m.homeId.startsWith("-")) continue;
      if (m.awayScore === "" || m.homeScore === "") continue;
      const game: Game = {
        week: Number(week),
        round: label,
        a: m.awayTeamName,
        aPts: toPts(m.awayScore),
        b: m.homeTeamName,
        bPts: toPts(m.homeScore),
      };
      games.push(game);
      if (label === "F" && game.aPts !== game.bPts) {
        [champion, runnerUp] = game.aPts > game.bPts ? [game.a, game.b] : [game.b, game.a];
      }
    }
  });

  const standingsTable = combined.tableList.find((t) => t.caption === "Standings")!;
  const standings = standingsTable.rows
    .map((r) => ({ rank: Number(r.fixedCells![0].content), name: r.fixedCells![1].content }))
    .sort((x, y) => x.rank - y.rank)
    .map((r) => r.name);

  return {
    year,
    platform: "fantrax",
    leagueId,
    standings,
    playoffTeams: Array.from(playoffTeams),
    champion,
    runnerUp,
    games,
    ...(inProgress ? { inProgress } : {}),
  };
}
