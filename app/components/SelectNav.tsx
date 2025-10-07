"use client";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import { getMatchupDateRange } from "../constants/matchups";
import { useState, useEffect } from "react";

const CURRENT_SCORING_PERIOD =
  process.env.NEXT_PUBLIC_APP_MATCHUP_WEEK?.toString();

type TeamTempType = {
  id: string;
  name: string;
};

export const SelectNav = ({ teams }: { teams: TeamTempType[] }) => {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const activeTeam = params.team?.[0];
  // @todo: make this automatic
  const activeMatchup = params.team?.[1] || CURRENT_SCORING_PERIOD;
  
  // State for minors toggle - defaults to false (hide minors)
  const [showMinors, setShowMinors] = useState(false);
  
  // Initialize state from URL params
  useEffect(() => {
    const showMinorsParam = searchParams.get('showMinors');
    setShowMinors(showMinorsParam === 'true');
  }, [searchParams]);

  if (!teams) return null;

  const handleTeamClick = (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    const teamId = event.target.value;
    const url = `/team/${teamId}/${activeMatchup}${showMinors ? '?showMinors=true' : ''}`;
    router.push(url);
  };

  const handleMatchupClick = (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    const matchupId = event.target.value;
    const url = `/team/${activeTeam}/${matchupId}${showMinors ? '?showMinors=true' : ''}`;
    router.push(url);
  };

  const handleMinorsToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newShowMinors = event.target.checked;
    setShowMinors(newShowMinors);
    const url = `/team/${activeTeam}/${activeMatchup}${newShowMinors ? '?showMinors=true' : ''}`;
    router.push(url);
  };

  // Generate weeks with date ranges
  const weeks = Array.from({ length: 24 }, (_, i) => (i + 1).toString());

  return (
    <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
      <select
        className="rounded-lg text-black px-2 py-1 bg-slate-200 dark:bg-slate-200"
        onChange={handleTeamClick}
        value={activeTeam}
        name="team"
      >
        {!activeTeam && <option>Pick a team</option>}
        {teams.map((team: TeamTempType) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      <select
        className="rounded-lg text-black px-2 py-1 bg-slate-200 dark:bg-slate-200"
        onChange={handleMatchupClick}
        value={activeMatchup}
        disabled={!activeTeam}
        name="period"
      >
        {weeks.map((week: string) => (
          <option key={week} value={week}>
            {getMatchupDateRange(week)}
          </option>
        ))}
      </select>
      {activeTeam && (
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={showMinors}
            onChange={handleMinorsToggle}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Show Minors
        </label>
      )}
    </div>
  );
};
