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

## Neue Themes: 15 Stück, benannt „1" bis „15"
- Die Themes bekommen schlichte Nummern als Namen: **„Website-Theme 1" … „Website-Theme 15"** (Anzeige im Generator).
- 15 Themes auf höchstem Design-Niveau, gebaut in Etappen:
  - **Etappe 1:** Theme 1 komplett fertigstellen (alle Unterseiten) — Qualitätsreferenz
  - **Etappe 2:** Themes 2–5, **Etappe 3:** Themes 6–10, **Etappe 4:** Themes 11–15
- Jedes Theme eine eigene visuelle Welt: eigene Farbpalette, eigene Schriften, eigenes Layout, eigene Anmutung (hell/dunkel, ruhig/kraftvoll, seriös/warm) — keine ähnlichen Zwillinge.
- Jedes Theme enthält feste Unterseiten: Start, Leistungen/Jobs, Über uns/Team, FAQ, Kontakt, Impressum, Datenschutz — mit eigenem Header/Footer, Navigation und durchgestylten Bausteinen je Seite.

## Bearbeitbarkeit nach Theme-Auswahl
Editierbar (pro Website, unabhängig vom Original-Theme):
- **Alle Texte:** Überschriften, Beschreibungen, FAQ, Team-Mitglieder, Kontaktdaten
- **Alle Bilder:** Logo und Fotos hochladen oder KI-generieren
- **Farben:** Haupt-/Akzent-/Hintergrundfarbe — innerhalb von Kontrast-Grenzen (Lesbarkeit bleibt garantiert)
- **Schriften:** pro Theme 2–3 abgestimmte Alternativen
- **Struktur:** Unterseiten ein-/ausblenden, umbenennen, **duplizieren** (eigene Unterseite entsteht aus Kopie einer bestehenden, z. B. FAQ → Standorte)
- **Nicht editierbar:** Layout-Philosophie und Charakter des Themes (garantiert die professionelle Optik)

## Admin-Editor (im bestehenden Generator)
- Neue Seiten-Verwaltung: Tabs pro Unterseite (Start, Team, FAQ …), Bausteine pro Seite bearbeiten, Seiten duplizieren/ausblenden/umbenennen, Reihenfolge der Navigation ändern.
- Farbwahl und Schriftalternativen direkt im Editor; Live-Vorschau mit Seitenwechsel.
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
