// Games-played overages for the league's weekly position caps.
//
// Fantrax stops scoring a position the day after its weekly max is met, but
// every game on the day the max is crossed still counts, so a team can finish
// the week over the cap. League rule: the commissioner unsets the excess games,
// latest start time of the week first. When games start at the same time, the
// one that scored more goes first, so playing two at once is never an edge.

export const POSITIONS = ["C", "LW", "RW", "D", "G"] as const;
export type Position = (typeof POSITIONS)[number];
export type Caps = Record<Position, number>;

const POSITION_IDS: Record<string, Position> = {
  "206": "C",
  "203": "LW",
  "204": "RW",
  "202": "D",
  "201": "G",
};

export type PlayerGame = {
  playerId: string;
  player: string;
  pos: Position; // the lineup slot that day, not the player's eligibility
  date: string; // YYYY-MM-DD, the Fantrax period (NHL game date)
  game: string; // "PHI @ TBL"
  teams: string[]; // NHL abbreviations in the game
  start: string | null; // ISO start time from the NHL schedule
  fpts: number;
};

export type Unset = PlayerGame & {
  // Played after the max was already met, so Fantrax scored it 0. Unsetting it
  // only corrects the GP count.
  scoredZero: boolean;
};

export type Overage = {
  pos: Position;
  gp: number;
  max: number;
  unset: Unset[];
  // Games left in the lineup that tie the last unset game on start time and
  // points, so any of them could be unset instead.
  tiedWith: PlayerGame[];
};

const startMillis = (game: PlayerGame) => (game.start ? Date.parse(game.start) : null);

// Sorts the next game to unset first: latest date, then latest start, then most
// points. A missing start time can't be ordered within its date, so it falls
// through to points.
const unsetOrder = (a: PlayerGame, b: PlayerGame) => {
  const [aStart, bStart] = [startMillis(a), startMillis(b)];
  return (
    b.date.localeCompare(a.date) ||
    (aStart !== null && bStart !== null ? bStart - aStart : 0) ||
    b.fpts - a.fpts
  );
};

// The date the running GP total first reaches max; Fantrax scores nothing at
// this position after it.
const dateMaxMet = (games: PlayerGame[], max: number) => {
  let total = 0;
  for (const date of Array.from(new Set(games.map((g) => g.date))).sort()) {
    total += games.filter((g) => g.date === date).length;
    if (total >= max) return date;
  }
  return null;
};

// `games` are the games that count toward GP: active lineup slots where the
// player actually played. `fantraxCaps` are the maxes Fantrax enforces, when the
// league overrides them for a matchup.
export function findOverages(
  games: PlayerGame[],
  caps: Caps,
  fantraxCaps: Caps = caps,
): Overage[] {
  return POSITIONS.flatMap((pos) => {
    const played = games.filter((g) => g.pos === pos);
    const max = caps[pos];
    const excess = played.length - max;
    if (excess <= 0) return [];

    const maxMet = dateMaxMet(played, fantraxCaps[pos]);
    const order = [...played].sort(unsetOrder);
    const last = order[excess - 1];
    return [
      {
        pos,
        gp: played.length,
        max,
        unset: order
          .slice(0, excess)
          .map((g) => ({ ...g, scoredZero: maxMet !== null && g.date > maxMet })),
        tiedWith: order.slice(excess).filter((g) => unsetOrder(g, last) === 0),
      },
    ];
  });
}

type RosterTable = {
  header: { cells: { shortName?: string }[] };
  rows: {
    statusId?: string;
    posId?: string;
    scorer?: { scorerId: string; name: string };
    cells: { content?: string }[];
  }[];
};

// "PHI 1<br/>@TBL 4 F" -> ["PHI", "TBL"]. The home team has the "@".
const parseGame = (content: string) => {
  const sides = content
    .split("<br/>")
    .map((part) => part.match(/^(@?)([A-Z]{2,3})\b/))
    .filter((m) => m !== null);
  const away = sides.find((m) => !m[1])?.[2];
  const home = sides.find((m) => m[1])?.[2];
  return {
    teams: sides.map((m) => m[2]),
    game: away && home ? `${away} @ ${home}` : content.replace("<br/>", " "),
  };
};

// The games that count toward GP on one Fantrax period (day), from a
// getTeamRosterInfo response requested with timeframeTypeCode BY_PERIOD so the
// stats are that day's. Start times are filled in later from the NHL schedule.
export function parseRosterDay(tables: RosterTable[], date: string): PlayerGame[] {
  return tables.flatMap(({ header, rows }) => {
    const column = (name: string) => header.cells.findIndex((c) => c.shortName === name);
    const [opp, fpts, gp] = [column("Opp"), column("FPts"), column("GP")];
    return rows.flatMap((row) => {
      const pos = POSITION_IDS[row.posId ?? ""];
      // statusId 1 is the active lineup. GP is 0 for scratches, backup goalies
      // and games that haven't started.
      if (!row.scorer || !pos || row.statusId !== "1") return [];
      if (!(Number(row.cells[gp]?.content) > 0)) return [];
      return [
        {
          playerId: row.scorer.scorerId,
          player: row.scorer.name,
          pos,
          date,
          ...parseGame(row.cells[opp]?.content ?? ""),
          start: null,
          fpts: Number(row.cells[fpts]?.content) || 0,
        },
      ];
    });
  });
}

type NhlScheduleDay = {
  date: string;
  games: { startTimeUTC: string; awayTeam: { abbrev: string }; homeTeam: { abbrev: string } }[];
};

// Start times keyed by "date team", from api-web.nhle.com/v1/schedule/<date>.
// A team plays at most once a day, so either team in the game finds it.
export const scheduleStarts = (days: NhlScheduleDay[]) =>
  new Map(
    days.flatMap(({ date, games }) =>
      games.flatMap((g) =>
        [g.awayTeam.abbrev, g.homeTeam.abbrev].map((team) => [`${date} ${team}`, g.startTimeUTC] as const),
      ),
    ),
  );

export const withStart = (game: PlayerGame, starts: Map<string, string>): PlayerGame => ({
  ...game,
  start: game.teams.map((team) => starts.get(`${game.date} ${team}`)).find(Boolean) ?? null,
});
