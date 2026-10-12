# Website-Themes: 15 Themes bauen, KI-Bilder entfernen

## Entscheidungen (User, 2026-10-12)
- **KI-Bild-Generierung entfernen** — funktioniert nicht zuverlässig, wird aus dem Generator gestrichen. Bilder kommen fest ins Theme (professionell generiert) oder per eigenem Upload.
- **Bestandsschutz gilt** — alle bestehenden Websites mit alten Vorlagen bleiben online und unverändert, bis der User sie selbst ändert oder löscht.
- **15 Website-Themes** — Theme 1 existiert bereits, es werden die Themes 2–15 gebaut. Qualität vor Geschwindigkeit.
- **Ausrichtung (User-Angaben):** Schwerpunkt kaufmännisch/Büro, Zielgruppe Bewerber UND Kunden gleichermaßen, alle 15 Themes müssen sich deutlich voneinander unterscheiden.
- **Bilder ohne 10-MB-Limit:** Theme-Bilder werden auf das Lovable-CDN hochgeladen (`.asset.json`-Zeiger) statt als Base64 ins Code-Bundle — hochauflösende, professionelle Bilder sind damit kein Problem. Das Limit galt nie für die Webseiten selbst, nur für einzelne Code-Dateien.

## Schritt 1: KI-Bild-Funktion entfernen
- `generateLandingImage` aus `src/lib/landing-pages.functions.ts` entfernen.
- `src/lib/landing-ai.server.ts` löschen (wird danach von nichts mehr genutzt).
- Zugehörige KI-Bild-Buttons/UI im Generator entfernen. Bild-Upload bleibt.

## Schritt 2: Themes 2–15 bauen (14 neue Themes)
Nach dem Muster von Theme 1 (`src/landing-themes/site-1/`), jedes Theme mit:
- `template.html` — Shell (Header, Navigation, Footer) + Seiten-Fragmente: Start, Jobs, Team, FAQ, Kontakt + 404-Seite; Impressum/Datenschutz kommen automatisch aus den Rechtsdaten.
- `style.css` — eigene Farbpalette über CSS-Variablen (editierbar im Generator), 2–3 Schrift-Alternativen pro Theme.
- `script.js` — Menü, Animationen, Jahreszahl.
- `meta.json` — Seiten-Liste, Schriften, Farben, Text-Slots.
- `assets/` — professionelle, KI-generierte Bilder (Hero, Team, Jobs, Kontakt: Büro-/Business-Motive), hochgeladen aufs CDN via `lovable-assets`, im Template über CDN-URL referenziert.

Jedes Theme eine eigene visuelle Welt — keine ähnlichen Zwillinge. Alle passen zu kaufmännischen/Büro-Unternehmen und wirken für Bewerber wie Kunden gleichermaßen:
1. Theme 1 „Klassik" (fertig): navy/gold, Serifen, seriös
2. Dunkel & edel: Dark-Mode, große Typo, Gold-Akzent
3. Hell & luftig: viel Weißraum, sanftes Blau, weich
4. Kraftvoll & modern: kräftiges Rot/Orange, fette Headlines
5. Warm & menschlich: Erdfarben, runde Formen
6. Technisch & präzise: Mono-Akzente, sichtbares Raster, kühl
7. Editorial / Magazin: große Serifen-Titel, Zeitungs-Look
8. Frisch & dynamisch: Farbverläufe, Bewegung, junge Anmutung
9. Minimal Schwarz-Weiß: reduziert, ein einziger Farbakzent
10. Natürlich & ruhig: Grüntöne, organische Formen
11. Corporate Blau: klassisches Enterprise-Design, Vertrauen
12. Premium Dunkel-Grün / Smaragd: Luxus-Anmutung
13. Skandinavisch: helles Holz-Grau, schlichte Eleganz
14. Bold Brutalist: hohe Kontraste, kantig, auffällig
15. Glas / Modern SaaS: Glassmorphism, weiche Schatten, Indigo

Reihenfolge: Etappen 2–5, 6–10, 11–15. Nach jeder Etappe: Build + Renderer-Test.

## Schritt 3: Registrierung & Test
- `src/lib/landing-themes.ts`: neue Themes in die Registry, `ACTIVE_THEME_IDS` auf site-1 … site-15, Anzeigenamen „Website-Theme 1" … „Website-Theme 15".
- Bilder per `lovable-assets create` aufs CDN hochladen, `.asset.json`-Zeiger im Theme ablegen; Templates referenzieren die CDN-URLs. Das Base64-Bundle (`theme-assets.generated.ts`) wird für neue Themes nicht mehr benötigt; Bestand (Theme 1 + alte Themes) bleibt unverändert.
- Renderer-Unit-Test (Fragmente, disabled Nav, 404) + Landing-Server-E2E mit Mock-DB pro Theme.
- Build-Check (`/tmp/observability/build-errors.log`).

## Danach (separate Schritte, nicht Teil dieses Plans)
- ZIP-Export für mehrseitige Themes.
- Deploy: Migrationen `20261006000000_landing_site_themes.sql` + `20261011000000_drop_landing_templates.sql` auf dem Backend-Server einspielen, dann `git pull` + `deploy.sh`.

## Bestandsschutz (unverändert)
- Bestehende einseitige Landing Pages und die Baukasten-Seite (b-h-v-agentur.com) bleiben online und rendern exakt wie heute.
- Alte Themes bleiben im Code, sind aber für neue Seiten nicht wählbar.
