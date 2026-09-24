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
};

export type SeasonCell = {
  teamName: string;
  manager: string;
  // 1 = champion, 2 = runner-up, then regular season order.
  finish: number;
  regular: WLT;
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
  note?: string;
};

export type Records = {
  rows: RecordRow[];
  // grid[key][year]
  grid: Record<string, Record<number, SeasonCell>>;
};

const empty = (): WLT => ({ w: 0, l: 0, t: 0 });

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
    note: s.note,
  }));
}

export function buildRecords(seasons: Season[], grouping: Grouping): Records {
  const rows = new Map<string, RecordRow & { names: Set<string> }>();
  const grid: Records["grid"] = {};

  const keyFor = (teamName: string, year: number) => {
    const franchise = franchiseFor(teamName);
    const manager = managerFor(franchise, year);
    return { key: grouping === "franchise" ? franchise.id : manager, manager };
  };

  for (const season of seasons) {
    const finishOrder = [
      ...[season.champion, season.runnerUp].filter((n): n is string => !!n),
      ...season.standings.filter((n) => n !== season.champion && n !== season.runnerUp),
    ];

    for (const teamName of season.standings) {
      const { key, manager } = keyFor(teamName, season.year);
      const row =
        rows.get(key) ??
        rows
          .set(key, {
            key,
            label: grouping === "franchise" ? teamName : manager,
            aka: [],
            names: new Set(),
            seasons: 0,
            regular: empty(),
            playoffs: empty(),
            overall: empty(),
            titles: 0,
            finals: 0,
            playoffApps: 0,
          })
          .get(key)!;
      row.names.add(teamName);
      // Seasons are processed oldest first, so the last name seen is the current one.
      if (grouping === "franchise") row.label = teamName;
      row.seasons++;

      const regular = empty();
      let lastRound: PlayoffRound | null = null;
      for (const g of season.games) {
        const side = g.a === teamName ? 0 : g.b === teamName ? 1 : -1;
        if (side < 0) continue;
        const [pts, oppPts] = side === 0 ? [g.aPts, g.bPts] : [g.bPts, g.aPts];
        addResult(g.round ? row.playoffs : regular, pts, oppPts);
        addResult(row.overall, pts, oppPts);
        if (g.round) lastRound = g.round;
      }
      row.regular.w += regular.w;
      row.regular.l += regular.l;
      row.regular.t += regular.t;

      const madePlayoffs = season.playoffTeams.includes(teamName);
      const isChamp = season.champion === teamName;
      const isRunnerUp = season.runnerUp === teamName;
      if (madePlayoffs) row.playoffApps++;
      if (isChamp) row.titles++;
      if (isChamp || isRunnerUp) row.finals++;

      (grid[key] ??= {})[season.year] = {
        teamName,
        manager,
        finish: finishOrder.indexOf(teamName) + 1,
        regular,
        result: isChamp
          ? "champion"
          : lastRound && !season.inProgress
            ? ROUND_RESULT[lastRound]
            : madePlayoffs
              ? "playoffs"
              : "missed",
      };
    }
  }

  return {
    rows: Array.from(rows.values()).map(({ names, ...row }) => ({
      ...row,
      aka: Array.from(names).filter((n) => n !== row.label),
    })),
    grid,
  };
}
