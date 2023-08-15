const LEAGUE_ID = "xjmmzxsjlgl6mnid";

// https://www.fantrax.com/fxpa/req?leagueId=xjmmzxsjlgl6mnid
// const res = await fetch(`https://www.fantrax.com/fxea/general/getTeamRosters?leagueId=${LEAGUE_ID}`)
// const res = await fetch('https://www.fantrax.com/fxea/general/getPlayerIds?sport=NHL')

const dataRS = {
  msgs: [
    {
      method: "getTeamRosterInfo",
      data: {
        leagueId: "xjmmzxsjlgl6mnid",
        teamId: "7jqm0zjnlgl6mnjq",
        period: "1",
      },
    },
  ],
};

const dataMBP = {
  msgs: [
    {
      method: "getTeamRosterInfo",
      data: {
        leagueId: "xjmmzxsjlgl6mnid",
        teamId: "a0xtpzz4lgl6mnjk",
        period: "1",
      },
    },
  ],
};

const BT = {
  msgs: [
    {
      method: "getTeamRosterInfo",
      data: {
        leagueId: "xjmmzxsjlgl6mnid",
        teamId: "z0jhc7kflgl6mnjf",
        period: "2",
      },
    },
  ],
};

const options = {
  method: "POST",
  // mode: "cors",
  // cache: "no-cache",
  // credentials: "same-origin",
  headers: {
    "Content-Type": "application/json",
    // 'Content-Type': 'application/x-www-form-urlencoded',
  },
  // redirect: "follow",
  // referrerPolicy: "no-referrer",
  body: JSON.stringify(BT), // body data type must match "Content-Type" header
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

async function getData() {
  const responses = await getTeamRosterInfoForPeriods({
    teamId: "z0jhc7kflgl6mnjf",
    periods: ["1", "2", "3", "4", "5", "6"],
  });

  return responses;
}

export default async function Home() {
  const responses = await getData();
  // console.log(responses[0]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="flex">
        {responses.map((res, index) => (
          <Column key={index} response={res} />
        ))}
      </div>
    </main>
  );
}

function Column({ response } : {response: any}) {
  const periods = response.responses[0].data.displayedLists.periodList;
  const displayedPeriod =
    response.responses[0].data.displayedSelections.displayedPeriod;

  const periodTitle = `Period ${periods[displayedPeriod - 1]}`;
  // responses[0].data.displayedSelections.displayedPeriod
  const players = response?.responses?.[0]?.data?.tables?.[0]?.rows.filter(
    (item: any) => item.scorer
  );
  return (
    <div>
      <strong>{periodTitle}</strong>
      <ul style={{width: 200}}>
        {players.map((player: any, index: number) => {
          const playsToday = !!player.cells[1].content
          const bench = index >= 13
          return(
          <li key={player.scorer.urlName} style={{height: 50, outline: `1px solid ${bench ? 'gray' : 'white'}`, color: playsToday && !bench ? 'white' : 'gray'}}>
            {bench && 'BENCH/'}{POSITIONS[player.posId]} - {player.scorer.shortName}
            {playsToday && (<div> {player.cells[1].content.replace('<br/>', ' - ')}</div>)}
            {/* <pre style={{maxWidth: 300, overflow: 'auto'}}>{JSON.stringify(player, null, 2)}</pre> */}
          </li>
        )})}
      </ul>
    </div>
  );
}

interface PositionType {
  [key: number]: string;
} 

const POSITIONS: PositionType = {
  206: "C",
  203: "LW",
  204: "RW",
  202: "D",
};