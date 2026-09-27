import { Recipe, RECIPES, Season, SEASON_LABEL_DE } from "./recipes";

const WEEKDAY_SHORT_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export function seasonForMonth(monthIndex0: number): Season {
  // monthIndex0: 0 = January ... 11 = December
  if (monthIndex0 >= 2 && monthIndex0 <= 4) return "spring"; // Mar-May
  if (monthIndex0 >= 5 && monthIndex0 <= 7) return "summer"; // Jun-Aug
  if (monthIndex0 >= 8 && monthIndex0 <= 10) return "autumn"; // Sep-Nov
  return "winter"; // Dec-Feb
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((now - start) / 86_400_000);
}

/** Deterministic pick so the same day always shows the same recipe, varying by year. */
function pickForDate(date: Date, pool: Recipe[]): Recipe {
  const idx = (dayOfYear(date) + date.getUTCFullYear()) % pool.length;
  return pool[idx];
}

export interface SeasonalMenu {
  season_label: string;
  today: Recipe;
  upcoming: { day_label: string; name: string }[];
}

export function getSeasonalMenu(now: Date = new Date()): SeasonalMenu {
  const season = seasonForMonth(now.getUTCMonth());
  const pool = RECIPES[season];

  const upcoming = [1, 2].map((offset) => {
    const d = new Date(now.getTime() + offset * 86_400_000);
    return { day_label: WEEKDAY_SHORT_DE[d.getUTCDay()], name: pickForDate(d, RECIPES[seasonForMonth(d.getUTCMonth())]).name };
  });

  return {
    season_label: SEASON_LABEL_DE[season],
    today: pickForDate(now, pool),
    upcoming,
  };
}
