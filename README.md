# Fabian's TRMNL

Setup for a TRMNL OG (2-bit) e-ink dashboard with three plugins:

| Plugin | Status | Data source |
|---|---|---|
| 📅 Familienkalender | bereits umgesetzt (unverändert) | FamilyWall iCal-Feed |
| ✅ Familien To-Do | neu, hier gebaut | eigenes kleines Backend (FamilyWall hat keine Task-API) |
| 🌤️ Wetter Wabern | neu, hier gebaut | [SRF Weather API v2](https://developer.srgssr.ch/en/apis/srf-meteoapi-v2) |

## Layout

```
backend/            Cloudflare Worker: To-Do API + web UI, SRF weather OAuth + cache
trmnl-plugins/
  calendar/          reference notes only - existing setup, not touched
  todo/              TRMNL private-plugin settings + Liquid templates
  weather/           TRMNL private-plugin settings + Liquid templates
```

## Why a backend at all?

TRMNL private plugins can poll any URL and render the JSON with a Liquid template, but
two things here don't fit into "poll a URL with static headers":

- **FamilyWall has no task/to-do API** - only the calendar iCal export your existing
  plugin already uses. So the To-Do list is a small self-built alternative instead.
- **The SRF Weather API v2 needs OAuth2** (client-credentials token exchange) - TRMNL's
  polling can't do a token exchange, so polling the raw API directly isn't an option
  regardless of any rate limit.

Both are solved by one small Cloudflare Worker (free tier) in `backend/`: it caches the
weather forecast (refreshed hourly by cron) and stores the To-Do list in Cloudflare KV,
exposing plain JSON that TRMNL polls normally.

## Setup order

1. **`backend/README.md`** - deploy the Worker (Cloudflare account, `wrangler deploy`,
   KV namespaces, secrets: your generated `TRMNL_API_KEY` + SRF `client_id`/`client_secret`
   from developer.srgssr.ch).
2. **`trmnl-plugins/weather/README.md`** - add the private plugin in the TRMNL dashboard.
3. **`trmnl-plugins/todo/README.md`** - same, plus bookmark `/todo` on family phones to
   actually manage the list.
4. Calendar needs nothing - it's already running.

## Known limitations / things to double check

- **Weather field mapping** in `backend/src/lib/forecastMapper.ts` is verified against the
  official SRF Weather API v2 OpenAPI spec - see `backend/README.md` → "About the SRF
  field-name mapping" for the one thing the spec doesn't document (exact `symbol_code`
  meanings).
- **Coordinates for Wabern are approximate** (`wrangler.toml`) - refine via
  [map.geo.admin.ch](https://map.geo.admin.ch) if you want.
- **Daily call cap is a defensive default, not a confirmed quota**: the official spec has
  no rate-limit info at all. The Worker refreshes hourly (24 calls/day) and still caps
  itself in code (`tryConsumeBudget` in `backend/src/weather.ts`, default 30/day) as a
  safety net - it'll silently skip a fetch and keep serving the last known-good forecast
  instead of ever calling unbounded.
- Your device (TRMNL OG, 2-bit / grayscale, firmware 1.8.12) renders through TRMNL's
  standard framework, so the Liquid templates here don't do anything display-specific -
  TRMNL handles dithering for the panel's bit depth.
