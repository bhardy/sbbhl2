"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { PRESETS, Sort, Window, windowToParams } from "../window";
import { SEASON_START, SEASON_END } from "../../lib/season";

const POSITIONS = ["ALL", "SKATERS", "C", "LW", "RW", "D", "G"];

const inputClass =
  "rounded-lg text-black px-2 py-1 bg-slate-200 dark:bg-slate-200 text-sm";

export function WindowControls({ window: initial }: { window: Window }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    from: initial.from,
    to: initial.to,
    games: initial.games ? String(initial.games) : "",
    minGames: String(initial.minGames),
    pos: initial.pos,
    sort: initial.sort,
  });

  const navigate = (next: Window) => {
    const query = windowToParams(next).toString();
    startTransition(() => router.push(`${pathname}${query ? `?${query}` : ""}`));
  };

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const games = parseInt(form.games, 10);
    const minGames = parseInt(form.minGames, 10);
    navigate({
      ...initial,
      from: form.from || SEASON_START,
      to: form.to || SEASON_END,
      games: Number.isFinite(games) && games > 0 ? games : null,
      minGames: Number.isFinite(minGames) && minGames > 0 ? minGames : initial.minGames,
      pos: form.pos,
      sort: form.sort,
    });
  };

  const applyPreset = (params: { from?: string; games?: string }) => {
    const games = params.games ? parseInt(params.games, 10) : null;
    setForm({ ...form, from: params.from ?? SEASON_START, to: SEASON_END, games: params.games ?? "" });
    navigate({ ...initial, from: params.from ?? SEASON_START, to: SEASON_END, games });
  };

  return (
    <form onSubmit={apply} className="flex flex-col gap-3 my-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const active =
            (preset.params.from ?? SEASON_START) === initial.from &&
            initial.to === SEASON_END &&
            (preset.params.games ? parseInt(preset.params.games, 10) : null) === initial.games;
          return (
            <button
              type="button"
              key={preset.label}
              onClick={() => applyPreset(preset.params)}
              className={`rounded-lg px-2 py-1 text-sm ${
                active
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 hover:bg-slate-300 text-black"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 items-end text-sm">
        <label className="flex flex-col gap-1">
          From
          <input
            type="date"
            className={inputClass}
            min={SEASON_START}
            max={SEASON_END}
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          To
          <input
            type="date"
            className={inputClass}
            min={SEASON_START}
            max={SEASON_END}
            value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          Last N games
          <input
            type="number"
            min={1}
            placeholder="all"
            className={`${inputClass} w-24`}
            value={form.games}
            onChange={(e) => setForm({ ...form, games: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          Min games
          <input
            type="number"
            min={1}
            className={`${inputClass} w-24`}
            value={form.minGames}
            onChange={(e) => setForm({ ...form, minGames: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          Position
          <select
            className={inputClass}
            value={form.pos}
            onChange={(e) => setForm({ ...form, pos: e.target.value })}
          >
            {POSITIONS.map((pos) => (
              <option key={pos} value={pos}>
                {pos === "ALL" ? "All" : pos === "SKATERS" ? "Skaters" : pos}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Sort by
          <select
            className={inputClass}
            value={form.sort}
            onChange={(e) => setForm({ ...form, sort: e.target.value as Sort })}
          >
            <option value="rel">Δ vs position</option>
            <option value="delta">Δ (raw)</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-slate-700 hover:bg-slate-800 text-white px-3 py-1 disabled:opacity-50"
        >
          {isPending ? "Loading..." : "Apply"}
        </button>
      </div>
    </form>
  );
}
