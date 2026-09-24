// Every SBBHL franchise, the names it has played under, and who managed it.
// Season history (app/data/history.json and the live Fantrax season) only knows
// the team name used that season, so a rename needs a new entry in `names`.
// A change of hands needs a new entry in `managers` starting that season.

export type Franchise = {
  id: string;
  names: string[];
  // Sorted by `from` (first season year, e.g. 2016 for 2016-17).
  managers: { from: number; manager: string }[];
};

export const FRANCHISES: Franchise[] = [
  {
    id: "thrashers",
    names: ["Brantlanta Thrashers"],
    managers: [{ from: 2013, manager: "Brant" }],
  },
  {
    id: "pluss-pals",
    names: ["Plüss' Pals"],
    managers: [{ from: 2013, manager: "Chaad" }],
  },
  {
    id: "bedtime-players",
    names: ["MackysBedtimePlayers", "Bedtime Players"],
    managers: [{ from: 2013, manager: "Mack" }],
  },
  {
    id: "internets",
    names: ["The InterNets", "InterNets"],
    managers: [{ from: 2013, manager: "Matt" }],
  },
  {
    id: "timbersnakes",
    names: ["Statutory Grapes", "StatutOrry Grapes", "STATUTOrrY GRAPES", "Timbersnakes"],
    managers: [{ from: 2013, manager: "Nolan" }],
  },
  {
    id: "scottsmen",
    names: ["Diana Krall-Stars", "The Scottsmen", "Scottsmen"],
    managers: [{ from: 2013, manager: "Scarter" }],
  },
  {
    id: "hart-foundation",
    names: ["Oduya Halak Boyes", "The Hart Foundation", "Hart Foundation"],
    managers: [{ from: 2013, manager: "Andrew" }],
  },
  {
    id: "crooks",
    names: ["Puck Dynasty", "Backes to the Future", "Bytown Crooks", "Crooks"],
    managers: [{ from: 2013, manager: "Earl" }],
  },
  {
    id: "ranford-and-sons",
    names: ["Hotel Seattle", "Ranford & Sons"],
    managers: [
      { from: 2013, manager: "Hodge" },
      { from: 2022, manager: "Kevin" },
    ],
  },
  {
    id: "ferengi",
    names: ["Clam Slammers", "Nolan Bumgardeners", "West End Ray-kins", "Raykins", "Ferengi Kapital Gainz"],
    managers: [
      { from: 2013, manager: "Sollows" },
      { from: 2024, manager: "Johnny" },
    ],
  },
  {
    id: "lotto-losers",
    names: ["Cost-hanzals", "Dessert Dogs", "The Puccbois", "Puccbois", "Lotto Losers"],
    managers: [
      { from: 2013, manager: "Derrick" },
      { from: 2020, manager: "Stefan" },
    ],
  },
  {
    id: "valley-vultures",
    names: ["WineEmDineEm69Em", "Wu-Tanguay Clan", "Valley Vultures"],
    managers: [
      { from: 2013, manager: "Jay" },
      { from: 2014, manager: "Austin" },
    ],
  },
  // 2016-17 expansion teams.
  {
    id: "big-shiny-goons",
    names: ["Big Shiny Goons"],
    managers: [{ from: 2016, manager: "Filly" }],
  },
  {
    id: "saint-john-c-dogs",
    names: ["The Communist Youth", "Saint John C Dogs"],
    managers: [{ from: 2016, manager: "John" }],
  },
];

const BY_NAME = new Map(FRANCHISES.flatMap((f) => f.names.map((n) => [n, f] as const)));

// Unknown names (e.g. a rename this season that hasn't been added above) become
// their own one-off franchise rather than breaking the page.
export function franchiseFor(teamName: string): Franchise {
  return (
    BY_NAME.get(teamName) ?? {
      id: `unknown:${teamName}`,
      names: [teamName],
      managers: [{ from: 0, manager: `? (${teamName})` }],
    }
  );
}

export function managerFor(franchise: Franchise, year: number): string {
  return franchise.managers.filter((m) => m.from <= year).at(-1)?.manager ?? "?";
}
