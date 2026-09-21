// Shared matchup configuration
export type MatchupType = {
  periods: string[];
  maxGamesPerPos?: { C: number; LW: number; RW: number; D: number; G: number };
};

export type MatchupsType = {
  [key: string]: MatchupType;
};

// ---------------------------------------------------------------------------
// 2026-27 season
//
// Fantrax "periods" are individual game days, numbered from 1 on the first day
// of the SBBHL season. Matchups are groups of consecutive periods.
//
//   - Period 1 is Tue Sep 29, 2026 (NHL opening night)
//   - Matchup 1 is the short opening week (Tue-Sun), then Mon-Sun weeks
//   - Matchup 19 is two weeks (Feb 1-14) merged around the All-Star break
//   - Matchups 23-25 are the playoffs; the final (25) is Mar 22-28, the third
//     last week of the NHL schedule (regular season ends Sat Apr 10, 2027)
// ---------------------------------------------------------------------------

// Season starts September 29, 2026 (period 1) - using UTC for consistency
const SEASON_START_DATE = new Date(Date.UTC(2026, 8, 29)); // Month is 0-indexed, so 8 = September

// Number of daily periods in each matchup, in order (index 0 is matchup 1)
const MATCHUP_LENGTHS: number[] = [
  6, // 1:  Sep 29 - Oct 4
  7, // 2:  Oct 5 - Oct 11
  7, // 3:  Oct 12 - Oct 18
  7, // 4:  Oct 19 - Oct 25
  7, // 5:  Oct 26 - Nov 1
  7, // 6:  Nov 2 - Nov 8
  7, // 7:  Nov 9 - Nov 15
  7, // 8:  Nov 16 - Nov 22
  7, // 9:  Nov 23 - Nov 29
  7, // 10: Nov 30 - Dec 6
  7, // 11: Dec 7 - Dec 13
  7, // 12: Dec 14 - Dec 20
  7, // 13: Dec 21 - Dec 27 (Christmas break, ~2/3 of a normal week's games)
  7, // 14: Dec 28 - Jan 3
  7, // 15: Jan 4 - Jan 10
  7, // 16: Jan 11 - Jan 17
  7, // 17: Jan 18 - Jan 24
  7, // 18: Jan 25 - Jan 31
  14, // 19: Feb 1 - Feb 14 (All-Star break, two weeks merged)
  7, // 20: Feb 15 - Feb 21
  7, // 21: Feb 22 - Feb 28
  7, // 22: Mar 1 - Mar 7
  7, // 23: Mar 8 - Mar 14 (playoffs round 1)
  7, // 24: Mar 15 - Mar 21 (playoffs round 2)
  7, // 25: Mar 22 - Mar 28 (final)
];

// Per-matchup overrides for max games per position. Fantrax's default caps are
// C: 9, LW: 9, RW: 9, D: 12, G: 5 for a normal week; add an entry here to
// prorate a week with fewer NHL games (e.g. Christmas week).
const MAX_GAMES_OVERRIDES: { [key: string]: MatchupType["maxGamesPerPos"] } = {};

const buildMatchups = (): MatchupsType => {
  const matchups: MatchupsType = {};
  let nextPeriod = 1;
  MATCHUP_LENGTHS.forEach((length, index) => {
    const id = (index + 1).toString();
    const periods = Array.from({ length }, (_, i) => (nextPeriod + i).toString());
    nextPeriod += length;
    matchups[id] = MAX_GAMES_OVERRIDES[id]
      ? { periods, maxGamesPerPos: MAX_GAMES_OVERRIDES[id] }
      : { periods };
  });
  return matchups;
};

export const MATCHUPS: MatchupsType = buildMatchups();

// Matchup ids in season order, for the week picker
export const MATCHUP_IDS: string[] = Object.keys(MATCHUPS);

// Helper function to get the actual Date object for a period (UTC)
const getPeriodDateObject = (periodNumber: number): Date => {
  const date = new Date(SEASON_START_DATE);
  date.setUTCDate(date.getUTCDate() + (periodNumber - 1)); // Subtract 1 because period 1 is the start date
  return date;
};

// Helper function to get current UTC date (works consistently on client and server)
const getCurrentUTCDate = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export const getPeriodDate = (periodNumber: number): string => {
  const date = getPeriodDateObject(periodNumber);
  
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC' // Force UTC formatting for consistency
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

// Helper function to calculate current week based on today's date
export const getCurrentWeek = (): string => {
  const todayUTC = getCurrentUTCDate();
  
  // Find which matchup week contains today's date
  for (const [weekId, matchup] of Object.entries(MATCHUPS)) {
    if (!matchup || !matchup.periods.length) continue;
    
    const firstPeriod = parseInt(matchup.periods[0]);
    const lastPeriod = parseInt(matchup.periods[matchup.periods.length - 1]);
    
    // Use the shared helper function to get date objects
    const firstDate = getPeriodDateObject(firstPeriod);
    const lastDate = getPeriodDateObject(lastPeriod);
    
    // Check if today falls within this week's date range
    if (todayUTC >= firstDate && todayUTC <= lastDate) {
      return weekId;
    }
  }
  
  // If no week is found, return the first week as fallback
  return "1";
};
