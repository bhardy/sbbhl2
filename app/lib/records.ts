import { franchiseFor, managerFor } from "../constants/franchises";
import { seasonLabel, type PlayoffRound, type Season } from "./history";

export type WLT = { w: number; l: number; t: number };

export type Grouping = "franchise" | "manager";

export type RecordRow = {
  key: string;
  label: string;
  // Other names this franchise played under, or every team name a manager used.
  aka: string[];
  seasons: number;
  regular: WLT;
  playoffs: WLT;
  overall: WLT;
  titles: number;
  finals: number;
  playoffApps: number;
  // First-round playoff byes.
  byes: number;
  // Longest runs of consecutive seasons making / missing the playoffs.
  madeStreak: Streak | null;
  missedStreak: Streak | null;
};

export type Streak = { length: number; from: number; to: number; active: boolean };

export type SeasonCell = {
  teamName: string;
  manager: string;
  // 1 = champion, 2 = runner-up, then regular season order.
  finish: number;
  regular: WLT;
  playoffs: WLT;
  bye: boolean;
  result: "champion" | "runner-up" | "semis" | "quarters" | "playoffs" | "missed";
};

export type SeasonColumn = {
  year: number;
  label: string;
  platform: Season["platform"];
  // "Team (Manager)"
  champion: string | null;
  runnerUp: string | null;
  inProgress: boolean;
  // Finished seasons with a playoff bracket; others (2019-20, the current
  // season) neither extend nor break a playoff streak.
  countsForStreaks: boolean;
  note?: string;
};

// grid[key][year], where key is a franchise id or a manager name.
export type Grid = Record<string, Record<number, SeasonCell>>;

const empty = (): WLT => ({ w: 0, l: 0, t: 0 });

// "The Scottsmen" / "Scottsmen" and "StatutOrry Grapes" / "Statutory Grapes"
// are the same name for display purposes.
const nameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/^the /, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/(.)\1+/g, "$1");

// Names in the order they were used, collapsing spelling-only variants. A
// variant group shows its most recent name if it's the current one, otherwise
// its first.
const distinctNames = (names: string[]) => {
  const current = names.at(-1)!;
  const groups = new Map<string, string>();
  for (const n of names) if (!groups.has(nameKey(n))) groups.set(nameKey(n), n);
  groups.set(nameKey(current), current);
  return Array.from(groups.values());
};

const addResult = (rec: WLT, pts: number, oppPts: number) => {
  if (pts > oppPts) rec.w++;
  else if (pts < oppPts) rec.l++;
  else rec.t++;
};

export const winPct = ({ w, l, t }: WLT) => {
  const gp = w + l + t;
  return gp ? (w + t / 2) / gp : 0;
};

const ROUND_RESULT: Record<PlayoffRound, SeasonCell["result"]> = {
  F: "runner-up",
  SF: "semis",
  QF: "quarters",
};

const withManager = (teamName: string | null, year: number) =>
  teamName && `${teamName} (${managerFor(franchiseFor(teamName), year)})`;

export function seasonColumns(seasons: Season[]): SeasonColumn[] {
  return seasons.map((s) => ({
    year: s.year,
    label: seasonLabel(s.year),
    platform: s.platform,
    champion: withManager(s.champion, s.year),
    runnerUp: withManager(s.runnerUp, s.year),
    inProgress: !!s.inProgress,
    countsForStreaks: !s.inProgress && s.playoffTeams.length > 0,
    note: s.note,
  }));
}

const sum = (a: WLT, b: WLT): WLT => ({ w: a.w + b.w, l: a.l + b.l, t: a.t + b.t });

// One cell per team per season. Everything else is aggregated from this, so
// the page can total any range of seasons.
export function buildGrid(seasons: Season[], grouping: Grouping): Grid {
  const grid: Grid = {};

  for (const season of seasons) {
    const finishOrder = [
      ...[season.champion, season.runnerUp].filter((n): n is string => !!n),
      ...season.standings.filter((n) => n !== season.champion && n !== season.runnerUp),
    ];
    // Byes only exist once quarterfinals have been played (4-team brackets have none).
    const quarterfinalists = new Set(
      season.games.filter((g) => g.round === "QF").flatMap((g) => [g.a, g.b]),
    );

    for (const teamName of season.standings) {
      const franchise = franchiseFor(teamName);
      const manager = managerFor(franchise, season.year);
      const key = grouping === "franchise" ? franchise.id : manager;

      const regular = empty();
      const playoffs = empty();
      let lastRound: PlayoffRound | null = null;
      for (const g of season.games) {
        const side = g.a === teamName ? 0 : g.b === teamName ? 1 : -1;
        if (side < 0) continue;
        const [pts, oppPts] = side === 0 ? [g.aPts, g.bPts] : [g.bPts, g.aPts];
        addResult(g.round ? playoffs : regular, pts, oppPts);
        if (g.round) lastRound = g.round;
      }

      const madePlayoffs = season.playoffTeams.includes(teamName);
      (grid[key] ??= {})[season.year] = {
        teamName,
        manager,
        finish: finishOrder.indexOf(teamName) + 1,
        regular,
        playoffs,
        bye: madePlayoffs && quarterfinalists.size > 0 && !quarterfinalists.has(teamName),
        result:
          season.champion === teamName
            ? "champion"
            : lastRound && !season.inProgress
              ? ROUND_RESULT[lastRound]
              : madePlayoffs
                ? "playoffs"
                : "missed",
      };
    }
  }
  return grid;
}

// Records over the given seasons (oldest first). A streak is "active" if it
// runs through the last of those seasons that counts for streaks.
export function aggregate(grid: Grid, columns: SeasonColumn[], grouping: Grouping): RecordRow[] {
  const streakYears = columns.filter((c) => c.countsForStreaks).map((c) => c.year);
  // "Active" means nothing within a single season.
  const latestYear = streakYears.length > 1 ? streakYears.at(-1) : undefined;

  const longestStreak = (seasons: Record<number, SeasonCell>, made: boolean) => {
    let best = null as Streak | null;
    let run = null as Streak | null;
    for (const year of streakYears) {
      const cell = seasons[year];
      if (cell && (cell.result !== "missed") === made) {
        run = run
          ? { ...run, length: run.length + 1, to: year }
          : { length: 1, from: year, to: year, active: false };
        if (!best || run.length >= best.length) best = run;
      } else {
        run = null;
      }
    }
    return best && { ...best, active: best.to === latestYear };
  };

  return Object.entries(grid).flatMap(([key, seasons]) => {
    const cells = columns.map((c) => seasons[c.year]).filter((cell) => !!cell);
    if (!cells.length) return [];
    const names = cells.map((c) => c.teamName);
    const label = grouping === "franchise" ? names.at(-1)! : key;
    const regular = cells.reduce((acc, c) => sum(acc, c.regular), empty());
    const playoffs = cells.reduce((acc, c) => sum(acc, c.playoffs), empty());
    return [
      {
        key,
        label,
        aka: distinctNames(names).filter((n) => nameKey(n) !== nameKey(label)),
        seasons: cells.length,
        regular,
        playoffs,
        overall: sum(regular, playoffs),
        titles: cells.filter((c) => c.result === "champion").length,
        finals: cells.filter((c) => c.result === "champion" || c.result === "runner-up").length,
        playoffApps: cells.filter((c) => c.result !== "missed").length,
        byes: cells.filter((c) => c.bye).length,
        madeStreak: longestStreak(seasons, true),
        missedStreak: longestStreak(seasons, false),
      },
    ];
  });
}
