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

interface PositionColorType {
  [key: number]: string;
}

const POSITION_COLORS: PositionColorType = {
  201: "bg-cyan-500",
  206: "bg-pink-500",
  203: "bg-purple-500",
  204: "bg-blue-500",
  202: "bg-green-500",
};

const POSITION_TEXT_COLORS: PositionColorType = {
  201: "text-cyan-500",
  206: "text-pink-500",
  203: "text-purple-500",
  204: "text-blue-500",
  202: "text-green-500",
};

const DRESSED_GOALIES = 2;
const DRESSED_SKATERS = 13;

type CapsType = {
  min: string; // @note I think this is a string because it's not set
  pos: string;
  max: number;
  gp: number;
  posShort: string;
};

// @this shouldn't be hardcoded
type MatchupType = {
  periods: string[];
};

type MatchupsType = {
  [key: string]: MatchupType;
};
const MATCHUPS: MatchupsType = {
  "1": {
    periods: ["1", "2", "3", "4", "5", "6"],
  },
  "2": {
    periods: ["7", "8", "9", "10", "11", "12", "13"],
  },
  "3": {
    periods: ["14", "15", "16", "17", "18", "19", "20"],
  },
  "4": {
    periods: ["21", "22", "23", "24", "25", "26", "27"],
  },
  "5": {
    periods: ["28", "29", "30", "31", "32", "33", "34"],
  },
  "6": {
    periods: ["35", "36", "37", "38", "39", "40", "41"],
  },
  "7": {
    periods: ["42", "43", "44", "45", "46", "47", "48"],
  },
  "8": {
    periods: ["49", "50", "51", "52", "53", "54", "55"],
  },
  "9": {
    periods: ["56", "57", "58", "59", "60", "61", "62"],
  },
  "10": {
    periods: ["63", "64", "65", "66", "67", "68", "69"],
  },
  "11": {
    periods: ["70", "71", "72", "73", "74", "75", "76"],
  },
  "12": {
    periods: ["77", "78", "79", "80", "81", "82", "83"],
  },
  "13": {
    periods: ["84", "85", "86", "87", "88", "89", "90"],
  },
  "14": {
    periods: ["91", "92", "93", "94", "95", "96", "97"],
  },
  "15": {
    periods: ["98", "99", "100", "101", "102", "103", "104"],
  },
  "16": {
    periods: ["105", "106", "107", "108", "109", "110", "111"],
  },
  "17": {
    periods: ["112", "113", "114", "115", "116", "117", "118"],
  },
  "18": {
    periods: ["119", "120", "121", "122", "123", "124", "125"],
  },
  "19": {
    periods: [
      "126",
      "127",
      "128",
      "129",
      "130",
      "131",
      "132",
      "133",
      "134",
      "135",
      "136",
      "137",
      "138",
      "139",
      "140",
      "141",
      "142",
      "143",
      "144",
      "145",
      "146",
    ],
  },
  "20": {
    periods: ["147", "148", "149", "150", "151", "152", "153"],
  },
  "21": {
    periods: ["154", "155", "156", "157", "158", "159", "160"],
  },
  "22": {
    periods: ["161", "162", "163", "164", "165", "166", "167"],
  },
  "23": {
    periods: ["168", "169", "170", "171", "172", "173", "174"],
  },
  "24": {
    periods: ["175", "176", "177", "178", "179", "180", "181"],
  },
};

// @note: skaters are tables[0], goalies are tables[1]
const getPositionTable = (tables: any, tableIndex: number) =>
  tables.reduce(
    (periodAcc: any, period: any) => {
      const periodPlayers = period[0].tables[tableIndex].rows.reduce(
        (playerAcc: any, player: any) => {
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
    `https://www.fantrax.com/fxpa/req?leagueId=${LEAGUE_ID}`,
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
              leagueId: LEAGUE_ID,
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
async function getGPView({
  teamId,
  period,
}: {
  teamId: string;
  period: string;
}) {
  const res = await fetch(
    `https://www.fantrax.com/fxpa/req?leagueId=${LEAGUE_ID}`,
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
              leagueId: LEAGUE_ID,
              teamId,
              period,
              view: "GAMES_PER_POS",
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

// async function getLeagueInfo() {
//   const res = await fetch(
//     `https://www.fantrax.com/fxea/general/getLeagueInfo?leagueId=${LEAGUE_ID}`,
//     {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         msgs: [
//           {
//             method: "getLeagueInfo",
//             data: {
//               leagueId: LEAGUE_ID,
//             },
//           },
//         ],
//       }),
//       cache: "no-store",
//     },
//   );

//   if (!res.ok) {
//     // This will activate the closest `error.js` Error Boundary
//     throw new Error("Failed to fetch data in getTeamRosterInfo");
//   }

//   return res.json();
// }

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
async function getTeamData(teamId: string, periods: string[]) {
  const roster = await getTeamRosterInfoForPeriods({
    teamId,
    periods,
  });

  return [roster];
}

const getTeamGPForPeriods = async ({
  teamId,
  periods,
}: {
  teamId: string;
  periods: string[];
}) => {
  const res = await Promise.all(
    periods.map((period) => getGPView({ teamId, period })),
  );
  return res; // Here, res is an array of response objects
};

async function getGP(teamId: string, periods: string[]) {
  // const responses = await getTeamGPForPeriods({ teamId, periods });
  const responses = await getTeamGPForPeriods({ teamId, periods });
  return responses;
}

export default async function Lineup({
  params,
}: {
  params: {
    team: string[];
  };
}) {
  const [id, matchup] = params.team;
  const matchupToDisplay = matchup ?? "2";

  const periods2 = MATCHUPS[matchupToDisplay].periods;

  const [roster] = await getTeamData(id, periods2);

  // @todo: the promises should be combined above
  // this gets the minMax and scoring periods from the roster minMax view
  const gp = await getGP(id, periods2);
  const caps: CapsType[] =
    gp[0].responses[0].data.gamePlayedPerPosData.tableData;

  // @note these are matchups
  // const scoringPeriods =
  //   gp[0].responses[0].data.displayedLists.scoringPeriodList;

  // @note hese are each day, the period 1 here is used in the roster queries as a part of an array
  // const dailyPeriods = roster[0].responses[0].data.displayedLists.periodList;

  // @note this bit gets the table headings
  const periods = roster.map((period) => {
    // maybe this should be the index
    const periodList = period.responses[0].data.displayedLists.periodList;
    const displayedPeriod =
      period.responses[0].data.displayedSelections.displayedPeriod;
    return `Period ${periodList[displayedPeriod - 1]}`;
  });

  // @note this bit gets each period (day)'s table
  const tables = roster.map((res) => res.responses.map((p: any) => p.data));

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
      <h2 className="text-2xl font-bold">Projected Games Played</h2>
      <CountTable counts={counts} caps={caps} />
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
        <table className="border-collapse table-fixed w-full text-sm ">
          <thead>
            <tr>
              {headers.map((header: any) => {
                const [period, date] = header.split(" (");
                return (
                  <th
                    key={header}
                    className="border-b border-slate-300 dark:border-slate-500 font-bold p-4 pt-0 pb-3 text-slate-700 dark:text-slate-100 text-left w-48"
                  >
                    {period} <br /> {date}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800">
            {table.map((row: any, index: number) => {
              // @note: we count rows here instead of checking at player props because they're too unpredictable
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
                    if (!cell || !cell?.posIds?.length) {
                      return (
                        <td
                          key={index}
                          className={`border-b border-slate-200 dark:border-slate-700 p-4 text-slate-500 dark:text-slate-400"`}
                        >
                          —
                        </td>
                      );
                    }
                    const playsToday = !!cell.game;
                    const [opponent, time] = playsToday
                      ? cell.game.split("<br/>")
                      : ["", ""];

                    return (
                      <td
                        key={`${cell.scorerId}-${index}`}
                        className={`border-b border-slate-200 dark:border-slate-700 align-top p-4 ${
                          playsToday
                            ? "text-slate-700 dark:text-slate-200"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <span
                          className={`py-0 px-1 rounded-sm ${playsToday ? `${POSITION_COLORS[cell.posId]} text-slate-100` : "bg-slate-200 text-slate-400 dark:bg-slate-500 dark:text-slate-300"}`}
                        >
                          {POSITIONS[cell.posId]}
                        </span>{" "}
                        {playsToday && (
                          <span className="text-xs">
                            {opponent} — {time}
                          </span>
                        )}
                        <div className="font-bold">
                          {cell.shortName} (
                          {cell.posIds.map(
                            (pos: keyof PositionType, index: number) => {
                              return (
                                <span
                                  key={pos}
                                  className={`${playsToday ? POSITION_TEXT_COLORS[pos] : "text-slate-400 dark:text-slate-400"} text-xs`}
                                >
                                  {POSITIONS[pos]}
                                  {index !== cell.posIds.length - 1 && ", "}
                                </span>
                              );
                            },
                          )}
                          ){" "}
                        </div>
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

function CountTable({ counts, caps }: { counts: any; caps: CapsType[] }) {
  // yuck but workin and it's late
  // @note: this also has the actual played GP counts in it too
  const getMinMax = (posShort: "C" | "LW" | "RW" | "D" | "G") =>
    caps.find((cap) => cap.posShort === posShort);

  // @todo DRY it up
  return (
    <div className="relative rounded-xl overflow-auto -mx-4">
      <div className="shadow-sm my-8">
        <table className="border-collapse table-auto w-full text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-300 dark:border-slate-500 font-bold p-4 pt-0 pb-3 text-slate-700 dark:text-slate-100 text-left">
                C
              </th>
              <th className="border-b border-slate-300 dark:border-slate-500 font-bold p-4 pt-0 pb-3 text-slate-700 dark:text-slate-100 text-left">
                LW
              </th>
              <th className="border-b border-slate-300 dark:border-slate-500 font-bold p-4 pt-0 pb-3 text-slate-700 dark:text-slate-100 text-left">
                RW
              </th>
              <th className="border-b border-slate-300 dark:border-slate-500 font-bold p-4 pt-0 pb-3 text-slate-700 dark:text-slate-100 text-left">
                D
              </th>
              <th className="border-b border-slate-300 dark:border-slate-500 font-bold p-4 pt-0 pb-3 text-slate-700 dark:text-slate-100 text-left">
                G
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800">
            <tr>
              <td className="border-b border-slate-200 dark:border-slate-700 p-4 text-slate-700 dark:text-slate-200">
                <span
                  className={
                    counts[206] > getMinMax("C")!.max
                      ? "text-red-400"
                      : counts[206] < getMinMax("C")!.max
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {counts[206]} / {getMinMax("C")!.max}
                </span>
              </td>
              <td className="border-b border-slate-200 dark:border-slate-700 p-4 text-slate-700 dark:text-slate-200">
                <span
                  className={
                    counts[203] > getMinMax("LW")!.max
                      ? "text-red-400"
                      : counts[203] < getMinMax("LW")!.max
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {counts[203]} / {getMinMax("LW")!.max}
                </span>
              </td>
              <td className="border-b border-slate-200 dark:border-slate-700 p-4 text-slate-700 dark:text-slate-200">
                <span
                  className={
                    counts[204] > getMinMax("RW")!.max
                      ? "text-red-400"
                      : counts[204] < getMinMax("RW")!.max
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {counts[204]} / {getMinMax("RW")!.max}
                </span>
              </td>
              <td className="border-b border-slate-200 dark:border-slate-700 p-4 text-slate-700 dark:text-slate-200">
                <span
                  className={
                    counts[202] > getMinMax("D")!.max
                      ? "text-red-400"
                      : counts[202] < getMinMax("D")!.max
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {counts[202]} / {getMinMax("D")!.max}
                </span>
              </td>
              <td className="border-b border-slate-200 dark:border-slate-700 p-4 text-slate-700 dark:text-slate-200">
                <span
                  className={
                    counts[201] > getMinMax("G")!.max
                      ? "text-red-400"
                      : counts[201] < getMinMax("G")!.max
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {counts[201]} / {getMinMax("G")!.max}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
