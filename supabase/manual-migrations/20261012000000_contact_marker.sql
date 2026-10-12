-- Kontakt-Markierung (WhatsApp-Zuständigkeit): grün / blau.
-- Gespeichert an der Bewerbung; Mitarbeiter und Chat übernehmen sie über
-- profiles.application_id bzw. applications.user_id.
-- APPLY MANUALLY via: bash scripts/migrate.sh
alter table public.applications
  add column if not exists contact_marker text
  check (contact_marker is null or contact_marker in ('green', 'blue'));
