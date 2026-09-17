import { SEASON_START, SEASON_END } from "../lib/season";

export type Window = {
  from: string;
  to: string;
  games: number | null; // last N games per player, applied after the date filter
  minGames: number;
  pos: string; // ALL | SKATERS | C | LW | RW | D | G
  sort: Sort;
  limit: number;
};

// delta: raw Avg - P50. rel: Avg - P50 minus the typical delta at that position,
// which matters because skater averages almost always sit above their medians while goalies' sit below.
export type Sort = "delta" | "rel";
export const DEFAULT_SORT: Sort = "rel";

export const DEFAULT_MIN_GAMES = 10;
export const DEFAULT_LIMIT = 40;

export const PRESETS: { label: string; params: Partial<Record<"from" | "games", string>> }[] = [
  { label: "Full season", params: {} },
  { label: "Since Jan 1", params: { from: "2026-01-01" } },
  { label: "Last 25 games", params: { games: "25" } },
  { label: "Last 10 games", params: { games: "10" } },
];

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function parseWindow(searchParams: { [key: string]: string | string[] | undefined }): Window {
  const get = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const from = get("from");
  const to = get("to");
  const games = parseInt(get("games") ?? "", 10);
  const minGames = parseInt(get("min") ?? "", 10);
  const limit = parseInt(get("limit") ?? "", 10);
  return {
    from: from && isoDate.test(from) ? from : SEASON_START,
    to: to && isoDate.test(to) ? to : SEASON_END,
    games: Number.isFinite(games) && games > 0 ? games : null,
    minGames: Number.isFinite(minGames) && minGames > 0 ? minGames : DEFAULT_MIN_GAMES,
    pos: get("pos") ?? "ALL",
    sort: get("sort") === "delta" ? "delta" : DEFAULT_SORT,
    limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT,
  };
}

export function windowToParams(window: Window): URLSearchParams {
  const params = new URLSearchParams();
  if (window.from !== SEASON_START) params.set("from", window.from);
  if (window.to !== SEASON_END) params.set("to", window.to);
  if (window.games) params.set("games", String(window.games));
  if (window.minGames !== DEFAULT_MIN_GAMES) params.set("min", String(window.minGames));
  if (window.pos !== "ALL") params.set("pos", window.pos);
  if (window.sort !== DEFAULT_SORT) params.set("sort", window.sort);
  if (window.limit !== DEFAULT_LIMIT) params.set("limit", String(window.limit));
  return params;
}

export function describeWindow(window: Window): string {
  const range =
    window.from === SEASON_START && window.to === SEASON_END
      ? "full season"
      : `${window.from} → ${window.to}`;
  return window.games ? `last ${window.games} games (${range})` : range;
}
