import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findOverages,
  parseRosterDay,
  scheduleStarts,
  withStart,
  type Caps,
  type PlayerGame,
} from "./overages.ts";

const CAPS: Caps = { C: 9, LW: 9, RW: 9, D: 12, G: 5 };

// A game at `time` Eastern (EDT, UTC-4) on `date`.
const game = (
  player: string,
  pos: PlayerGame["pos"],
  date: string,
  time: string | null,
  fpts = 0,
): PlayerGame => ({
  playerId: player,
  player,
  pos,
  date,
  game: "AAA @ BBB",
  teams: ["AAA", "BBB"],
  start: time ? new Date(`${date}T${time}:00-04:00`).toISOString() : null,
  fpts,
});

// `count` games for filler players on `date` at 7pm, to build up GP.
const filler = (pos: PlayerGame["pos"], date: string, count: number) =>
  Array.from({ length: count }, (_, i) => game(`${pos} filler ${date} ${i}`, pos, date, "19:00"));

const unsetNames = (games: PlayerGame[], caps = CAPS) =>
  findOverages(games, caps).map((o) => [o.pos, o.unset.map((u) => u.player)]);

test("no overage at or under the cap", () => {
  assert.deepEqual(findOverages([...filler("D", "2026-10-05", 12), ...filler("G", "2026-10-05", 4)], CAPS), []);
});

test("one over: unsets the latest start of the week", () => {
  const games = [
    ...filler("G", "2026-10-06", 4),
    game("Early", "G", "2026-10-10", "13:00", 1),
    game("Late", "G", "2026-10-10", "22:00", 1),
  ];
  const [overage] = findOverages(games, CAPS);
  assert.equal(overage.pos, "G");
  assert.equal(overage.gp, 6);
  assert.equal(overage.max, 5);
  assert.deepEqual(overage.unset.map((u) => u.player), ["Late"]);
  assert.equal(overage.unset[0].scoredZero, false);
  assert.deepEqual(overage.tiedWith, []);
});

test("later date beats an earlier date's later time", () => {
  const games = [
    ...filler("C", "2026-10-05", 7),
    game("Fri late", "C", "2026-10-09", "22:30"),
    game("Sat early", "C", "2026-10-10", "12:30"),
    game("Sat later", "C", "2026-10-10", "15:00"),
  ];
  assert.deepEqual(unsetNames(games), [["C", ["Sat later"]]]);
});

test("several over at one position unsets that many, latest first", () => {
  const games = [
    ...filler("RW", "2026-10-05", 7),
    game("1pm", "RW", "2026-10-10", "13:00"),
    game("7pm", "RW", "2026-10-10", "19:00"),
    game("10pm", "RW", "2026-10-10", "22:00"),
    game("4pm", "RW", "2026-10-10", "16:00"),
  ];
  assert.deepEqual(unsetNames(games), [["RW", ["10pm", "7pm"]]]);
});

test("overages at several positions are each handled on their own", () => {
  const games = [
    ...filler("C", "2026-10-05", 9),
    ...filler("LW", "2026-10-05", 8),
    game("LW early", "LW", "2026-10-11", "13:00"),
    game("LW late", "LW", "2026-10-11", "19:00"),
    ...filler("D", "2026-10-05", 10),
    game("D a", "D", "2026-10-11", "13:00"),
    game("D b", "D", "2026-10-11", "17:00"),
    game("D c", "D", "2026-10-11", "20:00"),
    game("D d", "D", "2026-10-11", "21:00"),
    ...filler("G", "2026-10-05", 4),
    game("G a", "G", "2026-10-11", "15:00"),
    game("G b", "G", "2026-10-11", "19:30"),
  ];
  assert.deepEqual(unsetNames(games), [
    ["LW", ["LW late"]],
    ["D", ["D d", "D c"]],
    ["G", ["G b"]],
  ]);
});

test("same start time: unsets the higher score", () => {
  const games = [
    ...filler("G", "2026-10-06", 4),
    game("Low", "G", "2026-10-10", "19:00", 2),
    game("High", "G", "2026-10-10", "19:00", 9.75),
  ];
  const [overage] = findOverages(games, CAPS);
  assert.deepEqual(overage.unset.map((u) => u.player), ["High"]);
  assert.deepEqual(overage.tiedWith, []);
});

test("same start time breaks ties by score, including negative scores", () => {
  const games = [
    ...filler("G", "2026-10-06", 4),
    game("Minus", "G", "2026-10-10", "19:00", -0.5),
    game("Zero", "G", "2026-10-10", "19:00", 0),
  ];
  assert.deepEqual(unsetNames(games), [["G", ["Zero"]]]);
});

test("start time decides before score does", () => {
  const games = [
    ...filler("D", "2026-10-05", 11),
    game("Early big night", "D", "2026-10-10", "13:00", 12),
    game("Late quiet night", "D", "2026-10-10", "22:00", 0.5),
  ];
  assert.deepEqual(unsetNames(games), [["D", ["Late quiet night"]]]);
});

test("several over with a same-time group split by score", () => {
  const games = [
    ...filler("D", "2026-10-05", 10),
    game("1pm", "D", "2026-10-11", "13:00", 20),
    game("7pm 1", "D", "2026-10-11", "19:00", 1),
    game("7pm 4", "D", "2026-10-11", "19:00", 4),
    game("7pm 2", "D", "2026-10-11", "19:00", 2),
    game("10pm", "D", "2026-10-11", "22:00", 0),
  ];
  // 15 GP, 3 over: the 10pm game, then the two best of the three 7pm games.
  assert.deepEqual(unsetNames(games), [["D", ["10pm", "7pm 4", "7pm 2"]]]);
});

test("same start and same score is flagged as a tie", () => {
  const games = [
    ...filler("RW", "2026-10-05", 8),
    game("A", "RW", "2026-10-10", "19:00", 3),
    game("B", "RW", "2026-10-10", "19:00", 3),
    game("C", "RW", "2026-10-10", "19:00", 1),
  ];
  const [overage] = findOverages(games, CAPS);
  assert.equal(overage.unset.length, 2);
  assert.deepEqual(overage.unset.map((u) => u.player), ["A", "B"]);
  assert.deepEqual(overage.tiedWith, []);

  const [oneOver] = findOverages(games.filter((g) => g.player !== "C"), CAPS);
  assert.deepEqual(oneOver.unset.map((u) => u.player), ["A"]);
  assert.deepEqual(oneOver.tiedWith.map((g) => g.player), ["B"]);
});

test("a missing start time falls back to score within the day", () => {
  const games = [
    ...filler("G", "2026-10-06", 4),
    game("Unknown", "G", "2026-10-10", null, 1),
    game("Known", "G", "2026-10-10", "22:00", 5),
  ];
  assert.deepEqual(unsetNames(games), [["G", ["Known"]]]);
});

test("games after the max was met are unset first and marked as already scoring 0", () => {
  // Real week 2 (2026-27): RW reached 9 on Saturday, then two more RW played Sunday.
  const games = [
    ...filler("RW", "2026-10-05", 8),
    game("Michkov", "RW", "2026-10-10", "19:00", 1),
    game("Leonard", "RW", "2026-10-11", "17:00", 3.25),
    game("Perreault", "RW", "2026-10-11", "19:00", 6.5),
  ];
  const [overage] = findOverages(games, CAPS);
  assert.equal(overage.gp, 11);
  assert.deepEqual(
    overage.unset.map((u) => [u.player, u.scoredZero]),
    [
      ["Perreault", true],
      ["Leonard", true],
    ],
  );
});

test("crossing the max then playing more unsets both the zero games and the real excess", () => {
  const games = [
    ...filler("G", "2026-10-05", 4),
    game("Sat 1pm", "G", "2026-10-10", "13:00", 3),
    game("Sat 7pm", "G", "2026-10-10", "19:00", 6),
    game("Sun", "G", "2026-10-11", "17:00", 4),
  ];
  const [overage] = findOverages(games, CAPS);
  assert.deepEqual(
    overage.unset.map((u) => [u.player, u.scoredZero]),
    [
      ["Sun", true],
      ["Sat 7pm", false],
    ],
  );
});

test("a league cap below Fantrax's unsets to the league cap", () => {
  const leagueCaps = { ...CAPS, D: 10 };
  const games = [
    ...filler("D", "2026-10-05", 10),
    game("Sat", "D", "2026-10-10", "19:00"),
    game("Sun", "D", "2026-10-11", "19:00"),
  ];
  const [overage] = findOverages(games, leagueCaps, CAPS);
  assert.equal(overage.max, 10);
  // Fantrax's max of 12 wasn't met, so both still scored.
  assert.deepEqual(
    overage.unset.map((u) => [u.player, u.scoredZero]),
    [
      ["Sun", false],
      ["Sat", false],
    ],
  );
});

test("real week 2: Kuemper's late game is the extra goalie start", () => {
  const starts = scheduleStarts([
    {
      date: "2026-10-10",
      games: [
        { startTimeUTC: "2026-10-10T23:00:00Z", awayTeam: { abbrev: "UTA" }, homeTeam: { abbrev: "BUF" } },
        { startTimeUTC: "2026-10-11T02:00:00Z", awayTeam: { abbrev: "LAK" }, homeTeam: { abbrev: "VGK" } },
      ],
    },
  ]);
  const saturday = [
    { ...game("Vejmelka", "G", "2026-10-10", null, 9.75), game: "UTA @ BUF", teams: ["UTA", "BUF"] },
    { ...game("Kuemper", "G", "2026-10-10", null, 5.5), game: "LAK @ VGK", teams: ["LAK", "VGK"] },
  ].map((g) => withStart(g, starts));
  const [overage] = findOverages([...filler("G", "2026-10-06", 4), ...saturday], CAPS);
  assert.deepEqual(overage.unset.map((u) => u.player), ["Kuemper"]);
});

test("parseRosterDay keeps active players who played, at their lineup slot", () => {
  const header = { cells: [{ shortName: "Age" }, { shortName: "Opp" }, { shortName: "FPts" }, { shortName: "GP" }] };
  const row = (id: string, statusId: string, posId: string, opp: string, fpts: string, gp: string) => ({
    statusId,
    posId,
    scorer: { scorerId: id, name: `Player ${id}` },
    cells: [{ content: "30" }, { content: opp }, { content: fpts }, { content: gp }],
  });
  const games = parseRosterDay(
    [
      {
        header,
        rows: [
          row("played", "1", "204", "PHI 1<br/>@TBL 4 F", "4.25", "1"),
          row("bench", "2", "204", "PHI 1<br/>@TBL 4 F", "3", "1"),
          row("scratched", "1", "202", "VAN 2<br/>@NYR 6 F", "0", "0"),
          row("no game", "1", "206", "", "", ""),
          row("upcoming", "1", "206", "@TBL<br/>Sat 7:00PM", "", ""),
          { statusId: "1", posId: "202", cells: [] }, // empty slot
        ],
      },
      { header, rows: [row("goalie", "1", "201", "UTA 4<br/>@BUF 1 F", "-0.5", "1")] },
    ],
    "2026-10-10",
  );
  assert.deepEqual(
    games.map((g) => [g.playerId, g.pos, g.game, g.teams, g.fpts, g.date]),
    [
      ["played", "RW", "PHI @ TBL", ["PHI", "TBL"], 4.25, "2026-10-10"],
      ["goalie", "G", "UTA @ BUF", ["UTA", "BUF"], -0.5, "2026-10-10"],
    ],
  );
});

test("withStart matches either team on the game date", () => {
  const starts = scheduleStarts([
    {
      date: "2026-10-05",
      games: [{ startTimeUTC: "2026-10-05T23:00:00Z", awayTeam: { abbrev: "PHI" }, homeTeam: { abbrev: "TBL" } }],
    },
  ]);
  const base = game("x", "C", "2026-10-05", null);
  assert.equal(withStart({ ...base, teams: ["TBL"] }, starts).start, "2026-10-05T23:00:00Z");
  assert.equal(withStart({ ...base, teams: ["PHI", "TBL"] }, starts).start, "2026-10-05T23:00:00Z");
  assert.equal(withStart({ ...base, date: "2026-10-06", teams: ["PHI"] }, starts).start, null);
});
