export interface Env {
  // KV namespaces (create with `wrangler kv namespace create ...`, see backend/README.md)
  TODO_KV: KVNamespace;
  WEATHER_KV: KVNamespace;

  // Shared secret that gates every API call (TRMNL polling headers + the todo web UI).
  // Generate one with `openssl rand -hex 24` and set via `wrangler secret put TRMNL_API_KEY`.
  TRMNL_API_KEY: string;

  // SRF / SRG SSR "SRF Weather" API v2 credentials.
  // Register an app at https://developer.srgssr.ch (product: SRF Weather) to obtain these.
  SRF_CLIENT_ID: string;
  SRF_CLIENT_SECRET: string;

  // Location for the weather forecast. Defaults below are approximate coordinates for
  // Wabern (3084), Köniz BE — verify/adjust precisely via https://map.geo.admin.ch if needed.
  WEATHER_LAT: string;
  WEATHER_LON: string;
  WEATHER_LOCATION_NAME: string;

  // Safety cap for SRF API calls/day - a defensive default, not a confirmed quota (the
  // official OpenAPI spec has no rate-limit info at all). Kept as a var (not secret) so
  // it's easy to tweak in wrangler.toml.
  WEATHER_MAX_DAILY_CALLS?: string;
}

export interface TodoItem {
  id: string;
  list: string;
  text: string;
  done: boolean;
  createdAt: string;
  doneAt?: string;
}

export interface NormalizedHour {
  time: string; // "HH:MM"
  temp_c: number | null;
  symbol: string;
  symbol_text: string;
}

export interface NormalizedDay {
  day: string; // short weekday label, e.g. "Mo"
  date: string; // ISO date
  high_c: number | null;
  low_c: number | null;
  symbol: string;
  symbol_text: string;
  precip_probability_pct: number | null;
}

export interface NormalizedWeather {
  has_data: boolean;
  stale: boolean;
  location_name: string;
  updated_at: string;
  source: string;
  error?: string;
  current?: {
    temp_c: number | null;
    feels_like_c: number | null;
    symbol: string;
    symbol_text: string;
    wind_kmh: number | null;
    humidity_pct: number | null;
  };
  today?: {
    high_c: number | null;
    low_c: number | null;
    precip_probability_pct: number | null;
    sunrise: string | null;
    sunset: string | null;
  };
  hourly?: NormalizedHour[];
  daily?: NormalizedDay[];
}

// --- Raw SRF Weather API v2 response shapes -------------------------------
// Verified against the official OpenAPI 3 spec for GET /forecastpoint/{geolocationId}.

export interface SrfHourInterval {
  date_time: string;
  symbol_code: number;
  TTT_C: number;
  TTTFEEL_C: number;
  FF_KMH: number;
  RELHUM_PERCENT: number;
  PROBPCP_PERCENT: number;
}

export interface SrfDayInterval {
  date_time: string;
  symbol_code: number;
  TX_C: number;
  TN_C: number;
  SUNRISE: string;
  SUNSET: string;
  PROBPCP_PERCENT: number;
}

export interface SrfForecastPointWeek {
  days: SrfDayInterval[];
  three_hours: SrfHourInterval[];
  hours: SrfHourInterval[];
  geolocation: { id: number; lat: number; lon: number; default_name: string };
}
