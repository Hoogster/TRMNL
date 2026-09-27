import { Env, NormalizedDay, NormalizedHour, NormalizedWeather, SrfDayInterval, SrfForecastPointWeek, SrfHourInterval } from "../types";

/**
 * Maps the SRF Weather API v2's `ForecastPointWeek` response (one call to
 * GET /forecastpoint/{geolocationId}, verified against the official OpenAPI spec) into the
 * stable shape the Liquid templates render. The full raw response is always kept in KV
 * (`weather:raw`) and exposed at GET /debug/weather-raw for spot-checking after deploy.
 */

function toTimeHHMM(value: string): string | null {
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
}

const WEEKDAY_SHORT_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/**
 * Coarse, best-effort symbol_code -> emoji mapping, bucketed by numeric range: the OpenAPI
 * spec types symbol_code as a plain int32 with no enum/table of what each code means.
 * Observed live: the sign flags day/night for the same condition (1 = sunny day, -1 = clear
 * night, 10/-10 = same condition day/night, etc.) - take the absolute value for bucketing.
 */
function symbolToEmoji(code: number): { emoji: string; text: string } {
  const n = Math.abs(code);
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

/** Index of the last hourly entry at or before `now` - i.e. the current hour, not day-start. */
function findCurrentHourIndex(hours: SrfHourInterval[], now: number): number {
  let idx = 0;
  for (let i = 0; i < hours.length; i++) {
    if (new Date(hours[i].date_time).getTime() <= now) idx = i;
    else break;
  }
  return idx;
}

function mapHour(entry: SrfHourInterval): NormalizedHour {
  const { emoji, text } = symbolToEmoji(entry.symbol_code);
  return { time: toTimeHHMM(entry.date_time) ?? "-", temp_c: entry.TTT_C, symbol: emoji, symbol_text: text };
}

function mapDay(entry: SrfDayInterval): NormalizedDay {
  const d = new Date(entry.date_time);
  const { emoji, text } = symbolToEmoji(entry.symbol_code);
  return {
    day: !isNaN(d.getTime()) ? WEEKDAY_SHORT_DE[d.getDay()] : "-",
    date: !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "",
    high_c: entry.TX_C,
    low_c: entry.TN_C,
    symbol: emoji,
    symbol_text: text,
    precip_probability_pct: entry.PROBPCP_PERCENT,
  };
}

export interface RawFetchResult {
  data?: SrfForecastPointWeek;
  error?: string;
  skipped?: string;
}

export function mapForecast(env: Env, raw: RawFetchResult): NormalizedWeather {
  const nowIso = new Date().toISOString();

  if (raw.error || !raw.data) {
    return {
      has_data: false,
      stale: true,
      location_name: env.WEATHER_LOCATION_NAME,
      updated_at: nowIso,
      updated_at_local: toTimeHHMM(nowIso) ?? "-",
      source: "SRF Meteo API v2",
      error: raw.error ?? raw.skipped,
    };
  }

  const { days, hours } = raw.data;
  const currentIdx = findCurrentHourIndex(hours, Date.now());
  const currentHour = hours[currentIdx];
  const today = days[0];

  return {
    has_data: true,
    stale: false,
    location_name: env.WEATHER_LOCATION_NAME,
    updated_at: nowIso,
    updated_at_local: toTimeHHMM(nowIso) ?? "-",
    source: "SRF Meteo API v2",
    current: currentHour
      ? {
          temp_c: currentHour.TTT_C,
          feels_like_c: currentHour.TTTFEEL_C,
          symbol: symbolToEmoji(currentHour.symbol_code).emoji,
          symbol_text: symbolToEmoji(currentHour.symbol_code).text,
          wind_kmh: currentHour.FF_KMH,
          humidity_pct: currentHour.RELHUM_PERCENT,
        }
      : undefined,
    today: today
      ? {
          high_c: today.TX_C,
          low_c: today.TN_C,
          precip_probability_pct: today.PROBPCP_PERCENT,
          sunrise: toTimeHHMM(today.SUNRISE),
          sunset: toTimeHHMM(today.SUNSET),
        }
      : undefined,
    hourly: hours.slice(currentIdx, currentIdx + 6).map(mapHour),
    daily: days.slice(0, 5).map(mapDay),
  };
}
