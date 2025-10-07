// Shared matchup configuration
export type MatchupType = {
  periods: string[];
};

export type MatchupsType = {
  [key: string]: MatchupType;
};

export const MATCHUPS: MatchupsType = {
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

// Generate period dates programmatically
// Season starts October 7, 2025 (period 1)
const SEASON_START_DATE = new Date(2025, 9, 7); // Month is 0-indexed, so 9 = October

export const getPeriodDate = (periodNumber: number): string => {
  const date = new Date(SEASON_START_DATE);
  date.setDate(date.getDate() + (periodNumber - 1)); // Subtract 1 because period 1 is the start date
  
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  };
  
  return date.toLocaleDateString('en-US', options);
};

// Helper function to get date range for a matchup
export const getMatchupDateRange = (matchupId: string): string => {
  const matchup = MATCHUPS[matchupId];
  if (!matchup || !matchup.periods.length) return matchupId;
  
  const firstPeriod = parseInt(matchup.periods[0]);
  const lastPeriod = parseInt(matchup.periods[matchup.periods.length - 1]);
  
  const firstDate = getPeriodDate(firstPeriod);
  const lastDate = getPeriodDate(lastPeriod);
  
  // Extract just the month and day from the dates
  const firstMonthDay = firstDate.split(' ').slice(1).join(' ');
  const lastMonthDay = lastDate.split(' ').slice(1).join(' ');
  
  return `${matchupId} (${firstMonthDay} - ${lastMonthDay})`;
};
