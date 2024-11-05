"use client";

import { useRouter, useParams } from "next/navigation";

const LEAGUE_WEEK = process.env.APP_MATCHUP_WEEK?.toString() || "5";

type TeamTempType = {
  id: string;
  name: string;
};

export const SelectNav = ({ teams }: { teams: TeamTempType[] }) => {
  const router = useRouter();
  const params = useParams();
  const activeTeam = params.team?.[0];
  // @todo: make this automatic
  const activeMatchup = params.team?.[1] || LEAGUE_WEEK;

  if (!teams) return null;

  const handleTeamClick = (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    const teamId = event.target.value;
    router.push(`/team/${teamId}/${activeMatchup}`);
  };

  const handleMatchupClick = (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    const matchupId = event.target.value;
    router.push(`/team/${activeTeam}/${matchupId}`);
  };

  // @todo these should have the dates
  const weeks = Array.from({ length: 23 }, (_, i) => (i + 1).toString());

  return (
    <div className="flex gap-2">
      <select
        className="rounded-lg text-black px-2 py-1 bg-slate-200 dark:bg-slate-200"
        onChange={handleTeamClick}
        value={activeTeam}
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
      >
        {weeks.map((week: string) => (
          <option key={week} value={week}>
            {week}
          </option>
        ))}
      </select>
    </div>
  );
};
