import { Env } from "./types";
import { json, isAuthorized, unauthorized } from "./lib/http";
import { fetchForecast } from "./lib/srfMeteo";
import { mapForecast, RawFetchResult } from "./lib/forecastMapper";

const LATEST_KEY = "weather:latest";
const RAW_KEY = "weather:raw";

/**
 * Caps SRF Weather API calls per UTC calendar day as a defensive default - the official
 * OpenAPI spec has no rate-limit info at all, so this isn't a confirmed quota, just a
 * safety net that refuses the call once spent, regardless of how often refreshWeather()
 * gets invoked (cron misfires, manual /admin/weather/refresh calls, etc).
 */
async function tryConsumeBudget(env: Env): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `weather:budget:${day}`;
  const max = Number(env.WEATHER_MAX_DAILY_CALLS ?? 6);
  const current = Number((await env.WEATHER_KV.get(key)) ?? "0");
  if (current >= max) return false;
  await env.WEATHER_KV.put(key, String(current + 1), { expirationTtl: 60 * 60 * 24 * 2 });
  return true;
}

/** Refreshes the cached forecast with a single SRF API call (one call returns everything). */
export async function refreshWeather(env: Env): Promise<void> {
  const result: RawFetchResult = {};

  if (await tryConsumeBudget(env)) {
    try {
      result.data = await fetchForecast(env);
    } catch (e) {
      result.error = String(e instanceof Error ? e.message : e);
    }
  } else {
    result.skipped = "daily_budget_exceeded";
  }

  await env.WEATHER_KV.put(RAW_KEY, JSON.stringify(result));

  const normalized = mapForecast(env, result);

  // If this refresh failed but we still have a previous good reading, keep serving that
  // (marked stale) rather than blanking the display out.
  if (!normalized.has_data) {
    const previous = await env.WEATHER_KV.get(LATEST_KEY, "json");
    if (previous) {
      await env.WEATHER_KV.put(LATEST_KEY, JSON.stringify({ ...previous, stale: true }));
      return;
    }
  }

  await env.WEATHER_KV.put(LATEST_KEY, JSON.stringify(normalized));
}

export async function handleWeatherRequest(request: Request, env: Env, url: URL): Promise<Response | null> {
  const { pathname } = url;

  // GET /weather.json - the TRMNL polling endpoint
  if (pathname === "/weather.json" && request.method === "GET") {
    if (!isAuthorized(request, env.TRMNL_API_KEY)) return unauthorized();
    const cached = await env.WEATHER_KV.get(LATEST_KEY, "json");
    if (!cached) {
      return json({
        has_data: false,
        stale: true,
        location_name: env.WEATHER_LOCATION_NAME,
        error: "no_data_yet - wait for the next cron refresh or call /admin/weather/refresh",
      });
    }
    return json(cached);
  }

  // GET /debug/weather-raw - inspect the untouched SRF API response (see forecastMapper.ts)
  if (pathname === "/debug/weather-raw" && request.method === "GET") {
    if (!isAuthorized(request, env.TRMNL_API_KEY)) return unauthorized();
    const raw = await env.WEATHER_KV.get(RAW_KEY, "json");
    return json(raw ?? { note: "no raw response cached yet" });
  }

  // POST /admin/weather/refresh - force an immediate refresh (still budget-gated)
  if (pathname === "/admin/weather/refresh" && request.method === "POST") {
    if (!isAuthorized(request, env.TRMNL_API_KEY)) return unauthorized();
    await refreshWeather(env);
    const cached = await env.WEATHER_KV.get(LATEST_KEY, "json");
    return json({ refreshed: true, latest: cached });
  }

  return null; // not a weather route
}
