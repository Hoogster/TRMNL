# TRMNL Private Plugin - Wetter Wabern

Deploy `backend/` first (see `backend/README.md`) - you need its URL and your
`TRMNL_API_KEY` before setting this up.

## Setup in the TRMNL dashboard

1. Go to **Plugins → Private Plugin → Add New**.
2. **Strategy**: Polling
3. **Polling URL**: `https://trmnl-family-backend.<your-subdomain>.workers.dev/weather.json`
4. **Polling verb**: GET
5. **Polling headers**: add `X-API-Key` = `<your TRMNL_API_KEY>`
6. **Refresh rate**: 30 minutes is plenty - the Worker's own cache only actually changes
   every few hours (see the root README for why).
7. Paste `templates/full.liquid` into the **Full** layout editor. Repeat for
   `half_horizontal.liquid`, `half_vertical.liquid`, and `quadrant.liquid` if you want this
   plugin available in TRMNL's mashup/split layouts too - otherwise `full` alone is enough.
8. **Icon**: upload `icon-512.png` (in this folder) as the plugin's icon.
9. Name it "Wetter Wabern" and save. Add it to your playlist.

## What you'll see

Current temperature + condition emoji, today's high/low, and (full layout) an hourly
strip for the next few hours - all for Wabern (3084), Bern, sourced from the SRF Weather
API v2.

## If a value shows "-" or blank

That means the SRF response uses a field name the backend didn't anticipate (see
`backend/README.md` → "About the SRF field-name mapping"). It's a mapping-table tweak in
`backend/src/lib/forecastMapper.ts`, not a plugin/template problem.
