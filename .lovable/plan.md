# Prüfung Landing-Generator und Website-Themes 1–15

## Ziel
1. Sicherstellen, dass im Generator jede Änderung (Texte, Bilder, Farben, Schriften, Seiten an/aus, Seiten duplizieren, SEO) sofort in der Vorschau erscheint und so gespeichert wird, wie sie später live aussieht.
2. Eine verständliche Übersicht für dich: Was kannst du pro Theme alles ändern, bevor die Seite live geht?
3. Alle 15 Themes prüfen: professionell, verständlich, gut gestaltet, auf Handy und Desktop.

## Schritt 1 – Generator-Funktionstest (im Browser, automatisiert)
- Generator öffnen, nacheinander jedes Theme auswählen.
- Pro Theme ändern und prüfen, ob die Vorschau es sofort übernimmt:
  - Überschrift und Texte auf jeder Unterseite (Start, Jobs, Team, FAQ, Kontakt)
  - Bilder austauschen
  - Haupt- und Akzentfarbe
  - Schrift-Set
  - Unterseite ausblenden (Menüpunkt muss verschwinden)
  - Unterseite duplizieren
  - Seitentitel und Beschreibung für Google
- Prüfen, ob Vorschau und Live-Ausgabe des Servers identisch sind (gleiche Darstellung, keine offenen Platzhalter wie `{{...}}`).
- Speichern: Da die Datenbank-Erweiterung noch nicht auf deinem Server ist, teste ich das Speichern mit einer nachgebildeten Datenbank und gebe dir danach eine kurze Checkliste für den Test nach dem Deploy.
- Bestand: Prüfen, dass alte Landing Pages unverändert bleiben.

## Schritt 2 – Design-Prüfung aller 15 Themes
- Von jedem Theme jede Unterseite auf Desktop und Handy fotografieren und ansehen.
- Bewertet wird: erster Eindruck, Lesbarkeit und Kontrast, Abstände und Ausrichtung, Bilder passend und scharf, Menü auf dem Handy, Schaltflächen klar, Texte verständlich und fehlerfrei, deutliche Unterscheidung zwischen den Themes.
- Sonderprüfung: Bleibt das Design auch gut, wenn du extreme Farben wählst oder sehr lange Texte eingibst?

## Schritt 3 – Ergebnisbericht und Korrekturen
- Bericht pro Theme: in Ordnung / kleine Mängel / muss verbessert werden.
- Gefundene Fehler im Generator und Design-Mängel behebe ich direkt.
- Übersicht „Was kann ich ändern?" als klare Liste für dich.

## Technische Details
- Playwright gegen localhost; Generator-Vorschau nutzt `renderSitePage` (src/lib/landing-site.ts), Abgleich gegen den Spiegel in landing-server/server.js.
- Speichertest mit gemockten Supabase-Antworten, da Migration `20261006000000_landing_site_themes.sql` noch nicht deployed ist.
- Screenshots 1280px und 390px Breite je Seite (15 Themes x 5 Seiten x 2).
