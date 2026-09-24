import type { Metadata } from "next";
import { LEAGUE_ID } from "../constants/league";
import historyJson from "../data/history.json";
import { fetchFantraxSeason } from "../lib/fantrax";
import { seasonLabel, type Season } from "../lib/history";
import { buildGrid, seasonColumns } from "../lib/records";
import { RecordsView, type Query } from "./RecordsView";

export const metadata: Metadata = {
  title: "SBBHL All-Time Records",
  description: "Every SBBHL season on Yahoo and Fantrax, combined",
};

// Finished seasons are frozen in history.json; only the current one is live.
export const revalidate = 900;

const history = historyJson as Season[];

async function getLiveSeason() {
  try {
    const season = await fetchFantraxSeason(LEAGUE_ID, {
      init: { next: { revalidate } },
    });
    // Nothing to show until the first week is final.
    return season.games.length ? season : null;
  } catch (error) {
    console.error("Failed to load live Fantrax season", error);
    return null;
  }
}

export default async function RecordsPage({ searchParams }: { searchParams: Query }) {
  const live = await getLiveSeason();
  const seasons = [...history.filter((s) => s.year !== live?.year), ...(live ? [live] : [])];
  const lastFrozen = history.at(-1)!.year;
  // The league ID rolled over without freezing the season that just ended.
  const missing = live && live.year > lastFrozen + 1 ? live.year - 1 : null;

  return (
    <main className="mt-4 flex flex-col gap-8">
      <p className="text-sm max-w-3xl">
        Every season since {seasonLabel(history[0].year)}: Yahoo through{" "}
        {seasonLabel(2019)}, Fantrax after that. Playoff records count main bracket games only.
      </p>
      {missing && (
        <p className="text-sm text-red-500">
          {seasonLabel(missing)} is missing. Run <code>npm run snapshot-season -- &lt;its league ID&gt;</code>.
        </p>
      )}
      <RecordsView
        query={searchParams}
        columns={seasonColumns(seasons)}
        grids={{
          franchise: buildGrid(seasons, "franchise"),
          manager: buildGrid(seasons, "manager"),
        }}
      />
    </main>
  );
}
