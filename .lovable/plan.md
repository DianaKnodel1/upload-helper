# Website-Themes: 10 Themes bauen, KI-Bilder entfernen

## Entscheidungen (User, 2026-10-12)
- **KI-Bild-Generierung entfernen** — sie funktioniert nicht zuverlässig und wird aus dem Generator gestrichen. Bilder kommen stattdessen fest ins Theme (professionell generiert) oder per eigenem Upload.
- **Bestandsschutz gilt weiterhin** — alle bestehenden Websites mit alten Vorlagen bleiben online und unverändert, bis der User sie selbst ändert oder löscht.
- **10 Website-Themes statt 15** — Theme 1 existiert bereits, es werden die Themes 2–10 gebaut. Qualität vor Geschwindigkeit.

## Schritt 1: KI-Bild-Funktion entfernen
- `generateLandingImage` aus `src/lib/landing-pages.functions.ts` entfernen.
- `src/lib/landing-ai.server.ts` löschen (wird danach von nichts mehr genutzt).
- Zugehörige KI-Bild-Buttons/UI im Generator entfernen. Bild-Upload bleibt.

## Schritt 2: Themes 2–10 bauen (9 neue Themes)
Nach dem Muster von Theme 1 (`src/landing-themes/site-1/`), jedes Theme mit:
- `template.html` — Shell (Header, Navigation, Footer) + Seiten-Fragmente: Start, Jobs, Team, FAQ, Kontakt + 404-Seite; Impressum/Datenschutz kommen automatisch aus den Rechtsdaten.
- `style.css` — eigene Farbpalette über CSS-Variablen (editierbar im Generator), 2–3 Schrift-Alternativen pro Theme.
- `script.js` — Menü, Animationen, Jahreszahl.
- `meta.json` — Seiten-Liste, Schriften, Farben, Text-Slots.
- `assets/` — **professionelle, KI-generierte Bilder** (Hero, Team, Jobs, Kontakt) in hoher Auflösung. Die Bilder werden auf das Lovable-CDN hochgeladen (`lovable-assets`, `.asset.json`-Zeiger) statt als Base64 ins Code-Bundle — damit entfällt das bisherige 10-MB-Limit komplett und auch große, hochwertige Bilder sind kein Problem. Der Landing-Server und der ZIP-Export ziehen die Bilder über die CDN-URLs.

Jedes Theme eine eigene visuelle Welt — keine ähnlichen Zwillinge:
1. Theme 1 „Klassik" (fertig): navy/gold, Serifen, seriös
2. Theme 2: dunkel & edel (Dark-Mode, große Typo, Neon-Akzent)
3. Theme 3: hell & luftig (viel Weißraum, Pastell, weich)
4. Theme 4: kraftvoll & modern (kräftige Farbe, fette Headlines)
5. Theme 5: warm & menschlich (Erdfarben, runde Formen)
6. Theme 6: technisch & präzise (Mono-Akzente, Raster, kühl)
7. Theme 7: elegant & hochwertig (Editorial-Stil, Magazin-Look)
8. Theme 8: frisch & dynamisch (Farbverläufe, Bewegung)
9. Theme 9: schlicht & reduziert (Minimalismus, Schwarz-Weiß + 1 Akzent)
10. Theme 10: natürlich & ruhig (Grüntöne, organische Formen)

Reihenfolge: Themes 2–5 (Etappe), dann 6–10 (Etappe). Nach jeder Etappe: Build + Renderer-Test.

## Schritt 3: Registrierung & Test
- `src/lib/landing-themes.ts`: neue Themes in die Registry, `ACTIVE_THEME_IDS` auf site-1 … site-10, Anzeigenamen „Website-Theme 1" … „Website-Theme 10".
- Bilder per `lovable-assets create` aufs CDN hochladen, `.asset.json`-Zeiger im Theme ablegen; Theme-Templates referenzieren die CDN-URLs. Das Base64-Bundle (`theme-assets.generated.ts`) wird für neue Themes nicht mehr benötigt; Bestand (Theme 1 + alte Themes) bleibt unverändert.
- Renderer-Unit-Test (Fragmente, disabled Nav, 404) + Landing-Server-E2E mit Mock-DB pro Theme.
- Build-Check (`/tmp/observability/build-errors.log`).

## Danach (separate Schritte, nicht Teil dieses Plans)
- ZIP-Export für mehrseitige Themes.
- Deploy: Migrationen `20261006000000_landing_site_themes.sql` + `20261011000000_drop_landing_templates.sql` auf dem Backend-Server einspielen, dann `git pull` + `deploy.sh`.

## Bestandsschutz (unverändert)
- Bestehende einseitige Landing Pages und die Baukasten-Seite (b-h-v-agentur.com) bleiben online und rendern exakt wie heute.
- Alte Themes bleiben im Code, sind aber für neue Seiten nicht wählbar.
