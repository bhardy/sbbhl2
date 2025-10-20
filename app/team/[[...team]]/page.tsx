import { zip, mergeWith, add } from "lodash-es";
import { DateTime } from "luxon";
import { MATCHUPS, getCurrentWeek } from "../../constants/matchups";

const LEAGUE_ID = '1of9qqosmafokzoq'

// https://www.fantrax.com/fxpa/req?leagueId=1of9qqosmafokzoq
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

const DRESSED_GOALIES = 3;
const DRESSED_SKATERS = 13;

type CapsType = {
  min: string; // @note I think this is a string because it's not set
  pos: string;
  max: number;
  gp: number;
  posShort: string;
};

type GamesPlayedType = {
  "201": number;
  "202": number;
  "203": number;
  "204": number;
  "206": number;
};

// @note: MATCHUPS is now imported from constants/matchups.ts

const convertToPacific = (time: string, serverDate: string | number) => {
  try {
    // Handle case where serverDate is a timestamp number
    if (typeof serverDate === 'number') {
      // Convert timestamp to a date and use a default timezone
      // Since we don't know the original timezone from the timestamp, use Eastern as default
      const sourceZone = "America/New_York";
      
      // Remove the day of week and parse the time
      const timeWithoutDay = time.split(" ")[1];
      
      // Parse using the correct format for "7:00PM"
      const sourceTime = DateTime.fromFormat(timeWithoutDay, "h:mma", {
        zone: sourceZone,
      });
      
      if (!sourceTime.isValid) {
        console.error("Invalid time format:", time);
        return time;
      }
      
      const pacificTime = sourceTime.setZone("America/Los_Angeles");
      return `${time.split(" ")[0]} ${pacificTime.toFormat("h:mma ZZZZ")}`;
    }
    
    // Handle case where serverDate is not a string or is undefined
    if (!serverDate || typeof serverDate !== 'string') {
      console.warn("Invalid serverDate:", serverDate);
      return time;
    }
    
    // Extract timezone from serverDate (e.g., "EDT" from "8:03 PM EDT")
    const sourceTimezone = serverDate.split(" ").pop();

    const timezoneMap: Record<string, string> = {
      EDT: "America/New_York",
      EST: "America/New_York",
      CDT: "America/Chicago",
      CST: "America/Chicago",
      MDT: "America/Denver",
      MST: "America/Denver",
      PDT: "America/Los_Angeles",
      PST: "America/Los_Angeles",
    };

    const sourceZone =
      timezoneMap[sourceTimezone as keyof typeof timezoneMap] ||
      "America/New_York";

    // Remove the day of week and parse the time
    const timeWithoutDay = time.split(" ")[1];

    // Parse using the correct format for "7:00PM"
    const sourceTime = DateTime.fromFormat(timeWithoutDay, "h:mma", {
      zone: sourceZone,
    });

    if (!sourceTime.isValid) {
      console.error("Invalid time format:", time);
      return time;
    }

    const pacificTime = sourceTime.setZone("America/Los_Angeles");
    // You can customize the output format as needed
    return `${time.split(" ")[0]} ${pacificTime.toFormat("h:mma ZZZZ")}`; // Will return "Fri 4:00PM PDT"
  } catch (error) {
    console.error("Error converting time:", error);
    return time;
  }
};

// @note: ugly, this turns minmax into the form the Counts component uses:
type minMaxType = {
  min: string;
  pos: string;
  max: number;
  gp: number;
  posShort: "C" | "LW" | "RW" | "D" | "G";
}[];
const formatMinMax = (minMax: minMaxType): GamesPlayedType => {
  return Object.entries(POSITIONS).reduce<{ [key: string]: number }>(
    (acc, [key, value]) => {
      const matchingItem = minMax.find((item) => item.posShort === value);
      if (matchingItem) {
        acc[key] = matchingItem.gp;
      }
      return acc;
    },
    {},
  ) as GamesPlayedType;
};

// @note: skaters are tables[0], goalies are tables[1]
const getPositionTable = (tables: any, tableIndex: number) =>
  tables.reduce(
    (periodAcc: any, period: any) => {
      const periodPlayers = period[0].tables[tableIndex].rows.reduce(
        (playerAcc: any, player: any) => {
          // @note: we're just guessing that status "1" means "dressed"
          const isDressed = player.statusId === "1";
          const isMinors = player.statusId === "9";
          const game = player.cells[1].content;

          // @note: very flimsy check to see if the game has started — if it has it'll have a score instead of a start time
          const hasGameStarted = !!game && !game.includes(":");

          if (!!player.posId) {
            const newPlayer = {
              ...player.scorer,
              posId: player.posId,
              game,
              isDressed,
              isMinors,
            };
            playerAcc.players.push(newPlayer);

            // @note only increment the projected count when:
            //   1. the player is dressed
            //   2. the player has a game
            //   3. the game has NOT started (fantrax counts the games played for us in minMax)
            if (isDressed && game && !hasGameStarted) {
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

async function getGamesPlayed({
  teamId,
  scoringPeriod,
}: {
  teamId: string;
  scoringPeriod: string;
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
              scoringPeriod,
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

async function getTeamData(
  teamId: string,
  periods: string[],
  scoringPeriod: string,
) {
  const roster = await getTeamRosterInfoForPeriods({
    teamId,
    periods,
  });

  const minMax = await getGamesPlayed({
    teamId,
    scoringPeriod,
  });

  return [roster, minMax];
}

export default async function Lineup({
  params,
  searchParams,
}: {
  params: {
    team: string[];
  };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [id, matchup] = params.team;
  // @todo make this automatic
  const scoringPeriodToDisplay = matchup ?? getCurrentWeek();
  const matchupPeriods = MATCHUPS[scoringPeriodToDisplay].periods;
  
  // Get the toggle parameters from URL
  const showMinors = searchParams.showMinors === 'true';

  const [roster, minMax] = await getTeamData(
    id,
    matchupPeriods,
    scoringPeriodToDisplay,
  );

  // @note: it would be nicer to grab this from the header request but this works for now
  const serverDate = roster[0]?.data?.sDate;

  // @todo: the promises should be combined above
  // this gets the minMax and scoring periods from the roster minMax view
  // const gp = await getGP(id, matchupPeriods);

  const caps: CapsType[] =
    minMax.responses[0].data.gamePlayedPerPosData.tableData;

  // @note these are matchups
  // const scoringPeriods =
  //   gp[0].responses[0].data.displayedLists.scoringPeriodList;

  // @note these are each day, the period 1 here is used in the roster queries as a part of an array
  // const dailyPeriods = roster[0].responses[0].data.displayedLists.periodList;

  // @note this bit gets the table headings
  //
  const periodHeadings = roster.map((period: any) => {
    // maybe this should be the index
    const periodList = period.responses[0].data.displayedLists.periodList;
    const displayedPeriod =
      period.responses[0].data.displayedSelections.displayedPeriod;
    return `Period ${periodList[displayedPeriod - 1]}`;
  });

  // @note this bit gets each period (day)'s table
  const tables = roster.map((res: any) =>
    res.responses.map((p: any) => p.data),
  );

  // @note this bit gets the players from each period
  // @note first array (map) is the period, period[1] is empty, tables[1] is goalies
  const playersTable = getPositionTable(tables, 0);
  const goaliesTable = getPositionTable(tables, 1);

  // @note this transposes the table
  const players = zip(...playersTable.players);
  const goalies = zip(...goaliesTable.players);

  // No filtering needed - we'll handle styling in the component
  const filteredPlayers = players;
  const filteredGoalies = goalies;

  const projected = { ...playersTable.count, ...goaliesTable.count };

  const gp = minMax.responses[0].data.gamePlayedPerPosData.tableData;
  const counts = formatMinMax(gp);

  return (
    <main className="mt-8">
      <h2 className="text-2xl font-bold">Projected Games Played</h2>
      <CountTable projected={projected} counts={counts} caps={caps} />
      <h2 className="text-2xl font-bold">Skaters</h2>
      <RosterTable
        headers={periodHeadings}
        table={filteredPlayers}
        count={DRESSED_SKATERS}
        serverDate={serverDate}
        showMinors={showMinors}
      />
      <h2 className="text-2xl font-bold">Goalies</h2>
      <RosterTable
        headers={periodHeadings}
        table={filteredGoalies}
        count={DRESSED_GOALIES}
        serverDate={serverDate}
        showMinors={showMinors}
      />
    </main>
  );
}

function RosterTable({
  headers,
  table,
  count,
  serverDate,
  showMinors,
}: {
  headers: any;
  table: any;
  count: number;
  serverDate: string;
  showMinors: boolean;
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
                    {period} <br /> ({date}
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
                    // @note: games that have started don't have their, instead show the score
                    const hasGameStarted = !cell.game?.includes(":");
                    let opponent = null;
                    let time = null;

                    if (playsToday) {
                      if (hasGameStarted) {
                        opponent = cell.game.replace("<br/>", " - ");
                      } else {
                        [opponent, time] = cell.game.split("<br/>");
                      }
                    }

                    // @note: time can also be the score for a finished game
                    const zonedTime =
                      time && !time.includes("@")
                        ? `— ${convertToPacific(time, serverDate)}`
                        : "";

                    // Determine if player should be greyed out
                    const isGreyedOut = cell.isMinors && !showMinors;
                    const effectivePlaysToday = playsToday && !isGreyedOut;

                    return (
                      <td
                        key={`${cell.scorerId}-${index}`}
                        className={`border-b border-slate-200 dark:border-slate-700 align-top p-4 ${
                          effectivePlaysToday
                            ? "text-slate-700 dark:text-slate-200"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <span
                          className={`py-0 px-1 rounded-sm ${effectivePlaysToday ? `${POSITION_COLORS[cell.posId]} text-slate-100` : "bg-slate-200 text-slate-400 dark:bg-slate-500 dark:text-slate-300"}`}
                        >
                          {POSITIONS[cell.posId]}
                        </span>
                        {cell.isMinors && (
                          <span className={`ml-1 text-xs px-1 py-0.5 rounded ${
                            showMinors 
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-slate-200 text-slate-400 dark:bg-slate-500 dark:text-slate-300"
                          }`}>
                            M
                          </span>
                        )}{" "}
                        {effectivePlaysToday && (
                          <span className="text-xs">
                            {opponent} {zonedTime}
                          </span>
                        )}
                        <div className="font-bold">
                          {cell.shortName} (
                          {cell.posIds.map(
                            (pos: keyof PositionType, index: number) => {
                              return (
                                <span
                                  key={pos}
                                  className={`${effectivePlaysToday ? POSITION_TEXT_COLORS[pos] : "text-slate-400 dark:text-slate-400"} text-xs`}
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

function CountTable({
  counts,
  projected,
  caps,
}: {
  counts: GamesPlayedType;
  projected: GamesPlayedType;
  caps: CapsType[];
}) {
  // yuck but workin and it's late
  // @note: this also has the actual played GP counts in it too
  const getMinMax = (posShort: "C" | "LW" | "RW" | "D" | "G") =>
    caps.find((cap) => cap.posShort === posShort);

  const totals = mergeWith({}, counts, projected, add);

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
                    totals[206] > getMinMax("C")!.max
                      ? "text-red-400"
                      : totals[206] < getMinMax("C")!.max
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {totals[206]} / {getMinMax("C")!.max}
                </span>
              </td>
              <td className="border-b border-slate-200 dark:border-slate-700 p-4 text-slate-700 dark:text-slate-200">
                <span
                  className={
                    totals[203] > getMinMax("LW")!.max
                      ? "text-red-400"
                      : totals[203] < getMinMax("LW")!.max
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {totals[203]} / {getMinMax("LW")!.max}
                </span>
              </td>
              <td className="border-b border-slate-200 dark:border-slate-700 p-4 text-slate-700 dark:text-slate-200">
                <span
                  className={
                    totals[204] > getMinMax("RW")!.max
                      ? "text-red-400"
                      : totals[204] < getMinMax("RW")!.max
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {totals[204]} / {getMinMax("RW")!.max}
                </span>
              </td>
              <td className="border-b border-slate-200 dark:border-slate-700 p-4 text-slate-700 dark:text-slate-200">
                <span
                  className={
                    totals[202] > getMinMax("D")!.max
                      ? "text-red-400"
                      : totals[202] < getMinMax("D")!.max
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {totals[202]} / {getMinMax("D")!.max}
                </span>
              </td>
              <td className="border-b border-slate-200 dark:border-slate-700 p-4 text-slate-700 dark:text-slate-200">
                <span
                  className={
                    totals[201] > getMinMax("G")!.max
                      ? "text-red-400"
                      : totals[201] < getMinMax("G")!.max
                        ? "text-blue-400"
                        : ""
                  }
                >
                  {totals[201]} / {getMinMax("G")!.max}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
