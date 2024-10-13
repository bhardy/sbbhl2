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

const periods = ["7", "8", "9", "10", "11", "12", "13"];
const minMax = {
  C: 9,
  LW: 9,
  RW: 9,
  D: 12,
  G: 6,
};

// @note: skaters are tables[0], goalies are tables[1]
const getPositionTable = (tables: any, tableIndex: number) =>
  tables.reduce(
    (periodAcc: any, period: any, i: number) => {
      const periodPlayers = period[0].tables[tableIndex].rows.reduce(
        (playerAcc: any, player: any, index: number) => {
          // @note: we're just guessing that status "1" means "dressed"
          const isDressed = player.statusId === "1";
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
    periods,
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
  const playersTable = getPositionTable(tables, 0);
  const goaliesTable = getPositionTable(tables, 1);

  // @note this transposes the table
  // @todo: add goalies
  const players = zip(...playersTable.players);
  const goalies = zip(...goaliesTable.players);

  const counts = { ...playersTable.count, ...goaliesTable.count };

  return (
    <main className="mt-8">
      <h2 className="text-2xl font-bold">Counts</h2>
      <CountTable counts={counts} />
      <h2 className="text-2xl font-bold">Skaters</h2>
      <RosterTable headers={periods} table={players} count={DRESSED_SKATERS} />
      <h2 className="text-2xl font-bold">Goalies</h2>
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
                  className="border-b dark:border-slate-600 font-bold p-4 pl-8 pt-0 pb-3 text-slate-700 dark:text-slate-100 text-left"
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
                <tr
                  key={index}
                  className={
                    isBench
                      ? "bg-slate-100 dark:bg-transparent"
                      : "dark:bg-slate-900"
                  }
                >
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
                            ? "text-slate-700 dark:text-slate-200"
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
  // @todo DRY it up

  return (
    <div className="relative rounded-xl overflow-auto -mx-4">
      <div className="shadow-sm my-8">
        <table className="border-collapse table-auto w-full text-sm">
          <thead>
            <tr>
              <th className="border-b dark:border-slate-600 font-bold p-4 pl-8 pt-0 pb-3 text-slate-700 dark:text-slate-100 text-left">
                C
              </th>
              <th className="border-b dark:border-slate-600 font-bold p-4 pl-8 pt-0 pb-3 text-slate-700 dark:text-slate-100 text-left">
                LW
              </th>
              <th className="border-b dark:border-slate-600 font-bold p-4 pl-8 pt-0 pb-3 text-slate-700 dark:text-slate-100 text-left">
                RW
              </th>
              <th className="border-b dark:border-slate-600 font-bold p-4 pl-8 pt-0 pb-3 text-slate-700 dark:text-slate-100 text-left">
                D
              </th>
              <th className="border-b dark:border-slate-600 font-bold p-4 pl-8 pt-0 pb-3 text-slate-700 dark:text-slate-100 text-left">
                G
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800">
            <tr>
              <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-700 dark:text-slate-200">
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
              <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-700 dark:text-slate-200">
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
              <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-700 dark:text-slate-200">
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
              <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-700 dark:text-slate-200">
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
              <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-700 dark:text-slate-200">
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
