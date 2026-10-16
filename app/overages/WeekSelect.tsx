"use client";

import { useRouter } from "next/navigation";
import { MATCHUP_IDS, getMatchupDateRange } from "../constants/matchups";

export const WeekSelect = ({ matchup }: { matchup: string }) => {
  const router = useRouter();
  return (
    <select
      className="rounded-lg text-black px-2 py-1 bg-slate-200 dark:bg-slate-200"
      onChange={(event) => router.push(`/overages/${event.target.value}`)}
      value={matchup}
      name="period"
    >
      {MATCHUP_IDS.map((week) => (
        <option key={week} value={week}>
          {getMatchupDateRange(week)}
        </option>
      ))}
    </select>
  );
};
