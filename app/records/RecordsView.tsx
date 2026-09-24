"use client";

import { useEffect, useState } from "react";
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

// Sort keys double as the `sort` query param, so keep them readable.
const SORTERS = {
  name: (r: RecordRow) => r.label.toLowerCase(),
  seasons: (r: RecordRow) => r.seasons,
  regular: (r: RecordRow) => winPct(r.regular),
  playoffs: (r: RecordRow) => winPct(r.playoffs),
  combined: (r: RecordRow) => winPct(r.overall),
  titles: (r: RecordRow) => r.titles,
  finals: (r: RecordRow) => r.finals,
  "playoff-apps": (r: RecordRow) => r.playoffApps,
  byes: (r: RecordRow) => r.byes,
  "made-streak": (r: RecordRow) => r.madeStreak?.length ?? 0,
  "missed-streak": (r: RecordRow) => r.missedStreak?.length ?? 0,
};

type SortKey = keyof typeof SORTERS | "finish";
type Sort = { key: SortKey; desc: boolean };

const ASCENDING_KEYS: SortKey[] = ["name", "finish"];
const defaultDesc = (key: SortKey) => !ASCENDING_KEYS.includes(key);
// A single season sorts by finish; a range by combined win %.
const defaultSort = (single: boolean): Sort =>
  single ? { key: "finish", desc: false } : { key: "combined", desc: true };

export type Query = Record<string, string | string[] | undefined>;

// ?view=manager&from=2016-17&to=2019-20&sort=titles&dir=asc, defaults omitted.
function parseQuery(query: Query, columns: SeasonColumn[]) {
  const get = (k: string) => (typeof query[k] === "string" ? (query[k] as string) : undefined);
  const years = columns.map((c) => c.year);
  const toYear = (label?: string) => {
    const year = Number(label?.match(/^(\d{4})-\d{2}$/)?.[1]);
    return years.includes(year) ? year : undefined;
  };
  const from = toYear(get("from")) ?? years[0];
  const to = Math.max(from, toYear(get("to")) ?? years.at(-1)!);
  const single = from === to;
  const sortParam = get("sort");
  const key =
    sortParam && (sortParam in SORTERS || (sortParam === "finish" && single))
      ? (sortParam as SortKey)
      : defaultSort(single).key;
  const dir = get("dir");
  return {
    grouping: (get("view") === "manager" ? "manager" : "franchise") as Grouping,
    range: { from, to },
    sort: { key, desc: dir ? dir === "desc" : defaultDesc(key) },
  };
}

function toQueryString(
  { grouping, range, sort }: ReturnType<typeof parseQuery>,
  columns: SeasonColumn[],
) {
  const params = new URLSearchParams();
  if (grouping !== "franchise") params.set("view", grouping);
  if (range.from !== columns[0].year) params.set("from", seasonLabel(range.from));
  if (range.to !== columns.at(-1)!.year) params.set("to", seasonLabel(range.to));
  const fallback = defaultSort(range.from === range.to);
  if (sort.key !== fallback.key) params.set("sort", sort.key);
  if (sort.desc !== defaultDesc(sort.key)) params.set("dir", sort.desc ? "desc" : "asc");
  return params.toString();
}

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
  query,
}: {
  columns: SeasonColumn[];
  grids: Record<Grouping, Grid>;
  query: Query;
}) {
  const [initial] = useState(() => parseQuery(query, allColumns));
  const [grouping, setGrouping] = useState(initial.grouping);
  const [range, setRange] = useState(initial.range);
  const [sort, setSort] = useState<Sort>(initial.sort);

  // Mirror the view in the URL so it can be shared.
  useEffect(() => {
    const qs = toQueryString({ grouping, range, sort }, allColumns);
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [grouping, range, sort, allColumns]);

  const grid = grids[grouping];
  // Fixed width (monospace, so ch is exact) of the longest team name on record,
  // so the name column doesn't jump around as the view changes.
  const nameWidth = `${Math.max(
    ...Object.values(grids.franchise).flatMap((seasons) =>
      Object.values(seasons).map((c) => c.teamName.length),
    ),
  )}ch`;
  const columns = allColumns.filter((c) => c.year >= range.from && c.year <= range.to);
  const isAllTime = columns.length === allColumns.length;
  // A single season adds finish and result columns.
  const selected = columns.length === 1 ? columns[0] : undefined;
  const rows = aggregate(grid, columns, grouping);
  const cellFor = (r: RecordRow) => (selected ? grid[r.key]?.[selected.year] : undefined);
  const sortValue = (r: RecordRow) =>
    sort.key === "finish" ? (cellFor(r)?.finish ?? Infinity) : SORTERS[sort.key](r);

  const changeRange = (next: { from: number; to: number }) => {
    const single = next.from === next.to;
    setRange(next);
    if (single && !selected) setSort(defaultSort(true));
    if (!single && sort.key === "finish") setSort(defaultSort(false));
  };
  // Keep from <= to by dragging the other end along.
  const selectRange = (edge: "from" | "to", year: number) =>
    changeRange(
      edge === "from"
        ? { from: year, to: Math.max(year, range.to) }
        : { from: Math.min(year, range.from), to: year },
    );

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
        onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : defaultDesc(k) }))}
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
              onClick={() => changeRange({ from: allColumns[0].year, to: allColumns.at(-1)!.year })}
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
                {selected && <th className={TH} />}
                <th colSpan={2} className={`${TH} text-center`}>Regular season</th>
                <th colSpan={2} className={`${TH} text-center`}>Playoffs</th>
                <th colSpan={2} className={`${TH} text-center`}>Combined</th>
                <th colSpan={4} className={TH} />
                <th colSpan={2} className={`${TH} text-center`}>Playoff streak</th>
                {selected && <th className={TH} />}
              </tr>
              <tr>
                <th className={TH}>#</th>
                <SortHeader k="name" className="text-left">{nameHeader}</SortHeader>
                <SortHeader k="seasons">Yrs</SortHeader>
                {selected && <SortHeader k="finish">Finish</SortHeader>}
                <th className={TH}>W-L-T</th>
                <SortHeader k="regular">Pct</SortHeader>
                <th className={TH}>W-L-T</th>
                <SortHeader k="playoffs">Pct</SortHeader>
                <th className={TH}>W-L-T</th>
                <SortHeader k="combined">Pct</SortHeader>
                <SortHeader k="titles">Titles</SortHeader>
                <SortHeader k="finals">Finals</SortHeader>
                <SortHeader k="playoff-apps">Playoffs</SortHeader>
                <SortHeader k="byes">Byes</SortHeader>
                <SortHeader k="made-streak">Made</SortHeader>
                <SortHeader k="missed-streak">Missed</SortHeader>
                {selected && <th className={`${TH} text-left`}>Result</th>}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800">
              {sorted.map((r, i) => {
                const cell = cellFor(r);
                return (
                  <tr key={r.key}>
                    <td className={TD}>{i + 1}</td>
                    <td className={`${TD} text-left`}>
                      {/* Former names (or a manager's teams) on hover. */}
                      <span
                        className="font-bold inline-block"
                        style={{ width: nameWidth }}
                        title={
                          r.aka.length
                            ? `${grouping === "franchise" ? "Formerly" : "Teams"}: ${r.aka.join(", ")}`
                            : undefined
                        }
                      >
                        {r.label}
                      </span>
                    </td>
                    <td className={TD}>{r.seasons}</td>
                    {cell && <td className={TD}>{cell.finish}</td>}
                    <td className={TD}>{fmtWLT(r.regular)}</td>
                    <td className={TD}>{fmtPct(r.regular)}</td>
                    <td className={TD}>{fmtWLT(r.playoffs)}</td>
                    <td className={TD}>{fmtPct(r.playoffs)}</td>
                    <td className={TD}>{fmtWLT(r.overall)}</td>
                    <td className={TD}>{fmtPct(r.overall)}</td>
                    <td className={TD}>{r.titles ? "🏆".repeat(r.titles) : "-"}</td>
                    <td className={TD}>{r.finals || "-"}</td>
                    <td className={TD}>{r.playoffApps || "-"}</td>
                    <td className={TD}>{r.byes || "-"}</td>
                    <StreakCell streak={r.madeStreak} />
                    <StreakCell streak={r.missedStreak} />
                    {cell && selected && (
                      <td className={`${TD} text-left`}>
                        {selected.inProgress && cell.result !== "champion"
                          ? "In progress"
                          : `${cell.result === "champion" ? "🏆 " : ""}${RESULT_TEXT[cell.result]}`}
                        {cell.bye && " (bye)"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-2">
          Playoff streaks are the longest runs of consecutive seasons in the range; * runs through
          the end of it. 2019-20 and the current season are skipped. Hover for the seasons.
        </p>
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
                  <td className={`${TD} text-left font-bold sticky left-0 bg-white dark:bg-slate-900`}>
                    <span className="inline-block" style={{ width: nameWidth }}>
                      {r.label}
                    </span>
                  </td>
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
