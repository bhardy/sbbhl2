// Shape of one SBBHL season, shared by the frozen snapshot (app/data/history.json)
// and the live season pulled from Fantrax. Teams are referenced by the name they
// had that season; app/constants/franchises.ts maps names to franchises/managers.

export type PlayoffRound = "QF" | "SF" | "F";

export type Game = {
  week: number;
  // Only set for main-bracket playoff games; consolation games are never stored.
  round?: PlayoffRound;
  a: string;
  aPts: number;
  b: string;
  bPts: number;
};

export type Season = {
  // First calendar year of the season, e.g. 2017 for 2017-18.
  year: number;
  platform: "yahoo" | "fantrax";
  leagueId: string;
  // Final regular season standings, best to worst.
  standings: string[];
  // Every team in the main playoff bracket, including first-round byes.
  playoffTeams: string[];
  champion: string | null;
  runnerUp: string | null;
  games: Game[];
  inProgress?: boolean;
  note?: string;
};

export const seasonLabel = (year: number) =>
  `${year}-${String(year + 1).slice(2)}`;
