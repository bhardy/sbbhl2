import "./globals.css";
import type { Metadata } from "next";
import { Roboto_Mono } from "next/font/google";
import { SelectNav } from "./components/SelectNav";
import { Refresh } from "./components/Refresh";

const robotoMono = Roboto_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SBBHL Lineup helper",
  description: "Fantrax did not provide this functionality so Brant did",
};

async function getTeams() {
  const res = await fetch(
    "https://www.fantrax.com/fxpa/req?leagueId=erva93djlwitpx9j",
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
              leagueId: "erva93djlwitpx9j",
            },
          },
        ],
      }),
    },
  );
  const data = await res.json();
  return data.responses?.[0].data.fantasyTeams;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const teams = await getTeams();
  return (
    <html lang="en">
      <body
        className={`${robotoMono.className} mx-auto p-4 antialiased text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900`}
      >
        <div className="max-w-8xl mx-auto sm:px-6 md:px-8">
          <nav className="flex flex-col gap-2 items-start">
            <h1 className="text-3xl font-bold">SBBHL Lineup Helper</h1>
            <SelectNav teams={teams} />
            <Refresh />
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
