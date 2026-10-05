-- Abschnitts-Baukasten für Landing-Pages (Option A).
-- Wenn `sections` gesetzt ist, rendert der Landing-Server die Seite aus den
-- Abschnitten (sections-renderer.js) statt aus dem festen Theme.
-- NULL = klassische Theme-Landing (Bestand bleibt unverändert).

alter table public.landing_pages
  add column if not exists sections jsonb;
