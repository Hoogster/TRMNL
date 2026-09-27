import { Env, SrfForecastPointWeek } from "../types";

const TOKEN_URL = "https://api.srgssr.ch/oauth/v1/accesstoken?grant_type=client_credentials";
const FORECAST_BASE = "https://api.srgssr.ch/srf-meteo/v2";

interface CachedToken {
  access_token: string;
  expiresAt: number; // epoch ms
}

/**
 * Obtains an OAuth2 client-credentials bearer token for the SRF/SRG SSR API platform
 * and caches it in KV. SRG SSR tokens are documented as valid for ~7 days; we refresh a
 * bit early and store whatever `expires_in` the token endpoint actually reports.
 */
export async function getAccessToken(env: Env): Promise<string> {
  const cached = await env.WEATHER_KV.get("srf_token", "json") as CachedToken | null;
  const SAFETY_MARGIN_MS = 10 * 60 * 1000; // refresh 10 min before expiry
  if (cached && cached.expiresAt - SAFETY_MARGIN_MS > Date.now()) {
    return cached.access_token;
  }

  const basicAuth = btoa(`${env.SRF_CLIENT_ID}:${env.SRF_CLIENT_SECRET}`);
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (!resp.ok) {
    throw new Error(`SRF token request failed: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json<{ access_token: string; expires_in?: number | string }>();
  const expiresInSec = Number(data.expires_in ?? 60 * 60 * 24 * 6); // fall back to ~6 days if missing
  const token: CachedToken = {
    access_token: data.access_token,
    expiresAt: Date.now() + expiresInSec * 1000,
  };
  await env.WEATHER_KV.put("srf_token", JSON.stringify(token));
  return token.access_token;
}

/**
 * Resolves the configured lat/lon to one of SRF's pre-registered geolocation IDs via a
 * proximity search (GET /geolocations?latitude=..&longitude=.. - matches within 10km).
 * /forecastpoint/{geolocationId} 404s on an arbitrary "lat,lon" string; it only accepts an
 * ID that already exists in SRF's location database. Cached in KV since this never changes
 * for a fixed location.
 */
async function getGeolocationId(env: Env): Promise<string> {
  const cached = await env.WEATHER_KV.get("srf_geolocation_id");
  if (cached) return cached;

  const token = await getAccessToken(env);
  const url = `${FORECAST_BASE}/geolocations?latitude=${env.WEATHER_LAT}&longitude=${env.WEATHER_LON}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!resp.ok) {
    throw new Error(`SRF geolocation lookup failed: ${resp.status} ${await resp.text()}`);
  }
  const results = await resp.json<Array<{ id: string }>>();
  const id = results[0]?.id;
  if (!id) {
    throw new Error(`SRF geolocation lookup returned no results for ${env.WEATHER_LAT},${env.WEATHER_LON}`);
  }
  await env.WEATHER_KV.put("srf_geolocation_id", id);
  return id;
}

/**
 * Calls the SRF Weather API v2's single forecast endpoint for the configured location:
 * GET /forecastpoint/{geolocationId}. One call returns days + three_hours + hours.
 */
export async function fetchForecast(env: Env): Promise<SrfForecastPointWeek> {
  const token = await getAccessToken(env);
  const geolocationId = await getGeolocationId(env);
  const url = `${FORECAST_BASE}/forecastpoint/${geolocationId}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!resp.ok) {
    throw new Error(`SRF forecast request failed: ${resp.status} ${await resp.text()}`);
  }
  return resp.json();
}
