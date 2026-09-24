import type { Metadata } from "next";
import { Suspense } from "react";
import { SelectNav } from "../components/SelectNav";
import { Refresh } from "../components/Refresh";
import { LEAGUE_ID } from "../constants/league";

export const metadata: Metadata = {
  title: "SBBHL Lineup helper",
  description: "Fantrax did not provide this functionality so Brant did",
};

async function getTeams() {
  const res = await fetch(
    `https://www.fantrax.com/fxpa/req?leagueId=${LEAGUE_ID}`,
    {
      method: "POST",
      // mode: "cors",
      // cache: "no-cache",
      // credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: JSON.stringify({
        msgs: [
          {
            method: "getTeamRosterInfo",
            data: {
              leagueId: LEAGUE_ID,
            },
          },
        ],
      }),
    },
  );
  const data = await res.json();
  return data.responses?.[0].data.fantasyTeams;
}

export default async function LineupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const teams = await getTeams();
  return (
    <>
      <div className="flex flex-col gap-2 items-start">
        <Suspense fallback={<div>Loading navigation...</div>}>
          <SelectNav teams={teams} />
        </Suspense>
        <Refresh />
      </div>
      {children}
    </>
  );
}
