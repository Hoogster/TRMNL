import { Env } from "../types";

const TOKEN_URL = "https://api.srgssr.ch/oauth/v1/accesstoken?grant_type=client_credentials";
const FORECAST_BASE = "https://api.srgssr.ch/forecasts/v1.0/weather";

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

export type ForecastEndpoint = "current" | "nexthour" | "24hour" | "7day";

/**
 * Calls one SRF Weather API v2 forecast endpoint for the configured location and returns
 * the raw parsed JSON, untouched. See forecastMapper.ts for turning this into the stable
 * shape the Liquid templates consume - the exact field names below are best-effort
 * (reconstructed from public references, not a live-tested response) and may need small
 * adjustments once you have real credentials; see backend/README.md.
 */
export async function fetchForecast(env: Env, endpoint: ForecastEndpoint): Promise<any> {
  const token = await getAccessToken(env);
  const url = `${FORECAST_BASE}/${endpoint}?latitude=${encodeURIComponent(env.WEATHER_LAT)}&longitude=${encodeURIComponent(env.WEATHER_LON)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!resp.ok) {
    throw new Error(`SRF forecast request failed (${endpoint}): ${resp.status} ${await resp.text()}`);
  }
  return resp.json();
}
