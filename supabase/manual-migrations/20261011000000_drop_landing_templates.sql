-- Baukasten (Abschnitts-Editor) wurde entfernt (Entscheidung 2026-10-11).
-- Bestehende Baukasten-Landings (landing_pages.sections) bleiben online —
-- der Landing-Server rendert sie weiter. Nur die Bearbeitung im Portal entfällt.
-- APPLY MANUALLY via: bash scripts/migrate.sh

drop table if exists public.landing_templates;
