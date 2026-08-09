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
- **The SRF Weather API v2 needs OAuth2** (client-credentials token exchange) and its free
  tier is capped at **6 calls/day per location** - TRMNL's polling can't do a token
  exchange, and polling the raw API directly at TRMNL's usual refresh rates would blow
  through that cap almost immediately.

Both are solved by one small Cloudflare Worker (free tier) in `backend/`: it caches the
weather forecast (refreshed on a cron schedule that respects the daily cap) and stores the
To-Do list in Cloudflare KV, exposing plain JSON that TRMNL polls normally.

## Setup order

1. **`backend/README.md`** - deploy the Worker (Cloudflare account, `wrangler deploy`,
   KV namespaces, secrets: your generated `TRMNL_API_KEY` + SRF `client_id`/`client_secret`
   from developer.srgssr.ch).
2. **`trmnl-plugins/weather/README.md`** - add the private plugin in the TRMNL dashboard.
3. **`trmnl-plugins/todo/README.md`** - same, plus bookmark `/todo` on family phones to
   actually manage the list.
4. Calendar needs nothing - it's already running.

## Known limitations / things to double check

- **Weather field mapping is best-effort.** I don't have SRF developer credentials to
  test the authenticated v2 API's real response shape, so `forecastMapper.ts` is written
  defensively against public references to SRF's data model. See
  `backend/README.md` → "About the SRF field-name mapping" for the 2-minute check to run
  once you have real data flowing.
- **Coordinates for Wabern are approximate** (`wrangler.toml`) - refine via
  [map.geo.admin.ch](https://map.geo.admin.ch) if you want.
- **6 calls/day cap**: the Worker enforces this in code (`tryConsumeBudget` in
  `backend/src/weather.ts`), so it's safe even if you change the cron schedule later -
  it'll just silently skip a fetch and keep serving the last known-good forecast instead
  of erroring or overshooting the quota.
- Your device (TRMNL OG, 2-bit / grayscale, firmware 1.8.12) renders through TRMNL's
  standard framework, so the Liquid templates here don't do anything display-specific -
  TRMNL handles dithering for the panel's bit depth.
