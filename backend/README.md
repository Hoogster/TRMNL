# TRMNL Family Backend

A small Cloudflare Worker that gives your TRMNL two things it can't get on its own:

- **`/todo.json`** - a family To-Do list (FamilyWall has no task API, so this is a clean
  self-built alternative), plus **`/todo`**, a mobile-friendly page for the family to add
  and check off items.
- **`/weather.json`** - a cached local forecast for Wabern (3084) from the official
  [SRF Weather API v2](https://developer.srgssr.ch/en/apis/srf-meteoapi-v2). This needs a
  small backend because the API uses OAuth2 (not something TRMNL's polling headers can do)
  and its free tier is capped at **6 calls/day per location** - the Worker fetches on a
  cron schedule and caches, so TRMNL can poll as often as it likes without ever risking
  that cap.

Your existing FamilyWall calendar plugin is untouched - nothing here replaces it.

## 1. Prerequisites

- A free [Cloudflare account](https://dash.cloudflare.com/sign-up).
- Node.js 18+ and npm.
- A developer account + app at [developer.srgssr.ch](https://developer.srgssr.ch) with
  product **SRF Weather** enabled, giving you a `client_id` / `client_secret` (called
  "Consumer Key" / "Consumer Secret" in the app credentials page).

## 2. Install & log in

```bash
cd backend
npm install
npx wrangler login   # opens a browser to authorize wrangler against your Cloudflare account
```

## 3. Create the two KV namespaces

```bash
npx wrangler kv namespace create TODO_KV
npx wrangler kv namespace create WEATHER_KV
```

Each command prints an `id`. Paste both into `wrangler.toml` under the matching
`[[kv_namespaces]]` block (replace `REPLACE_WITH_..._ID`).

## 4. Set secrets

```bash
# Shared key that gates every endpoint (TRMNL polling headers + the /todo web UI).
openssl rand -hex 24
npx wrangler secret put TRMNL_API_KEY        # paste the generated value

npx wrangler secret put SRF_CLIENT_ID
npx wrangler secret put SRF_CLIENT_SECRET
```

## 5. Check the location, then deploy

`wrangler.toml` ships with approximate coordinates for Wabern (3084), Köniz BE. If you
want more precision, look it up on [map.geo.admin.ch](https://map.geo.admin.ch) and edit
`WEATHER_LAT` / `WEATHER_LON` under `[vars]`.

```bash
npm run deploy
```

Wrangler prints your Worker's URL, e.g. `https://trmnl-family-backend.<you>.workers.dev`.
Use that as the base URL everywhere below and in `trmnl-plugins/*/settings.yml`.

## 6. Verify it's alive

```bash
curl https://trmnl-family-backend.<you>.workers.dev/health

# Force a weather refresh (also runs automatically on the cron schedule):
curl -X POST "https://trmnl-family-backend.<you>.workers.dev/admin/weather/refresh" \
  -H "X-API-Key: <your TRMNL_API_KEY>"

curl "https://trmnl-family-backend.<you>.workers.dev/weather.json" \
  -H "X-API-Key: <your TRMNL_API_KEY>"

curl "https://trmnl-family-backend.<you>.workers.dev/todo.json" \
  -H "X-API-Key: <your TRMNL_API_KEY>"
```

Open `https://trmnl-family-backend.<you>.workers.dev/todo` on a phone, enter the API key
when prompted, and add your family's first task. Bookmark it / "Add to Home Screen" -
that's the family's To-Do app now.

## 7. About the SRF field-name mapping

`src/lib/forecastMapper.ts` and `src/lib/srfMeteo.ts` are written against the official SRF
Weather API v2 OpenAPI 3 spec (endpoint: `GET /forecastpoint/{geolocationId}`, field names
like `TTT_C`, `TX_C`, `TN_C`, `symbol_code` etc.), not guessed. If a value ever shows up
blank/"-" on the device, it's worth a sanity check against the live response:

```bash
curl "https://trmnl-family-backend.<you>.workers.dev/debug/weather-raw" \
  -H "X-API-Key: <your TRMNL_API_KEY>"
```

One thing the spec doesn't document at all: the exact meaning of each numeric
`symbol_code`. `symbolToEmoji()` in `forecastMapper.ts` uses a coarse, best-effort bucketing
by numeric range rather than an exact per-code table - tweak it there if an icon looks off
for a given code you can observe via `/debug/weather-raw`. One thing the live API *did*
reveal: the sign of `symbol_code` flags day vs. night for the same condition (`1` = sunny
day, `-1` = clear night); the mapper takes the absolute value so both render the same icon.

## Architecture notes

- **Rate-limit safety**: every SRF forecast call goes through `tryConsumeBudget()` in
  `src/weather.ts`, which caps calls per UTC day (`WEATHER_MAX_DAILY_CALLS`, default 6) in
  KV as a defensive default - the official OpenAPI spec has no rate-limit info at all, so
  this isn't a confirmed quota, just a safety net so the Worker never calls SRF unbounded
  regardless of cron timing or manual `/admin/weather/refresh` calls.
- **OAuth token caching**: `src/lib/srfMeteo.ts` caches the bearer token in KV and only
  re-requests it near expiry (SRG SSR tokens are documented as valid ~7 days).
- **Geolocation ID caching**: `/forecastpoint/{geolocationId}` only accepts one of SRF's
  pre-registered location IDs, not arbitrary "lat,lon" - `getGeolocationId()` resolves your
  configured `WEATHER_LAT`/`WEATHER_LON` to the nearest registered ID once (via a proximity
  search) and caches it in KV forever. **If you ever change the coordinates in
  `wrangler.toml`, delete the cached value first** so it re-resolves:
  `npx wrangler kv key delete --namespace-id <WEATHER_KV id> srf_geolocation_id`.
- **Stale-over-blank**: if a refresh fails, the previous good forecast keeps being served
  (flagged `stale: true`) instead of the display going blank.
- **Auth**: every route requires the shared `TRMNL_API_KEY`, sent as `X-API-Key` (TRMNL
  polling headers) or `?key=` (handy for curl/browser). The `/todo` HTML page itself loads
  without it, but every read/write it does goes through the same key, prompted once and
  cached in the browser's `localStorage`.
