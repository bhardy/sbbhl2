"use client";

import { useRouter, useParams, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { getMatchupDateRange, getCurrentWeek } from "../constants/matchups";
import { useState, useEffect } from "react";

type TeamTempType = {
  id: string;
  name: string;
};

export const SelectNav = ({ teams }: { teams: TeamTempType[] }) => {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isArbitrage = pathname.startsWith("/arbitrage");
  const activeTeam = params.team?.[0];
  // @todo: make this automatic
  const activeMatchup = params.team?.[1] || getCurrentWeek();
  
  // State for minors toggle - defaults to false (hide minors)
  const [showMinors, setShowMinors] = useState(false);
  
  // Initialize state from URL params
  useEffect(() => {
    const showMinorsParam = searchParams.get('showMinors');
    setShowMinors(showMinorsParam === 'true');
  }, [searchParams]);

  if (!teams) return null;

  const buildUrl = (teamId: string, matchupId: string) => {
    const params = new URLSearchParams();
    if (showMinors) params.set('showMinors', 'true');
    const queryString = params.toString();
    return `/team/${teamId}/${matchupId}${queryString ? `?${queryString}` : ''}`;
  };

  const handleTeamClick = (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    const teamId = event.target.value;
    if (isArbitrage) {
      // keep the arbitrage window params when switching teams
      const query = searchParams.toString();
      router.push(`/arbitrage/${teamId}${query ? `?${query}` : ""}`);
      return;
    }
    const url = buildUrl(teamId, activeMatchup || '');
    router.push(url);
  };

  const handleMatchupClick = (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    const matchupId = event.target.value;
    const url = buildUrl(activeTeam || '', matchupId);
    router.push(url);
  };

  const handleMinorsToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newShowMinors = event.target.checked;
    setShowMinors(newShowMinors);
    
    // Build URL with the new state value
    const params = new URLSearchParams();
    if (newShowMinors) params.set('showMinors', 'true');
    const queryString = params.toString();
    const url = `/team/${activeTeam || ''}/${activeMatchup || ''}${queryString ? `?${queryString}` : ''}`;
    router.push(url);
  };


  // Generate weeks with date ranges
  const weeks = Array.from({ length: 24 }, (_, i) => (i + 1).toString());

  const linkClass = (active: boolean) =>
    `rounded-lg px-2 py-1 ${active ? "bg-blue-600 text-white" : "bg-slate-200 hover:bg-slate-300 text-black"}`;

  return (
    <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
      <div className="flex gap-2">
        <Link href={`/team/${activeTeam || ""}`} className={linkClass(!isArbitrage)}>
          Lineup
        </Link>
        <Link href={`/arbitrage/${activeTeam || ""}`} className={linkClass(isArbitrage)}>
          Arbitrage
        </Link>
      </div>
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
      {!isArbitrage && (
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
      )}
      {activeTeam && !isArbitrage && (
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
