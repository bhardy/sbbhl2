import { loadSeasonGameLog, PlayerMeta } from "../../lib/gamelog";
import { percentile, summarize } from "../../lib/stats";
import { ArbitrageRow, ArbitrageTable } from "../components/ArbitrageTable";
import { WindowControls } from "../components/WindowControls";
import { describeWindow, parseWindow, windowToParams } from "../window";

// a cold start with no snapshot has to pull the whole season from Fantrax (~10s locally)
export const maxDuration = 60;

// @note: Brantlanta Thrashers; the team dropdown in the nav overrides this
const DEFAULT_TEAM_ID = "n9kqnxbmmafokzpa";

const matchesPosition = (player: PlayerMeta, pos: string) => {
  if (pos === "ALL") return true;
  if (pos === "SKATERS") return !player.isGoalie;
  if (pos === "G") return player.isGoalie;
  return player.posIds.includes(POS_IDS[pos] ?? "");
};

const POS_IDS: Record<string, string> = { C: "206", LW: "203", RW: "204", D: "202" };

export default async function Arbitrage({
  params,
  searchParams,
}: {
  params: { team?: string[] };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const teamId = params.team?.[0] ?? DEFAULT_TEAM_ID;
  const window = parseWindow(searchParams);
  const { players, games } = await loadSeasonGameLog();

  const qualifying: Omit<ArbitrageRow, "relDelta">[] = [];
  for (const player of Object.values(players)) {
    if (!player.ownerId || !matchesPosition(player, window.pos)) continue;
    let log = (games[player.id] ?? []).filter((g) => g.date >= window.from && g.date <= window.to);
    if (window.games) log = log.slice(-window.games);
    if (log.length < window.minGames) continue;
    qualifying.push({ player, summary: summarize(log.map((g) => g.fpts)) });
  }

  // @note: skaters' averages almost always exceed their medians (lots of 0-point nights, a few big ones)
  // while goalies' usually sit below, so compare each player's delta to the typical delta at their position
  const positionOf = (player: PlayerMeta) => (player.isGoalie ? "G" : player.pos.split(",")[0]);
  const deltasByPosition: Record<string, number[]> = {};
  for (const row of qualifying) (deltasByPosition[positionOf(row.player)] ??= []).push(row.summary.delta);
  const typicalDelta: Record<string, number> = {};
  for (const [pos, deltas] of Object.entries(deltasByPosition)) {
    typicalDelta[pos] = percentile([...deltas].sort((a, b) => a - b), 50);
  }
  const rows: ArbitrageRow[] = qualifying.map((row) => ({
    ...row,
    relDelta: row.summary.delta - typicalDelta[positionOf(row.player)],
  }));
  const sortValue = (row: ArbitrageRow) => (window.sort === "rel" ? row.relDelta : row.summary.delta);

  const teamName =
    rows.find((r) => r.player.ownerId === teamId)?.player.ownerName ??
    Object.values(players).find((p) => p.ownerId === teamId)?.ownerName ??
    teamId;

  // sell high: my players whose average sits above their median (a few big games doing the work)
  const mine = rows
    .filter((r) => r.player.ownerId === teamId)
    .sort((a, b) => sortValue(b) - sortValue(a));

  // buy low: everyone else's players whose median beats their average
  const others = rows
    .filter((r) => r.player.ownerId !== teamId)
    .sort((a, b) => sortValue(a) - sortValue(b));
  const shownOthers = others.slice(0, window.limit);

  const allParams = windowToParams({ ...window, limit: others.length });
  const moreHref = `/arbitrage/${teamId}?${allParams.toString()}`;

  return (
    <main className="mt-8">
      <h2 className="text-2xl font-bold">Arbitrage</h2>
      <p className="text-sm mt-1 max-w-3xl">
        Fantasy points per game, summarized as a distribution instead of an average. Δ is Avg − P50:
        positive means a handful of big games are inflating the average (the league is overrating them),
        negative means the typical game is better than the average suggests. Skaters&apos; averages almost always
        sit above their medians and goalies&apos; below, so &ldquo;Δ vs pos&rdquo; compares each player to the typical Δ
        at their position within this window. Window: {describeWindow(window)}, minimum {window.minGames} games.
      </p>
      <WindowControls window={window} />

      <h3 className="text-xl font-bold mt-6">
        Sell high — {teamName} ({mine.length})
      </h3>
      <p className="text-sm">
        Your players sorted by how much their average overstates their median
        {window.sort === "rel" ? ", relative to their position" : ""}.
      </p>
      <ArbitrageTable rows={mine} showOwner={false} emptyMessage="No players on this team match the window." />

      <h3 className="text-xl font-bold mt-6">
        Buy low — other teams ({others.length})
      </h3>
      <p className="text-sm">
        Other teams&apos; players sorted by how much their median beats their average
        {window.sort === "rel" ? ", relative to their position" : ""}.
      </p>
      <ArbitrageTable
        rows={shownOthers}
        showOwner
        emptyMessage="No players on other teams match the window."
        moreHref={moreHref}
        hiddenCount={others.length - shownOthers.length}
      />
    </main>
  );
}
