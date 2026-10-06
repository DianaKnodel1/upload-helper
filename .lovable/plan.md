# Landing-Generator: Komplette Website-Themes

## Ziel
Der Landing-Generator erstellt künftig **ganze Websites** statt einseitiger Landings. Jedes neue Theme ist eine komplette Mehrseiten-Website mit eigener, stark unterschiedlicher Optik: Startseite, Leistungen/Jobs, Über uns/Team, FAQ, Kontakt, Impressum, Datenschutz. Qualitätsmaßstab: „extrem professionell", jedes Theme eine eigene visuelle Welt (Farben, Schriften, Layout, Anmutung).

## Bestandsschutz (unveränderlich)
- Bestehende Landing Pages rendern exakt wie heute weiter — keine Migration, keine Umstellung.
- Die 34 alten Themes bleiben im Code, werden aber aus der Theme-Auswahl für **neue** Seiten entfernt (nur die neuen Website-Themes wählbar). Alte Themes werden erst gelöscht, wenn keine bestehende Landing Page sie mehr referenziert.

## Technik: Datenmodell
- Neue Spalten auf `landing_pages` (Migration, idempotent):
  - `site_theme text` — ID des Website-Themes
  - `site_pages jsonb` — Array von Seiten: `[{ slug, title, seo_title, seo_description, blocks: [...] }]`
  - `site_settings jsonb` — globale Einstellungen: Logo, Firmendaten, Navigations-Labels, Farben optional pro Theme
- `NULL` auf beiden Spalten = klassische Einseiten-Landing (Bestand bleibt unverändert). Alles Neue ist rein additiv.
- Impressum/Datenschutz werden aus den bestehenden `legal-content`-Daten automatisch als echte Seiten der Website gerendert (nicht mehr nur als angehängte HTML-Dateien).

## Technik: Landing-Server (Mehrseiten-Routing)
- `landing-server/server.js` wird erweitert: wenn eine Domain zu einer Landing Page mit `site_pages` gehört, bedient der Server Unterseiten-Pfade (`/team`, `/faq`, `/kontakt`, `/impressum` …) aus dem Theme-Renderer; unbekannte Pfade → 404-Seite im Theme-Look.
- Navigation/Topbar des Themes verlinkt die vorhandenen Seiten; SEO-Metadaten pro Unterseite (eigener Titel/Description).
- Formular-Abschnitt der Startseite (Bewerbung) bleibt an den bestehenden Flow angebunden (Magic-Link/Calendly unverändert).

## Neue Themes: erste Generation (3 Stück)
1. **„Seriös & Klassisch"** — helle, vertrauensvolle Anmutung, Serifen-Schriften, ruhiges Layout (Beratung/Finanzen-Sektor).
2. **„Modern & Technisch"** — dunkel, kontrastreich, Grotesk-Schriften, große Typografie, dezente Animationen (Tech/IT-Sektor).
3. **„Warm & Menschlich"** — warme Farben, runde Formen, viel Weißraum, Bildstark (Pflege/Soziales-Sektor).

Jedes Theme enthält feste Unterseiten-Templates: Start, Leistungen/Jobs, Team, FAQ, Kontakt, Impressum, Datenschutz — mit eigenem Header/Footer, eigener Navigation und durchgestylten Bausteinen je Seite.

## Admin-Editor (im bestehenden Generator)
- Neue Seiten-Verwaltung: Tabs pro Unterseite (Start, Team, FAQ …), Bausteine pro Seite bearbeiten, Seiten hinzufügen/ausblenden, Reihenfolge der Navigation ändern.
- Live-Vorschau wie bisher, aber mit Seitenwechsel innerhalb der Vorschau.
- Speichern/Veröffentlichen wie gewohnt; alte Einseiten-Seiten zeigen den bestehenden Editor ohne die neuen Tabs.

## Reihenfolge
1. Migration + Datenmodell (additiv, Bestand unberührt)
2. Landing-Server: Mehrseiten-Routing + Theme-Engine für ganze Websites
3. Erstes Theme „Seriös & Klassisch" komplett (alle Unterseiten) — Qualitätsreferenz
4. Admin-Editor: Seitenverwaltung + Vorschau
5. Theme 2 und 3 nach gleichem Muster
6. Theme-Auswahl für neue Seiten auf die neuen Website-Themes umstellen (alte Designs aus der Auswahl, im Code eingefroren)
7. End-to-End-Test: neue Website anlegen, Unterseiten prüfen, veröffentlichen, bestehende Landings gegenchecken

## Offene Punkte
- Anzahl und Namensgebung der ersten Theme-Generation (Vorschlag: 3, wie oben)
- Ob „eigenen Unterseiten selbst erstellen" in Generation 1 per Seiten-Duplizierung abgedeckt ist (empfohlen) oder als eigene Funktion folgt
- Deploy: Landing-Server-Sync über `scripts/sync-landing-server.sh` (bestehender Prozess)
