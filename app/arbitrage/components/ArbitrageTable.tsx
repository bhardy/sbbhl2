import Link from "next/link";
import { PlayerMeta } from "../../lib/gamelog";
import { Summary } from "../../lib/stats";

export type ArbitrageRow = {
  player: PlayerMeta;
  summary: Summary;
  /** delta minus the median delta of qualifying players at the same position */
  relDelta: number;
};

const POSITION_COLORS: Record<string, string> = {
  G: "bg-cyan-500",
  C: "bg-pink-500",
  LW: "bg-purple-500",
  RW: "bg-blue-500",
  D: "bg-green-500",
};

const th =
  "border-b border-slate-300 dark:border-slate-500 font-bold p-2 pt-0 pb-2 text-slate-700 dark:text-slate-100 text-left whitespace-nowrap";
const td = "border-b border-slate-200 dark:border-slate-700 p-2 whitespace-nowrap";
const numTd = `${td} text-right tabular-nums`;

const fmt = (n: number, digits = 2) => (Number.isFinite(n) ? n.toFixed(digits) : "—");
const signed = (n: number, digits = 2) =>
  Number.isFinite(n) ? `${n > 0 ? "+" : ""}${n.toFixed(digits)}` : "—";

// positive delta = the average is propped up by a few big games (sell high)
// negative delta = the average understates the typical game (buy low)
const deltaClass = (delta: number) =>
  delta > 0.25
    ? "text-amber-600 dark:text-amber-400 font-bold"
    : delta < -0.25
    ? "text-emerald-600 dark:text-emerald-400 font-bold"
    : "";

export function ArbitrageTable({
  rows,
  showOwner,
  emptyMessage,
  moreHref,
  hiddenCount,
}: {
  rows: ArbitrageRow[];
  showOwner: boolean;
  emptyMessage: string;
  moreHref?: string;
  hiddenCount?: number;
}) {
  if (!rows.length) {
    return <p className="my-4 text-sm">{emptyMessage}</p>;
  }
  return (
    <div className="relative rounded-xl overflow-auto -mx-4">
      <div className="shadow-sm my-4">
        <table className="border-collapse table-auto w-full text-sm">
          <thead>
            <tr>
              <th className={th}>Player</th>
              {showOwner && <th className={th}>Owner</th>}
              <th className={`${th} text-right`} title="Games in window">GP</th>
              <th className={`${th} text-right`} title="Mean fantasy points per game">Avg</th>
              <th className={`${th} text-right`} title="Median fantasy points per game">P50</th>
              <th className={`${th} text-right`} title="Avg minus P50">Δ</th>
              <th className={`${th} text-right`} title="Δ as a share of P50">Δ%</th>
              <th className={`${th} text-right`} title="Δ minus the typical Δ for this position in this window">Δ vs pos</th>
              <th className={`${th} text-right`} title="Percentile of the average within the player's own games (50 = average is the median)">
                Avg %ile
              </th>
              <th className={`${th} text-right`}>P25</th>
              <th className={`${th} text-right`}>P75</th>
              <th className={`${th} text-right`} title="Standard deviation">SD</th>
              <th className={`${th} text-right`}>Max</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800">
            {rows.map(({ player, summary, relDelta }) => (
              <tr key={player.id}>
                <td className={`${td} text-slate-700 dark:text-slate-200`}>
                  <span className={`py-0 px-1 rounded-sm text-slate-100 text-xs ${POSITION_COLORS[player.pos.split(",")[0]] ?? "bg-slate-500"}`}>
                    {player.pos}
                  </span>{" "}
                  <span className="font-bold">{player.name}</span>{" "}
                  <span className="text-xs">{player.nhlTeam}</span>
                </td>
                {showOwner && (
                  <td className={td} title={player.ownerName ?? undefined}>
                    {player.ownerAbbr}
                  </td>
                )}
                <td className={numTd}>{summary.n}</td>
                <td className={numTd}>{fmt(summary.mean)}</td>
                <td className={`${numTd} font-bold text-slate-700 dark:text-slate-200`}>{fmt(summary.median)}</td>
                <td className={`${numTd} ${deltaClass(summary.delta)}`}>{signed(summary.delta)}</td>
                <td className={`${numTd} ${deltaClass(summary.delta)}`}>
                  {Number.isFinite(summary.deltaPct) ? signed(summary.deltaPct * 100, 0) + "%" : "—"}
                </td>
                <td className={`${numTd} ${deltaClass(relDelta)}`}>{signed(relDelta)}</td>
                <td className={numTd}>{fmt(summary.meanPercentile, 0)}</td>
                <td className={numTd}>{fmt(summary.p25)}</td>
                <td className={numTd}>{fmt(summary.p75)}</td>
                <td className={numTd}>{fmt(summary.stdev)}</td>
                <td className={numTd}>{fmt(summary.max, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {moreHref && !!hiddenCount && (
          <p className="text-sm mt-2 px-4">
            {hiddenCount} more not shown.{" "}
            <Link href={moreHref} className="underline">
              Show all
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
