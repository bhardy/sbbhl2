"use client";

import { useRouter, usePathname } from "next/navigation";

type TeamTempType = {
  id: string;
  name: string;
};

export const SelectNav = ({ teams }: { teams: TeamTempType[] }) => {
  const router = useRouter();
  const pathname = usePathname();
  const activeTeam = pathname.split("/team/").pop();
  if (!teams) return null;

  const handleClick = (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    const teamId = event.target.value;
    router.push(`/team/${teamId}`);
  };

  return (
    <select
      className="rounded-lg text-black px-2 py-1 bg-slate-200 dark:bg-slate-200"
      onChange={handleClick}
      value={activeTeam}
    >
      {/* @todo: yuck */}
      {activeTeam === "/" && <option>Pick a team</option>}
      {teams.map((team: TeamTempType) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  );
};
