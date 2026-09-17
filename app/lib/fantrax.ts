// Thin client for Fantrax's undocumented fxpa API.
// @note: everything here was reverse engineered from the web app's requests.

export const LEAGUE_ID = "1of9qqosmafokzoq";

const FXPA_URL = `https://www.fantrax.com/fxpa/req?leagueId=${LEAGUE_ID}`;

export async function fxpa<T = any>(
  method: string,
  data: Record<string, unknown>
): Promise<T> {
  const res = await fetch(FXPA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msgs: [{ method, data: { leagueId: LEAGUE_ID, ...data } }] }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fantrax ${method} failed: ${res.status}`);
  const json = await res.json();
  const response = json.responses?.[0];
  if (!response?.data) {
    throw new Error(
      `Fantrax ${method} returned no data: ${JSON.stringify(response?.pageError ?? json).slice(0, 300)}`
    );
  }
  return response.data as T;
}

export type PositionGroup = "HOCKEY_SKATING" | "POS_201";

export type PlayerStatsRow = {
  scorerId: string;
  name: string;
  shortName: string;
  nhlTeam: string;
  posIds: string[];
  posShortNames: string;
  ownerId: string | null;
  ownerAbbr: string;
  ownerName: string | null;
  fpts: number;
  gp: number;
};

type FantraxCell = { content?: string; teamId?: string; toolTip?: string };

const num = (value: string | undefined) => {
  const n = parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
};

/**
 * Fetches the league "Players" table. With no dates it's the year-to-date view,
 * with startDate/endDate (YYYY-MM-DD) it's the "By Date" view — which, when
 * start === end, is effectively a per-game stat line for everyone who played that day.
 */
export async function getPlayerStats({
  positionOrGroup,
  statusOrTeamFilter = "ALL",
  startDate,
  endDate,
}: {
  positionOrGroup: PositionGroup;
  statusOrTeamFilter?: "ALL" | "ALL_TAKEN" | "ALL_AVAILABLE";
  startDate?: string;
  endDate?: string;
}): Promise<PlayerStatsRow[]> {
  const byDate = !!startDate && !!endDate;
  const data = await fxpa("getPlayerStats", {
    view: "STATS",
    statusOrTeamFilter,
    positionOrGroup,
    maxResultsPerPage: "5000",
    ...(byDate
      ? {
          seasonOrProjection: "SEASON_31l_BY_DATE",
          timeframeTypeCode: "BY_DATE",
          startDate,
          endDate,
        }
      : {}),
  });

  // @note: the column layout shifts depending on filters, so resolve indexes from the header
  const headerCells: { key?: string; shortName?: string }[] = data.tableHeader.cells;
  const statusIndex = headerCells.findIndex((c) => c.key === "status");
  const fptsIndex = headerCells.findIndex((c) => c.key === "fpts");
  const gpIndex = headerCells.findIndex((c) => c.shortName === "GP");
  if (statusIndex < 0 || fptsIndex < 0 || gpIndex < 0) {
    throw new Error("Fantrax getPlayerStats: unexpected table header");
  }

  return (data.statsTable as any[]).map((row): PlayerStatsRow => {
    const cells: FantraxCell[] = row.cells;
    const status = cells[statusIndex];
    return {
      scorerId: row.scorer.scorerId,
      name: row.scorer.name,
      shortName: row.scorer.shortName,
      nhlTeam: row.scorer.teamShortName,
      posIds: row.scorer.posIds ?? [],
      posShortNames: row.scorer.posShortNames ?? "",
      ownerId: status?.teamId ?? null,
      ownerAbbr: status?.content ?? "",
      ownerName: status?.toolTip ?? null,
      fpts: num(cells[fptsIndex]?.content),
      gp: num(cells[gpIndex]?.content),
    };
  });
}
