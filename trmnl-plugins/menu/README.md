# TRMNL Private Plugin - Menü-Inspiration

Saisonale, familienfreundliche Rezeptidee des Tages, plus ein Ausblick auf die nächsten
zwei Tage. Keine externe Rezept-API nötig - die Auswahl kommt aus einer kuratierten Liste
direkt im Backend (`backend/src/lib/recipes.ts`), passend zur aktuellen Jahreszeit
(Frühling/Sommer/Herbst/Winter) und wechselt einmal täglich, deterministisch nach Datum.

Deploy `backend/` zuerst (siehe `backend/README.md`) - du brauchst die URL und deinen
`TRMNL_API_KEY`.

## Setup im TRMNL-Dashboard

1. **Plugins → Private Plugin → Add New**.
2. **Strategy**: Polling
3. **Polling URL**: `https://trmnl-family-backend.<your-subdomain>.workers.dev/menu.json`
4. **Polling verb**: GET
5. **Polling headers**: `X-API-Key` = `<dein TRMNL_API_KEY>`
6. **Refresh rate**: 6 Stunden reichen locker - die Auswahl wechselt eh nur 1x/Tag.
7. Templates aus `templates/*.liquid` in die jeweiligen Layout-Editoren einfügen.
8. **Icon**: `icon-512.png` (in diesem Ordner) hochladen.
9. Name "Menü-Inspiration" und speichern, zur Playlist hinzufügen.

## Rezepte erweitern/anpassen

Einfach `backend/src/lib/recipes.ts` bearbeiten (pro Jahreszeit ein Array), committen und
`npx wrangler deploy` - kein Redesign der Templates nötig. Aktuell 8 Gerichte pro
Jahreszeit hinterlegt.

## Warum keine echte Rezept-API?

Kostenlose Rezept-APIs (Spoonacular, Edamam, etc.) sind entweder stark limitiert, kosten
etwas, oder liefern keine verlässlich "familienfreundlichen", saisonalen Deutschschweizer
Vorschläge. Eine kleine, gepflegte Liste ist hier die robustere, kontrollierbare Lösung -
ähnliches Prinzip wie bei der To-Do-Liste anstelle einer FamilyWall-API.
