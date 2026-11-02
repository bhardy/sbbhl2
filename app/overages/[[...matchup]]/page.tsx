import type { Metadata } from "next";
import Link from "next/link";
import { DateTime } from "luxon";
import { Refresh } from "../../components/Refresh";
import { LEAGUE_ID } from "../../constants/league";
import { MATCHUPS, getCurrentWeek, getPeriodISODate } from "../../constants/matchups";
import {
  POSITIONS,
  findOverages,
  parseRosterDay,
  scheduleStarts,
  withStart,
  type Caps,
  type Overage,
  type Position,
} from "../../lib/overages";
import { GamesDetails } from "../GamesDetails";
import { WeekSelect } from "../WeekSelect";

// Headroom over Vercel's 10s default for Fantrax's slow in-progress days.
export const maxDuration = 30;

export const metadata: Metadata = {
  title: "SBBHL Overages",
  description: "Which games to unset when a team goes over a weekly games-played cap",
};

const POSITION_COLORS: Record<Position, string> = {
  C: "bg-pink-500",
  LW: "bg-purple-500",
  RW: "bg-blue-500",
  D: "bg-green-500",
  G: "bg-cyan-500",
};

type GpRow = { posShort: Position; gp: number; max: number };

async function fantrax(msgs: { method: string; data: Record<string, string> }[]) {
  const res = await fetch(`https://www.fantrax.com/fxpa/req?leagueId=${LEAGUE_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msgs }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fantrax request failed: ${res.status}`);
  const json = await res.json();
  return json.responses.map((r: { data: unknown }) => r.data) as any[];
}

async function getTeams(): Promise<{ id: string; name: string }[]> {
  const [data] = await fantrax([{ method: "getTeamRosterInfo", data: { leagueId: LEAGUE_ID } }]);
  return data.fantasyTeams;
}

// Each day of the matchup, with that day's stats, plus Fantrax's
// GP-per-position table to check our count against. Fantrax answers a batch
// one message at a time and is slow (~1s) for days that aren't final yet, so
// every day goes out as its own request.
async function getTeamWeek(teamId: string, matchup: string, periods: string[]) {
  const [days, [gpData]] = await Promise.all([
    Promise.all(
      periods.map((period) =>
        fantrax([
          {
            method: "getTeamRosterInfo",
            data: { leagueId: LEAGUE_ID, teamId, period, timeframeTypeCode: "BY_PERIOD" },
          },
        ]),
      ),
    ),
    fantrax([
      {
        method: "getTeamRosterInfo",
        data: { leagueId: LEAGUE_ID, teamId, scoringPeriod: matchup, view: "GAMES_PER_POS" },
      },
    ]),
  ]);
  const gp: GpRow[] = gpData.gamePlayedPerPosData.tableData;
  return {
    games: periods.flatMap((period, i) =>
      parseRosterDay(days[i][0].tables, getPeriodISODate(Number(period))),
    ),
    fantraxGp: Object.fromEntries(gp.map((row) => [row.posShort, row])) as Record<Position, GpRow>,
  };
}

// Each schedule call covers the 7 days from its date.
async function getStarts(periods: string[]) {
  const weeks = await Promise.all(
    periods
      .filter((_, i) => i % 7 === 0)
      .map(async (period) => {
        const res = await fetch(
          `https://api-web.nhle.com/v1/schedule/${getPeriodISODate(Number(period))}`,
          { next: { revalidate: 3600 } },
        );
        if (!res.ok) throw new Error(`NHL schedule request failed: ${res.status}`);
        return (await res.json()).gameWeek;
      }),
  );
  return scheduleStarts(weeks.flat());
}

// The game lists to show expanded, from `?open=<teamId>-<pos>,...`.
const openIds = (value: string | string[] | undefined) =>
  new Set([value ?? []].flat().join(",").split(",").filter(Boolean));

const capsFrom = (gp: Record<Position, GpRow>) =>
  Object.fromEntries(POSITIONS.map((pos) => [pos, gp[pos].max])) as Caps;

const formatStart = (start: string) =>
  DateTime.fromISO(start).setZone("America/Los_Angeles").toFormat("ccc MMM d, h:mma ZZZZ");

const formatDate = (date: string) => DateTime.fromISO(date).toFormat("ccc MMM d");

export default async function OveragesPage({
  params,
  searchParams,
}: {
  params: { matchup?: string[] };
  searchParams: { open?: string | string[] };
}) {
  const open = openIds(searchParams.open);
  // Default to the last finished week, when the commissioner cleans up.
  const matchup =
    params.matchup?.[0] ?? String(Math.max(1, Number(getCurrentWeek()) - 1));
  if (!MATCHUPS[matchup]) return <main className="mt-8">No matchup {matchup}</main>;
  const { maxGamesPerPos } = MATCHUPS[matchup];
  // Days that haven't started (Eastern) have no games to count.
  const today = DateTime.now().setZone("America/New_York").toISODate()!;
  const periods = MATCHUPS[matchup].periods.filter(
    (period) => getPeriodISODate(Number(period)) <= today,
  );

  const startsPromise = getStarts(periods);
  const teams = await getTeams();
  const [starts, weeks] = await Promise.all([
    startsPromise,
    Promise.all(teams.map((team) => getTeamWeek(team.id, matchup, periods))),
  ]);
  const results = teams.map((team, i) => {
    const { games, fantraxGp } = weeks[i];
    const fantraxCaps = capsFrom(fantraxGp);
    const counted = games.map((g) => withStart(g, starts));
    return {
      ...team,
      overages: findOverages(counted, maxGamesPerPos ?? fantraxCaps, fantraxCaps),
      mismatches: POSITIONS.flatMap((pos) => {
        const ours = counted.filter((g) => g.pos === pos).length;
        return ours === fantraxGp[pos].gp ? [] : [{ pos, ours, fantrax: fantraxGp[pos].gp }];
      }),
    };
  });
  const flagged = results.filter((t) => t.overages.length || t.mismatches.length);
  const clean = results.filter((t) => !t.overages.length && !t.mismatches.length);

  return (
    <main className="mt-4 flex flex-col gap-8">
      <div className="flex flex-col gap-2 items-start">
        <WeekSelect matchup={matchup} />
        <Refresh />
      </div>
      <p className="text-sm max-w-3xl">
        Fantrax stops scoring a position the day after its max is met, but every game on the day it
        gets crossed still counts. Unset these games from the lineup: the latest start of the week
        first, and for games that start at the same time, the higher score first. Times are Pacific.
      </p>
      {flagged.length === 0 && (
        <p className="text-slate-700 dark:text-slate-200">No overages this week.</p>
      )}
      {flagged.map((team) => (
        <section key={team.id} className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">
            <Link href={`/team/${team.id}/${matchup}`} className="hover:underline">
              {team.name}
            </Link>
          </h2>
          {team.mismatches.map(({ pos, ours, fantrax }) => (
            <p key={pos} className="text-sm text-amber-500">
              Fantrax shows {fantrax} {pos} games but {ours} counted here. Check this one by hand.
            </p>
          ))}
          {team.overages.map((overage) => (
            <OverageTable
              key={overage.pos}
              overage={overage}
              detailsId={`${team.id}-${overage.pos}`}
              open={open.has(`${team.id}-${overage.pos}`)}
            />
          ))}
        </section>
      ))}
      {clean.length > 0 && (
        <p className="text-sm">No overages: {clean.map((t) => t.name).join(", ")}</p>
      )}
    </main>
  );
}

const TH =
  "border-b border-slate-300 dark:border-slate-500 font-bold p-4 pt-0 pb-3 text-slate-700 dark:text-slate-100 text-left";
const TD = "border-b border-slate-200 dark:border-slate-700 p-4 text-slate-700 dark:text-slate-200";

function OverageTable({
  overage,
  detailsId,
  open,
}: {
  overage: Overage;
  detailsId: string;
  open: boolean;
}) {
  const { pos, gp, max, unset, games, tiedWith } = overage;
  const unsetKeys = new Set(unset.map((g) => `${g.playerId}-${g.date}`));
  return (
    <div>
      <h3 className="font-bold text-slate-700 dark:text-slate-200">
        <span className={`py-0 px-1 rounded-sm text-slate-100 ${POSITION_COLORS[pos]}`}>{pos}</span>{" "}
        <span className="text-red-400">
          {gp} / {max}
        </span>
        : unset {unset.length} {unset.length === 1 ? "game" : "games"}
      </h3>
      <div className="relative rounded-xl overflow-auto -mx-4">
        <div className="shadow-sm my-4">
          {/* Fixed widths so every team's table lines up */}
          <table className="border-collapse table-fixed w-full min-w-[64rem] text-sm">
            <thead>
              <tr>
                <th className={`${TH} w-60`}>Player</th>
                <th className={`${TH} w-64`}>Start</th>
                <th className={`${TH} w-36`}>Game</th>
                <th className={`${TH} w-24`}>FPts</th>
                <th className={TH}>Note</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800">
              {unset.map((game) => (
                <tr key={`${game.playerId}-${game.date}`}>
                  <td className={`${TD} font-bold`}>{game.player}</td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {game.start ? formatStart(game.start) : formatDate(game.date)}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>{game.game}</td>
                  <td className={TD}>{game.fpts}</td>
                  <td className={`${TD} text-slate-500 dark:text-slate-400`}>
                    {game.scoredZero
                      ? "Played after the max was met, so Fantrax already scored it 0"
                      : !game.start
                        ? "Start time not found, check it by hand"
                        : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <GamesDetails id={detailsId} defaultOpen={open} summary={`Show all ${gp} ${pos} games`}>
        <p className="mt-2 max-w-3xl text-slate-500 dark:text-slate-400">
          Every game that counted at {pos}, in order of start time (the lower score first when two
          start at the same time). Games 1 to {max} stay; the rest get unset.
        </p>
        <div className="relative rounded-xl overflow-auto -mx-4">
          <div className="shadow-sm my-4">
            <table className="border-collapse table-fixed w-full min-w-[64rem] text-sm">
              <thead>
                <tr>
                  <th className={`${TH} w-16`}>#</th>
                  <th className={`${TH} w-60`}>Player</th>
                  <th className={`${TH} w-64`}>Start</th>
                  <th className={`${TH} w-36`}>Game</th>
                  <th className={`${TH} w-24`}>FPts</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800">
                {games.map((game, i) => {
                  const isUnset = unsetKeys.has(`${game.playerId}-${game.date}`);
                  // Unset rows in red; TD's own text color would win over the row's.
                  const td = isUnset
                    ? "border-b border-slate-200 dark:border-slate-700 p-4 font-bold text-red-400"
                    : TD;
                  return (
                    <tr key={`${game.playerId}-${game.date}`}>
                      <td className={td}>{i + 1}</td>
                      <td className={td}>{game.player}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {game.start ? formatStart(game.start) : formatDate(game.date)}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{game.game}</td>
                      <td className={td}>{game.fpts}</td>
                      <td className={td}>{isUnset ? "Unset" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </GamesDetails>
      {tiedWith.length > 0 && (
        <p className="text-sm text-amber-500">
          Tied on start time and score with {tiedWith.map((g) => g.player).join(", ")}. Any of them
          can be the one unset.
        </p>
      )}
    </div>
  );
}
