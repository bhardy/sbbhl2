import { zip } from "lodash-es";

const LEAGUE_ID = "xjmmzxsjlgl6mnid";

// https://www.fantrax.com/fxpa/req?leagueId=xjmmzxsjlgl6mnid
// const res = await fetch(`https://www.fantrax.com/fxea/general/getTeamRosters?leagueId=${LEAGUE_ID}`)
// const res = await fetch('https://www.fantrax.com/fxea/general/getPlayerIds?sport=NHL')

// @todo move out of here
interface PositionType {
  [key: number]: string;
}

// @todo add goalies
const POSITIONS: PositionType = {
  206: "C",
  203: "LW",
  204: "RW",
  202: "D",
};

async function getTeamRosterInfo({
  teamId,
  period,
}: {
  teamId: string;
  period: string;
}) {
  const res = await fetch(
    "https://www.fantrax.com/fxpa/req?leagueId=xjmmzxsjlgl6mnid",
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
              leagueId: "xjmmzxsjlgl6mnid",
              teamId,
              period,
            },
          },
        ],
      }),
      cache: "no-store",
    }
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
    periods.map((period) => getTeamRosterInfo({ teamId, period }))
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
  const players = tables.map((period) =>
    period[0].tables[0].rows.reduce((acc: any, player: any) => {
      if (!!player.posId) {
        return [
          ...acc,
          {
            ...player.scorer,
            posId: player.posId,
            game: player.cells[1].content,
            // @todo consider adding bench/minors status
          }
        ]
      }
      return acc;
    }, [])
  );

  // @note this transposes the table
  // @todo: add goalies
  const table = zip(...players);

  return (
    <main className="mt-8">
      <Table headers={periods} table={table} />
      {/* @todo add counts */}
    </main>
  );
}

function Table({ headers, table }: { headers: any; table: any }) {
  return (
    <div className="relative rounded-xl overflow-auto">
      <div className="shadow-sm overflow-hidden my-8">
        <table className="border-collapse table-auto w-full text-sm">
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
              const isBench = index >= 13;
              return (
                <tr key={index} className={isBench ? "dark:bg-slate-900" : ""}>
                  {row.map((cell: any, index: number) => {
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
