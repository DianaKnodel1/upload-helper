-- Website-Themes (mehrseitige Komplett-Websites) für den Landing-Generator.
-- Additiv: NULL in allen drei Spalten = klassische Einseiten-Landing (Bestand unverändert).
-- site_theme      → ID des Website-Themes (z.B. "site-1")
-- site_pages      → Seitenstruktur: { pages: [{ id, slug, title, seo_title, seo_description, enabled, fragment? }] }
-- site_settings   → globale Einstellungen der Website (Schrift-Set, Optionen)
-- APPLY MANUALLY via: bash scripts/migrate.sh

alter table public.landing_pages
  add column if not exists site_theme text;
alter table public.landing_pages
  add column if not exists site_pages jsonb;
alter table public.landing_pages
  add column if not exists site_settings jsonb not null default '{}'::jsonb;

-- anon (Landing-Server) darf die neuen Felder mitlesen — RLS-Policy
-- "public read published" deckt die Zeilen ab, Grants ergänzen die Spalten.
