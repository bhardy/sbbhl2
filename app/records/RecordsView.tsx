"use client";

import { useState } from "react";
import {
  winPct,
  type Grouping,
  type RecordRow,
  type Records,
  type SeasonCell,
  type SeasonColumn,
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
  | "playoffApps";

const SORTERS: Record<SortKey, (r: RecordRow) => number | string> = {
  label: (r) => r.label.toLowerCase(),
  seasons: (r) => r.seasons,
  regular: (r) => winPct(r.regular),
  playoffs: (r) => winPct(r.playoffs),
  overall: (r) => winPct(r.overall),
  titles: (r) => r.titles,
  finals: (r) => r.finals,
  playoffApps: (r) => r.playoffApps,
};

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

const fmtWLT = ({ w, l, t }: WLT) => `${w}-${l}-${t}`;
const fmtPct = (rec: WLT) =>
  rec.w + rec.l + rec.t ? winPct(rec).toFixed(3).replace(/^0/, "") : "-";

export function RecordsView({
  columns,
  records,
}: {
  columns: SeasonColumn[];
  records: Record<Grouping, Records>;
}) {
  const [grouping, setGrouping] = useState<Grouping>("franchise");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "overall", desc: true });

  const { rows, grid } = records[grouping];
  const sorted = [...rows].sort((x, y) => {
    const [a, b] = [SORTERS[sort.key](x), SORTERS[sort.key](y)];
    const cmp = a < b ? -1 : a > b ? 1 : winPct(y.overall) - winPct(x.overall);
    return sort.desc && a !== b ? -cmp : cmp;
  });

  const SortHeader = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`${TH} ${className}`}>
      <button
        className="hover:underline"
        onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : k !== "label" }))}
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
        <h2 className="text-xl font-bold mb-2">All-time records</h2>
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
                <th colSpan={3} className={TH} />
              </tr>
              <tr>
                <th className={TH}>#</th>
                <SortHeader k="label" className="text-left">{nameHeader}</SortHeader>
                <SortHeader k="seasons">Yrs</SortHeader>
                <th className={TH}>W-L-T</th>
                <SortHeader k="regular">Pct</SortHeader>
                <th className={TH}>W-L-T</th>
                <SortHeader k="playoffs">Pct</SortHeader>
                <th className={TH}>W-L-T</th>
                <SortHeader k="overall">Pct</SortHeader>
                <SortHeader k="titles">Titles</SortHeader>
                <SortHeader k="finals">Finals</SortHeader>
                <SortHeader k="playoffApps">Playoffs</SortHeader>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800">
              {sorted.map((r, i) => (
                <tr key={r.key}>
                  <td className={TD}>{i + 1}</td>
                  <td className={`${TD} text-left`}>
                    <div className="font-bold">{r.label}</div>
                    {r.aka.length > 0 && (
                      <div className="text-xs text-slate-400 whitespace-normal min-w-48">{r.aka.join(" · ")}</div>
                    )}
                  </td>
                  <td className={TD}>{r.seasons}</td>
                  <td className={TD}>{fmtWLT(r.regular)}</td>
                  <td className={TD}>{fmtPct(r.regular)}</td>
                  <td className={TD}>{fmtWLT(r.playoffs)}</td>
                  <td className={TD}>{fmtPct(r.playoffs)}</td>
                  <td className={TD}>{fmtWLT(r.overall)}</td>
                  <td className={TD}>{fmtPct(r.overall)}</td>
                  <td className={TD}>{r.titles ? "🏆".repeat(r.titles) : "-"}</td>
                  <td className={TD}>{r.finals || "-"}</td>
                  <td className={TD}>{r.playoffApps || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                        }`}
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
