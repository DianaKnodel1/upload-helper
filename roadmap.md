# Roadmap

## Aktiv: Landing-Generator Theme-Überarbeitung (Plan genehmigt 2026-09-29)
- [x] Deckblatt „Login & Status" im Chat an Kollegen senden
- [x] 6 neue Themes anlegen (corporate-consulting, modern-business, minimal-professional, executive-premium, human-business, digital-professional) — je eigenes Layout/Hero/Typo/Bilder/CTA + eigener Formular-Abschnitt (nur Optik) + meta.json-Slots
- [x] Bilder für alle 6 Themes generieren (assets/)
- [x] Registry: nur 6 neue Themes aktiv, alte in „Archiv"; „Neue Landing" nur neue; bestehende Landings behalten altes Theme (keine Migration) — inkl. Fix: Editorial-Premium-Doppel-Eintrag korrigiert
- [x] Verifikation: build-theme-assets.mjs (54 Assets), Typecheck/Build OK, jedes Theme bei 390/768/1024/1440 px ohne Overflow geprüft, Formular-Sektionen aller 6 Themes geprüft
- [x] Bestehende Funktionen checken (Speichern, Bearbeiten, Duplizieren, Vorschau, eigene Vorlagen) — Archiv-Auswahl speichert nicht für neue Seiten, Bearbeiten alter Seiten erlaubt
- [ ] Deckblatt „Landing-Generator" im Chat senden (mit 6 Themes + Archiv)
- Deploy: `cd /opt/apps/portal && git pull && bash scripts/deploy.sh`

## Aktiv: Website-Themes (mehrseitige Komplett-Websites, Plan 2026-10-06)
- [x] Migration geschrieben: supabase/manual-migrations/20261006000000_landing_site_themes.sql (site_theme, site_pages, site_settings) — noch NICHT angewendet, läuft beim Deploy auf dem Server
- [x] Theme 1 „Klassik" (site-1) komplett: template.html (5 Seiten + 404), style.css, script.js, meta.json, Assets komprimiert
- [x] Asset-Bundle neu gebaut (theme-assets.generated.ts, 9.8 MB — nicht committen, >10MB-Limit)
- [x] Registry (landing-themes.ts): site-Themes-Typ, site-1 vorn, ACTIVE_THEME_IDS nur noch site-1, isSiteTheme/defaultSitePages
- [x] Renderer src/lib/landing-site.ts (parseSiteTheme, renderSitePage) + Unit-Test via bun (Fragmente, disabled Nav, 404 OK)
- [x] Landing-Server: LANDING_SELECT erweitert, renderSiteHtml mit Multipage-Routing, themed 404, CSS/JS/Assets über site_theme — node --check OK
- [x] Generator-Integration: Website-Theme 1 auswählbar, Preview mit Seiten-Tabs, Save schreibt site_theme/site_pages/site_settings, Bearbeiten lädt site_pages
- [x] landing-pages.functions.ts: SaveInput + Payload um site_* erweitert
- [x] E2E Landing-Server mit Mock-DB: /, /team, /bewerben (Apply-Modal), /impressum, /style.css, Theme-404, SEO-Titel pro Seite, Branding-Fill, klassische Landing unverändert (200) — Admin-UI-Test im Browser blockiert (Backend-Key rotiert, 401 → wartet auf neuen VITE_SUPABASE_PUBLISHABLE_KEY)
- [ ] Themes 2–15 (Etappe 2–5, 6–10, 11–15), Theme 1 ist Qualitätsreferenz
- [ ] ZIP-Export (generate) für mehrseitige Themes
- [x] Baukasten gelöscht (Editor-Route, landing-builder/-templates/-blueprints, Generator-UI; landing-sections.ts + sections-renderer.js bleiben für die Live-Seite b-h-v-agentur.com; Migration 20261011000000_drop_landing_templates.sql angelegt — beim Deploy einspielen); KI-Bilder jetzt als generateLandingImage in landing-pages.functions.ts
- [ ] Deploy-Hinweis: Migration SQL bei Deploy auf dem Backend-Server einspielen (psql / deploy-backend-local.sh)

## Hintergrund / fertig
- Vorlagen sind jetzt alle „direkt" (kein Fast-Track/Vermittlung bei neuen Seiten) — Teil 1 erledigt 2026-09-29.
- Stichprobe alt (amber-consult, device-stack, quality-report) — überholt durch die komplette neue Theme-Welt.

## Backup-Server (Plan 2026-10-17)
- [x] Orchestrator neu (DB+Rollen+Struktur, Storage, Schlüssel, Server-Einstellungen, Verschlüsselung, Prüfung, lokaler Status, Alarm, Außer-Haus optional)
- [x] restore.sh pro Rolle (backend/frontend/landing/bot/webid/inspect), Anleitung docs/DISASTER-RECOVERY.md
- [ ] Einrichtung auf dem Backup-Server durch den User + Probe-Wiederherstellung
