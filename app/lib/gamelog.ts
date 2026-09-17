import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { DateTime } from "luxon";
import { getPlayerStats, PlayerStatsRow, PositionGroup } from "./fantrax";

import { SEASON_START, SEASON_END } from "./season";

const FANTRAX_ZONE = "America/New_York";

// Committed snapshot of the season (load the page locally, then commit data/fantrax to refresh it).
const SNAPSHOT_DIR = path.join(process.cwd(), "data", "fantrax");
// Vercel's function filesystem is read-only, so anything fetched at runtime there goes to /tmp.
const WRITE_DIR = process.env.VERCEL ? path.join(os.tmpdir(), "fantrax") : SNAPSHOT_DIR;
const PLAYERS_TTL_MS = 6 * 60 * 60 * 1000; // owners change; refresh a few times a day
const RECENT_DAY_TTL_MS = 60 * 60 * 1000; // today/yesterday may still have games in progress
const CONCURRENCY = 6;

export type PlayerMeta = {
  id: string;
  name: string;
  shortName: string;
  nhlTeam: string;
  posIds: string[];
  pos: string;
  isGoalie: boolean;
  ownerId: string | null;
  ownerAbbr: string;
  ownerName: string | null;
  seasonFpts: number;
  seasonGp: number;
};

export type Game = { date: string; fpts: number };

export type SeasonGameLog = {
  players: Record<string, PlayerMeta>;
  games: Record<string, Game[]>; // sorted by date ascending, only games actually played
  dates: string[]; // every date that was loaded
};

const GROUPS: PositionGroup[] = ["HOCKEY_SKATING", "POS_201"];

const todayInFantraxZone = () => DateTime.now().setZone(FANTRAX_ZONE).startOf("day");

const seasonDates = (): string[] => {
  const end = DateTime.min(
    DateTime.fromISO(SEASON_END, { zone: FANTRAX_ZONE }),
    todayInFantraxZone()
  );
  const dates: string[] = [];
  for (let d = DateTime.fromISO(SEASON_START, { zone: FANTRAX_ZONE }); d <= end; d = d.plus({ days: 1 })) {
    dates.push(d.toISODate()!);
  }
  return dates;
};

async function readFile<T>(file: string, ttlMs: number | null): Promise<T | null> {
  try {
    if (ttlMs !== null) {
      const stat = await fs.stat(file);
      if (Date.now() - stat.mtimeMs > ttlMs) return null;
    }
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Reads `relative` from the writable overlay first, then the committed snapshot. */
async function readCache<T>(relative: string, ttlMs: number | null): Promise<T | null> {
  const fromOverlay = await readFile<T>(path.join(WRITE_DIR, relative), ttlMs);
  if (fromOverlay || WRITE_DIR === SNAPSHOT_DIR) return fromOverlay;
  return readFile<T>(path.join(SNAPSHOT_DIR, relative), ttlMs);
}

async function writeCache(relative: string, value: unknown) {
  const file = path.join(WRITE_DIR, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value));
  await fs.rename(tmp, file);
}

async function mapWithConcurrency<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

const toMeta = (row: PlayerStatsRow, isGoalie: boolean): PlayerMeta => ({
  id: row.scorerId,
  name: row.name,
  shortName: row.shortName,
  nhlTeam: row.nhlTeam,
  posIds: row.posIds,
  pos: row.posShortNames,
  isGoalie,
  ownerId: row.ownerId,
  ownerAbbr: row.ownerAbbr,
  ownerName: row.ownerName,
  seasonFpts: row.fpts,
  seasonGp: row.gp,
});

/** Current player metadata + ownership + season totals for everyone on a fantasy roster. */
async function loadPlayers(): Promise<Record<string, PlayerMeta>> {
  const file = "players.json";
  const cached = await readCache<Record<string, PlayerMeta>>(file, PLAYERS_TTL_MS);
  if (cached) return cached;

  const [skaters, goalies] = await Promise.all(
    GROUPS.map((group) => getPlayerStats({ positionOrGroup: group, statusOrTeamFilter: "ALL_TAKEN" }))
  );
  const players: Record<string, PlayerMeta> = {};
  for (const row of skaters) players[row.scorerId] = toMeta(row, false);
  for (const row of goalies) players[row.scorerId] = toMeta(row, true);

  await writeCache(file, players);
  return players;
}

// compact on-disk form: [scorerId, fpts][] for players who played that day
type DayLog = [string, number][];

async function loadDay(date: string): Promise<DayLog> {
  const file = path.join("days", `${date}.json`);
  const isRecent = DateTime.fromISO(date, { zone: FANTRAX_ZONE }) >= todayInFantraxZone().minus({ days: 1 });
  const cached = await readCache<DayLog>(file, isRecent ? RECENT_DAY_TTL_MS : null);
  if (cached) return cached;

  const groups = await Promise.all(
    GROUPS.map((group) =>
      getPlayerStats({
        positionOrGroup: group,
        statusOrTeamFilter: "ALL_TAKEN",
        startDate: date,
        endDate: date,
      })
    )
  );
  const day: DayLog = groups
    .flat()
    .filter((row) => row.gp > 0)
    .map((row) => [row.scorerId, row.fpts]);

  await writeCache(file, day);
  return day;
}

/**
 * Loads the whole season's per-game fantasy points for every rostered player.
 * The first call fetches ~190 days x 2 tables from Fantrax and caches each day on disk;
 * later calls are served from the committed snapshot in `data/fantrax` (plus /tmp on Vercel).
 */
export async function loadSeasonGameLog(): Promise<SeasonGameLog> {
  const dates = seasonDates();
  const [players, days] = await Promise.all([loadPlayers(), mapWithConcurrency(dates, loadDay)]);

  const games: Record<string, Game[]> = {};
  days.forEach((day, i) => {
    for (const [id, fpts] of day) {
      (games[id] ??= []).push({ date: dates[i], fpts });
    }
  });

  return { players, games, dates };
}
