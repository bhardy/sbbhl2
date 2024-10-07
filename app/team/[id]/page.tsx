import { zip } from "lodash-es";

const LEAGUE_ID = "erva93djlwitpx9j";

// https://www.fantrax.com/fxpa/req?leagueId=erva93djlwitpx9j
// const res = await fetch(`https://www.fantrax.com/fxea/general/getTeamRosters?leagueId=${LEAGUE_ID}`)
// const res = await fetch('https://www.fantrax.com/fxea/general/getPlayerIds?sport=NHL')

// @todo move out of here
interface PositionType {
  [key: number]: string;
}

const POSITIONS: PositionType = {
  201: "G",
  206: "C",
  203: "LW",
  204: "RW",
  202: "D",
};

const DRESSED_GOALIES = 2;
const DRESSED_SKATERS = 13;

// @note: skaters are tables[0], goalies are tables[1]
const getPositionTable = (
  tables: any,
  tableIndex: number,
  activeCount: number,
) =>
  tables.reduce(
    (periodAcc: any, period: any, i: number) => {
      const periodPlayers = period[0].tables[tableIndex].rows.reduce(
        (playerAcc: any, player: any, index: number) => {
          const isDressed = index <= activeCount;
          const game = player.cells[1].content;
          if (!!player.posId) {
            const newPlayer = {
              ...player.scorer,
              posId: player.posId,
              game,
              isDressed,
              // @todo consider adding bench/minors status
            };
            playerAcc.players.push(newPlayer);

            // Increment the count for the current posId only when isDressed is true
            if (isDressed && game) {
              if (!playerAcc.count[player.posId]) {
                if (player.scorer.posShortNames === "G")
                  console.log("$$", player);
                playerAcc.count[player.posId] = 1;
              } else {
                playerAcc.count[player.posId]++;
              }
            }
          } else {
            // console.log(player);
          }
          return playerAcc;
        },
        { players: [], count: {} },
      );

      periodAcc.players.push(periodPlayers.players);

      // Merge the counts for this period into the accumulator
      for (const posId in periodPlayers.count) {
        if (!periodAcc.count[posId]) {
          periodAcc.count[posId] = periodPlayers.count[posId];
        } else {
          periodAcc.count[posId] += periodPlayers.count[posId];
        }
      }

      return periodAcc;
    },
    { players: [], count: {} },
  );

async function getTeamRosterInfo({
  teamId,
  period,
}: {
  teamId: string;
  period: string;
}) {
  const res = await fetch(
    "https://www.fantrax.com/fxpa/req?leagueId=erva93djlwitpx9j",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        msgs: [
          {
            method: "getTeamRosterInfo",
            data: {
              leagueId: "erva93djlwitpx9j",
              teamId,
              period,
            },
          },
        ],
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Failed to fetch data in getTeamRosterInfo");
  }

  return res.json();
}

const getTeamRosterInfoForPeriods = async ({
  teamId,
  periods,
}: {
  teamId: string;
  periods: string[];
}) => {
  const res = await Promise.all(
    periods.map((period) => getTeamRosterInfo({ teamId, period })),
  );
  return res; // Here, res is an array of response objects
};

// @todo - compile the periods, and pass the periods in, maybe add to route?
async function getTeamData(teamId: string) {
  const responses = await getTeamRosterInfoForPeriods({
    teamId,
    periods: ["1", "2", "3", "4", "5", "6"],
  });

  return responses;
}

export default async function Lineup({ params }: { params: { id: string } }) {
  const responses = await getTeamData(params.id);

  // @note this bit gets the table headings
  const periods = responses.map((period, index) => {
    // maybe this should be the index
    const periodList = period.responses[0].data.displayedLists.periodList;
    const displayedPeriod =
      period.responses[0].data.displayedSelections.displayedPeriod;
    return `Period ${periodList[displayedPeriod - 1]}`;
  });

  // @note this bit gets each period (day)'s table
  const tables = responses.map((res) => res.responses.map((p: any) => p.data));

  // @note this bit gets the players from each period
  // @note first array (map) is the period, period[1] is empty, tables[1] is goalies
  const playersTable = getPositionTable(tables, 0, DRESSED_SKATERS);
  const goaliesTable = getPositionTable(tables, 1, DRESSED_GOALIES);

  // @note this transposes the table
  // @todo: add goalies
  const players = zip(...playersTable.players);
  const goalies = zip(...goaliesTable.players);

  const counts = { ...playersTable.count, ...goaliesTable.count };

  return (
    <main className="mt-8">
      <CountTable counts={counts} />
      <RosterTable headers={periods} table={players} count={DRESSED_SKATERS} />
      <RosterTable headers={periods} table={goalies} count={DRESSED_GOALIES} />
    </main>
  );
}

function RosterTable({
  headers,
  table,
  count,
}: {
  headers: any;
  table: any;
  count: number;
}) {
  return (
    <div className="relative rounded-xl overflow-auto -mx-4">
      <div className="shadow-sm my-8">
        <table className="border-collapse table-auto w-full text-sm ">
          <thead>
            <tr>
              {headers.map((header: any) => (
                <th
                  key={header}
                  className="border-b dark:border-slate-600 font-medium p-4 pl-8 pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800">
            {table.map((row: any, index: number) => {
              // @todo: this bench check will not work great with goalies
              // isDressed is now in the player object
              const isBench = index >= count;
              return (
                <tr key={index} className={isBench ? "dark:bg-slate-900" : ""}>
                  {row.map((cell: any, index: number) => {
                    if (!cell) {
                      return (
                        <td
                          key={index}
                          className={`border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-500 dark:text-slate-400"`}
                        >
                          —
                        </td>
                      );
                    }
                    const playsToday = !!cell.game;
                    return (
                      <td
                        key={`${cell.scorerId}-${index}`}
                        className={`border-b border-slate-100 dark:border-slate-700 p-4 pl-8 ${
                          playsToday
                            ? "text-slate-200 dark:text-slate-100"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {POSITIONS[cell.posId]} - {cell.shortName}
                        {playsToday && (
                          <div> {cell.game.replace("<br/>", " - ")}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CountTable({ counts }: { counts: any }) {
  console.log(counts);
  // @todo DRY it up
  // @todo get max games from data
  //
  // @DB: these need to pull from the DB
  const minMax = {
    C: 8,
    LW: 8,
    RW: 8,
    D: 11,
    G: 6,
  };
  return (
    <div className="relative rounded-xl overflow-auto -mx-4">
      <div className="shadow-sm my-8">
        <table className="border-collapse table-auto w-full text-sm">
          <thead>
            <tr>
              <th className="border-b dark:border-slate-600 font-medium p-4 pl-8 pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left">
                C
              </th>
              <th className="border-b dark:border-slate-600 font-medium p-4 pl-8 pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left">
                LW
              </th>
              <th className="border-b dark:border-slate-600 font-medium p-4 pl-8 pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left">
                RW
              </th>
              <th className="border-b dark:border-slate-600 font-medium p-4 pl-8 pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left">
                D
              </th>
              <th className="border-b dark:border-slate-600 font-medium p-4 pl-8 pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left">
                G
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800">
            <tr>
              <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-200 dark:text-slate-100">
                <span
                  className={
                    counts[206] > minMax.C
                      ? "text-red-400"
                      : counts[206] < minMax.C
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {counts[206]} / {minMax.C}
                </span>
              </td>
              <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-200 dark:text-slate-100">
                <span
                  className={
                    counts[203] > minMax.LW
                      ? "text-red-400"
                      : counts[203] < minMax.LW
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {counts[203]} / {minMax.LW}
                </span>
              </td>
              <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-200 dark:text-slate-100">
                <span
                  className={
                    counts[204] > minMax.RW
                      ? "text-red-400"
                      : counts[204] < minMax.RW
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {counts[204]} / {minMax.RW}
                </span>
              </td>
              <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-200 dark:text-slate-100">
                <span
                  className={
                    counts[202] > minMax.D
                      ? "text-red-400"
                      : counts[202] < minMax.D
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {counts[202]} / {minMax.D}
                </span>
              </td>
              <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-200 dark:text-slate-100">
                <span
                  className={
                    counts[201] > minMax.G
                      ? "text-red-400"
                      : counts[201] < minMax.G
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {counts[201]} / {minMax.G}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
