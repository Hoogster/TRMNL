# Familienkalender (bereits umgesetzt)

Der bestehende "Custom Calendar"-Private-Plugin, der den FamilyWall-Kalender via
iCal-Feed einliest, ist bereits eingerichtet und wird hier nicht verändert.

Referenz, falls du ihn je neu aufsetzen musst:

1. FamilyWall App → Kalender → Zahnrad-Icon → Kalender auswählen → **iCal-URL
   generieren** (siehe [FamilyWall-Hilfe](https://support.familywall.com/en/support/solutions/articles/47001239556-add-external-calendars-in-familywall-via-url)).
2. In TRMNL: **Plugins → Private Plugin**, Strategy `polling`, Polling-URL = die
   generierte iCal-URL, Liquid-Template parst die ICS-Events.

Kein FamilyWall-"API-Key" nötig - der iCal-Feed ist ein öffentlicher (aber schwer zu
erratender) Link pro Kalender.
