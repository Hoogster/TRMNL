import { Env, NormalizedDay, NormalizedHour, NormalizedWeather } from "../types";

/**
 * ============================================================================
 * IMPORTANT - read this before trusting the numbers on the display
 * ============================================================================
 * The official SRF Weather API v2 (developer.srgssr.ch) sits behind a developer
 * account, so this mapper was written against *public references* to the SRF/
 * MeteoSwiss data model (field names like TTT_C, TX_C, TN_C, FF_KMH, RRR_MM,
 * symbol_code, etc. are consistent across SRF's public meteo widgets), not a
 * live-tested response from the authenticated v2 API - I don't have credentials
 * to call it from here.
 *
 * `pick()` below tries several plausible key names/paths for each value, and the
 * full raw response is always kept in KV (`weather:raw`) and exposed at
 * GET /debug/weather-raw so you can compare it against the field names used here.
 * If something reads as "-" or null on the device, that's the signal to open the
 * raw payload and adjust the candidate key lists a few lines down.
 * ============================================================================
 */

function pick(obj: any, paths: string[]): any {
  for (const path of paths) {
    const value = path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toTimeHHMM(value: any): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return typeof value === "string" ? value : null;
  return d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
}

const WEEKDAY_SHORT_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/**
 * Coarse, best-effort SRF/MeteoSwiss symbol-code -> emoji mapping, bucketed by numeric
 * range rather than an exact per-code table (the exact table isn't publicly documented).
 * "a"/"b" day/night suffixes some SRF payloads use are stripped before matching.
 */
function symbolToEmoji(code: any): { emoji: string; text: string } {
  const raw = String(code ?? "").trim();
  const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(n)) return { emoji: "🌡️", text: "" };

  if (n === 1) return { emoji: "☀️", text: "Sonnig" };
  if (n >= 2 && n <= 3) return { emoji: "🌤️", text: "Sonnig bis wolkig" };
  if (n >= 4 && n <= 6) return { emoji: "☁️", text: "Bewölkt" };
  if (n === 7) return { emoji: "🌫️", text: "Nebel" };
  if (n >= 8 && n <= 9) return { emoji: "🌫️", text: "Hochnebel" };
  if (n >= 10 && n <= 14) return { emoji: "🌦️", text: "Vereinzelt Regen" };
  if (n >= 15 && n <= 19) return { emoji: "🌧️", text: "Regen" };
  if (n >= 20 && n <= 24) return { emoji: "🌨️", text: "Schneeregen" };
  if (n >= 25 && n <= 29) return { emoji: "❄️", text: "Schnee" };
  if (n >= 30 && n <= 39) return { emoji: "⛈️", text: "Gewitter" };
  return { emoji: "🌡️", text: "" };
}

function mapHour(entry: any): NormalizedHour {
  const time = toTimeHHMM(pick(entry, ["date_time", "dateTime", "time", "validTime"]));
  const temp = toNumber(pick(entry, ["TTT_C", "temperature", "temp_c", "temperature_c"]));
  const { emoji, text } = symbolToEmoji(pick(entry, ["symbol_code", "SYMBOL_CODE", "symbolCode", "icon"]));
  return { time: time ?? "-", temp_c: temp, symbol: emoji, symbol_text: text };
}

function mapDay(entry: any): NormalizedDay {
  const dateRaw = pick(entry, ["date_time", "dateTime", "date", "validDate"]);
  const d = dateRaw ? new Date(dateRaw) : null;
  const dayLabel = d && !isNaN(d.getTime()) ? WEEKDAY_SHORT_DE[d.getDay()] : "-";
  const { emoji, text } = symbolToEmoji(pick(entry, ["symbol_code", "SYMBOL_CODE", "symbolCode", "icon", "symbol24_code"]));
  return {
    day: dayLabel,
    date: d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "",
    high_c: toNumber(pick(entry, ["TX_C", "temperatureMax", "temp_max_c"])),
    low_c: toNumber(pick(entry, ["TN_C", "temperatureMin", "temp_min_c"])),
    symbol: emoji,
    symbol_text: text,
    precip_probability_pct: toNumber(pick(entry, ["PROBPCP_PERCENT", "precipProbability", "precipitation_probability"])),
  };
}

/** Finds the first array in a handful of plausible container keys, else []. */
function findArray(obj: any, paths: string[]): any[] {
  for (const path of paths) {
    const value = path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    if (Array.isArray(value)) return value;
  }
  return [];
}

export interface RawFetchResult {
  day?: any; // response of the "24hour" endpoint
  week?: any; // response of the "7day" endpoint
  error?: string;
  skipped?: string;
}

export function mapForecast(env: Env, raw: RawFetchResult): NormalizedWeather {
  const now = new Date().toISOString();

  if (raw.error) {
    return {
      has_data: false,
      stale: true,
      location_name: env.WEATHER_LOCATION_NAME,
      updated_at: now,
      source: "SRF Meteo API v2",
      error: raw.error,
    };
  }

  const dayPayload = raw.day ?? {};
  const hourlyRaw = findArray(dayPayload, ["hourly", "forecast.hourly", "hours", "forecastHourly", "data"]);
  const currentRaw =
    pick(dayPayload, ["current", "now", "forecast.current"]) ?? hourlyRaw[0] ?? null;

  const weekPayload = raw.week ?? {};
  const dailyRaw = findArray(weekPayload, ["daily", "forecast.daily", "days", "forecastDaily", "data"]);

  const current = currentRaw
    ? {
        temp_c: toNumber(pick(currentRaw, ["TTT_C", "temperature", "temp_c"])),
        feels_like_c: toNumber(pick(currentRaw, ["FEELS_LIKE_C", "apparentTemperature", "feels_like_c"])),
        symbol: symbolToEmoji(pick(currentRaw, ["symbol_code", "SYMBOL_CODE", "icon"])).emoji,
        symbol_text: symbolToEmoji(pick(currentRaw, ["symbol_code", "SYMBOL_CODE", "icon"])).text,
        wind_kmh: toNumber(pick(currentRaw, ["FF_KMH", "windSpeed", "wind_kmh"])),
        humidity_pct: toNumber(pick(currentRaw, ["RELHUM_PERCENT", "humidity", "humidity_pct"])),
      }
    : undefined;

  const todaySummary = dailyRaw[0] ?? dayPayload;
  const today = {
    high_c: toNumber(pick(todaySummary, ["TX_C", "temperatureMax", "temp_max_c"])),
    low_c: toNumber(pick(todaySummary, ["TN_C", "temperatureMin", "temp_min_c"])),
    precip_probability_pct: toNumber(pick(todaySummary, ["PROBPCP_PERCENT", "precipProbability"])),
    sunrise: toTimeHHMM(pick(dayPayload, ["SUNRISE", "sunrise", "location.sunrise"])),
    sunset: toTimeHHMM(pick(dayPayload, ["SUNSET", "sunset", "location.sunset"])),
  };

  const hourly = hourlyRaw.slice(0, 6).map(mapHour);
  const daily = dailyRaw.slice(0, 5).map(mapDay);

  const hasAnyData = Boolean(current || hourly.length || daily.length);

  return {
    has_data: hasAnyData,
    stale: !hasAnyData,
    location_name: env.WEATHER_LOCATION_NAME,
    updated_at: now,
    source: "SRF Meteo API v2",
    current,
    today,
    hourly,
    daily,
  };
}
