-- APPLY MANUALLY via: bash scripts/migrate.sh
-- Fix: Der bisherige Dedup-Index ist PARTIAL (WHERE provider_message_id IS NOT NULL).
-- PostgREST-Upserts mit on_conflict=channel_id,provider_message_id können einen
-- partiellen Index nicht referenzieren -> Insert schlägt fehl ("no unique or
-- exclusion constraint matching the ON CONFLICT specification").
-- Deshalb zusätzlich ein vollständiger Unique-Index (NULLs bleiben verschieden).

-- Eventuelle Altdubletten entfernen, damit der Index angelegt werden kann.
DELETE FROM public.sms_messages a
USING public.sms_messages b
WHERE a.ctid > b.ctid
  AND a.channel_id = b.channel_id
  AND a.provider_message_id IS NOT NULL
  AND a.provider_message_id = b.provider_message_id;

CREATE UNIQUE INDEX IF NOT EXISTS sms_messages_channel_provider_msgid_all_uniq
  ON public.sms_messages (channel_id, provider_message_id);

DROP INDEX IF EXISTS public.sms_messages_channel_provider_msgid_uniq;
