"use client";

import { useState } from "react";
import { seasonLabel } from "../lib/history";
import {
  aggregate,
  winPct,
  type Grid,
  type Grouping,
  type RecordRow,
  type SeasonCell,
  type SeasonColumn,
  type Streak,
  type WLT,
} from "../lib/records";

type SortKey =
  | "label"
  | "seasons"
  | "regular"
  | "playoffs"
  | "overall"
  | "titles"
  | "finals"
  | "playoffApps"
  | "byes"
  | "madeStreak"
  | "missedStreak"
  | "finish";

const SORTERS: Record<Exclude<SortKey, "finish">, (r: RecordRow) => number | string> = {
  label: (r) => r.label.toLowerCase(),
  seasons: (r) => r.seasons,
  regular: (r) => winPct(r.regular),
  playoffs: (r) => winPct(r.playoffs),
  overall: (r) => winPct(r.overall),
  titles: (r) => r.titles,
  finals: (r) => r.finals,
  playoffApps: (r) => r.playoffApps,
  byes: (r) => r.byes,
  madeStreak: (r) => r.madeStreak?.length ?? 0,
  missedStreak: (r) => r.missedStreak?.length ?? 0,
};

const ASCENDING_KEYS: SortKey[] = ["label", "finish"];

const RESULT_TEXT: Record<SeasonCell["result"], string> = {
  champion: "Champion",
  "runner-up": "Lost final",
  semis: "Lost semifinal",
  quarters: "Lost quarterfinal",
  playoffs: "Made playoffs",
  missed: "Missed playoffs",
};

const RESULT_CLASSES: Record<SeasonCell["result"], string> = {
  champion: "bg-amber-300 !text-black font-bold",
  "runner-up": "bg-slate-300 !text-black font-bold",
  semis: "bg-sky-200 text-sky-950 dark:bg-sky-800 dark:text-sky-50",
  quarters: "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100",
  playoffs: "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100",
  missed: "",
};

const TH =
  "border-b border-slate-300 dark:border-slate-500 font-bold p-2 text-slate-700 dark:text-slate-100 whitespace-nowrap";
const TD = "border-b border-slate-200 dark:border-slate-700 p-2 text-slate-700 dark:text-slate-200 whitespace-nowrap";

const StreakCell = ({ streak }: { streak: Streak | null }) => (
  <td
    className={TD}
    title={streak ? `${seasonLabel(streak.from)} to ${seasonLabel(streak.to)}${streak.active ? " (active)" : ""}` : undefined}
  >
    {streak ? `${streak.length}${streak.active ? "*" : ""}` : "-"}
  </td>
);

const fmtWLT = ({ w, l, t }: WLT) => `${w}-${l}-${t}`;
const fmtPct = (rec: WLT) =>
  rec.w + rec.l + rec.t ? winPct(rec).toFixed(3).replace(/^0/, "") : "-";

export function RecordsView({
  columns: allColumns,
  grids,
}: {
  columns: SeasonColumn[];
  grids: Record<Grouping, Grid>;
}) {
  const [grouping, setGrouping] = useState<Grouping>("franchise");
  const [range, setRange] = useState({ from: allColumns[0].year, to: allColumns.at(-1)!.year });
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "overall", desc: true });

  const grid = grids[grouping];
  const columns = allColumns.filter((c) => c.year >= range.from && c.year <= range.to);
  const isAllTime = columns.length === allColumns.length;
  // A single season shows finish and result instead of the multi-season counts.
  const selected = columns.length === 1 ? columns[0] : undefined;
  const latestYear = allColumns.filter((c) => c.countsForStreaks).at(-1)?.year;
  const rows = aggregate(grid, columns, grouping, latestYear);
  const cellFor = (r: RecordRow) => (selected ? grid[r.key]?.[selected.year] : undefined);
  const sortValue = (r: RecordRow) =>
    sort.key === "finish" ? (cellFor(r)?.finish ?? Infinity) : SORTERS[sort.key](r);

  const selectRange = (edge: "from" | "to", year: number) => {
    // Keep from <= to by dragging the other end along.
    const next =
      edge === "from"
        ? { from: year, to: Math.max(year, range.to) }
        : { from: Math.min(year, range.from), to: year };
    const single = next.from === next.to;
    setRange(next);
    if (single && !selected) setSort({ key: "finish", desc: false });
    if (!single && sort.key === "finish") setSort({ key: "overall", desc: true });
  };

  const title = isAllTime
    ? "All-time"
    : selected
      ? selected.label
      : `${columns[0].label} to ${columns.at(-1)!.label}`;

  const sorted = [...rows].sort((x, y) => {
    const [a, b] = [sortValue(x), sortValue(y)];
    const cmp = a < b ? -1 : a > b ? 1 : winPct(y.overall) - winPct(x.overall);
    return sort.desc && a !== b ? -cmp : cmp;
  });

  const SortHeader = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`${TH} ${className}`}>
      <button
        className="hover:underline"
        onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : !ASCENDING_KEYS.includes(k) }))}
      >
        {children}
        {sort.key === k ? (sort.desc ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  const nameHeader = grouping === "franchise" ? "Team" : "Manager";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex gap-2">
        {(["franchise", "manager"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGrouping(g)}
            className={`rounded-lg px-2 py-1 ${
              grouping === g
                ? "bg-slate-700 text-white dark:bg-slate-200 dark:text-black"
                : "bg-slate-200 text-black hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            By {g}
          </button>
        ))}
      </div>

      <section>
        <h2 className="text-xl font-bold mb-2">{title} records</h2>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
          {(["from", "to"] as const).map((edge) => (
            <label key={edge} className="flex items-center gap-2">
              {edge === "from" ? "From" : "to"}
              <select
                className="rounded-lg text-black px-2 py-1 bg-slate-200"
                value={range[edge]}
                onChange={(e) => selectRange(edge, Number(e.target.value))}
              >
                {allColumns.map((c) => (
                  <option key={c.year} value={c.year}>
                    {c.label}
                    {c.inProgress ? " (in progress)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {!isAllTime && (
            <button
              className="underline"
              onClick={() => {
                setRange({ from: allColumns[0].year, to: allColumns.at(-1)!.year });
                if (sort.key === "finish") setSort({ key: "overall", desc: true });
              }}
            >
              All-time
            </button>
          )}
        </div>
        <div className="overflow-auto -mx-4 px-4">
          <table className="border-collapse table-auto text-sm text-right">
            <thead>
              <tr>
                <th className={TH} />
                <th className={TH} />
                <th className={TH} />
                <th colSpan={2} className={`${TH} text-center`}>Regular season</th>
                <th colSpan={2} className={`${TH} text-center`}>Playoffs</th>
                <th colSpan={2} className={`${TH} text-center`}>Combined</th>
                <th colSpan={selected ? 1 : 4} className={TH} />
                {!selected && (
                  <th colSpan={2} className={`${TH} text-center`}>
                    Playoff streak
                  </th>
                )}
              </tr>
              <tr>
                <th className={TH}>#</th>
                <SortHeader k="label" className="text-left">{nameHeader}</SortHeader>
                {selected ? <SortHeader k="finish">Finish</SortHeader> : <SortHeader k="seasons">Yrs</SortHeader>}
                <th className={TH}>W-L-T</th>
                <SortHeader k="regular">Pct</SortHeader>
                <th className={TH}>W-L-T</th>
                <SortHeader k="playoffs">Pct</SortHeader>
                <th className={TH}>W-L-T</th>
                <SortHeader k="overall">Pct</SortHeader>
                {selected ? (
                  <th className={`${TH} text-left`}>Result</th>
                ) : (
                  <>
                    <SortHeader k="titles">Titles</SortHeader>
                    <SortHeader k="finals">Finals</SortHeader>
                    <SortHeader k="playoffApps">Playoffs</SortHeader>
                    <SortHeader k="byes">Byes</SortHeader>
                    <SortHeader k="madeStreak">Made</SortHeader>
                    <SortHeader k="missedStreak">Missed</SortHeader>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800">
              {sorted.map((r, i) => {
                const cell = cellFor(r);
                return (
                  <tr key={r.key}>
                    <td className={TD}>{i + 1}</td>
                    <td className={`${TD} text-left`}>
                      {r.aka.length > 0 ? (
                        // Former names on hover; the dotted underline hints there's more.
                        <span
                          className="font-bold underline decoration-dotted underline-offset-4 cursor-help"
                          title={`${grouping === "franchise" ? "Formerly" : "Teams"}: ${r.aka.join(", ")}`}
                        >
                          {r.label}
                        </span>
                      ) : (
                        <span className="font-bold">{r.label}</span>
                      )}
                    </td>
                    <td className={TD}>{cell ? cell.finish : r.seasons}</td>
                    <td className={TD}>{fmtWLT(r.regular)}</td>
                    <td className={TD}>{fmtPct(r.regular)}</td>
                    <td className={TD}>{fmtWLT(r.playoffs)}</td>
                    <td className={TD}>{fmtPct(r.playoffs)}</td>
                    <td className={TD}>{fmtWLT(r.overall)}</td>
                    <td className={TD}>{fmtPct(r.overall)}</td>
                    {cell && selected ? (
                      <td className={`${TD} text-left`}>
                        {selected.inProgress && cell.result !== "champion"
                          ? "In progress"
                          : `${cell.result === "champion" ? "🏆 " : ""}${RESULT_TEXT[cell.result]}`}
                        {cell.bye && " (bye)"}
                      </td>
                    ) : (
                      <>
                        <td className={TD}>{r.titles ? "🏆".repeat(r.titles) : "-"}</td>
                        <td className={TD}>{r.finals || "-"}</td>
                        <td className={TD}>{r.playoffApps || "-"}</td>
                        <td className={TD}>{r.byes || "-"}</td>
                        <StreakCell streak={r.madeStreak} />
                        <StreakCell streak={r.missedStreak} />
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!selected && (
          <p className="text-xs mt-2">
            Playoff streaks are the longest runs of consecutive seasons; * still active. 2019-20 and
            the current season are skipped. Hover for the seasons.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold mb-2">Season by season</h2>
        <p className="text-xs mb-2">
          Final finish: 🏆 champion, 2 runner-up, the rest by regular season standings. Shaded cells
          made the playoffs. Hover a cell for details.
        </p>
        <div className="overflow-auto -mx-4 px-4">
          <table className="border-collapse table-auto text-sm text-center">
            <thead>
              <tr>
                <th className={`${TH} text-left sticky left-0 bg-white dark:bg-slate-900`}>{nameHeader}</th>
                {columns.map((c) => (
                  <th key={c.year} className={TH} title={c.note ?? (c.inProgress ? "In progress" : undefined)}>
                    {c.label}
                    {(c.note || c.inProgress) && "*"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.key}>
                  <td className={`${TD} text-left font-bold sticky left-0 bg-white dark:bg-slate-900`}>{r.label}</td>
                  {columns.map((c) => {
                    const cell = grid[r.key]?.[c.year];
                    if (!cell) return <td key={c.year} className={TD} />;
                    return (
                      <td
                        key={c.year}
                        className={`${TD} ${RESULT_CLASSES[cell.result]}`}
                        title={`${cell.teamName} (${cell.manager}) · ${fmtWLT(cell.regular)} · ${
                          c.inProgress ? "In progress" : RESULT_TEXT[cell.result]
                        }${cell.bye ? " (bye)" : ""}`}
                      >
                        {cell.result === "champion" ? "🏆" : c.inProgress ? <i>{cell.finish}</i> : cell.finish}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="text-xs mt-2">
          {columns
            .filter((c) => c.note || c.inProgress)
            .map((c) => (
              <li key={c.year}>
                * {c.label}: {c.note ?? "In progress, current standings shown."}
              </li>
            ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-2">Champions</h2>
        <div className="overflow-auto -mx-4 px-4">
          <table className="border-collapse table-auto text-sm text-left">
            <thead>
              <tr>
                <th className={TH}>Season</th>
                <th className={TH}>Champion</th>
                <th className={TH}>Runner-up</th>
                <th className={TH}>Platform</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800">
              {[...columns].reverse().map((c) => (
                <tr key={c.year}>
                  <td className={TD}>{c.label}</td>
                  <td className={`${TD} font-bold`}>
                    {c.champion ? `🏆 ${c.champion}` : c.inProgress ? "TBD" : "None"}
                  </td>
                  <td className={TD}>{c.runnerUp ?? "-"}</td>
                  <td className={`${TD} capitalize`}>{c.platform}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
