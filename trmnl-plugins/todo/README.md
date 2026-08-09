# TRMNL Private Plugin - Familien To-Do

FamilyWall doesn't expose a task/to-do API (only calendar events, via the iCal export used
by your existing calendar plugin) - so this is a small, clean, self-hosted alternative:
one shared list your family edits from their phones, displayed read-only on the TRMNL.

Deploy `backend/` first (see `backend/README.md`) - you need its URL and your
`TRMNL_API_KEY` before setting this up.

## Setup in the TRMNL dashboard

1. Go to **Plugins → Private Plugin → Add New**.
2. **Strategy**: Polling
3. **Polling URL**: `https://trmnl-family-backend.<your-subdomain>.workers.dev/todo.json`
4. **Polling verb**: GET
5. **Polling headers**: add `X-API-Key` = `<your TRMNL_API_KEY>`
6. **Refresh rate**: 15 minutes (or lower if you want changes to show up faster).
7. **Tap action URL** (optional, if your TRMNL model/firmware supports tap actions):
   `https://trmnl-family-backend.<your-subdomain>.workers.dev/todo` - tapping the plugin
   on the device opens the editable list on a phone via TRMNL's companion app.
8. Paste `templates/full.liquid` (and the other layouts if you use mashups) into the
   matching layout editors.
9. Name it "Familien To-Do" and save. Add it to your playlist.

## Adding/checking off tasks

Open `https://trmnl-family-backend.<your-subdomain>.workers.dev/todo` on a phone, enter
the API key once (cached after that), and use it like any simple to-do app - add items,
tick them off, organize into lists (e.g. "Familie", "Einkaufen"). The TRMNL display is
read-only; it just shows what's currently open.

## Why not FamilyWall / Todoist / etc.?

FamilyWall has no published API for lists/tasks (only the calendar iCal export). Rather
than bolt on a third-party app the family doesn't already use, this keeps everything in
one small piece of infrastructure you control, alongside the weather cache.
