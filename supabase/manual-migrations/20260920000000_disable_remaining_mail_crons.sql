-- APPLY MANUALLY:
-- docker exec -i supabase-db psql -U postgres -d postgres < 20260920000000_disable_remaining_mail_crons.sql
--
-- Nimmt die letzten mailbezogenen Jobs aus dem Zeitplan. Der eigene
-- Mailversand ist komplett deaktiviert (Harter Riegel in send-guard.ts,
-- Termin-Mails/SMS laufen über Calendly) — diese Jobs würden nur noch
-- das Protokoll zumüllen:
--   * process-invite-resend-queue (Wiederholungs-Warteschlange)
--   * smtp-health-cron (SMTP-Gesundheitscheck, ohne Versand nutzlos)
--   * send-chat-reminder (Chat-Erinnerungs-Mails, falls geplant)
--
-- NICHT angetastet werden Status- und Infrastruktur-Jobs
-- (z. B. "Termin verpasst -> no_show", Domain-Checks) — die versenden
-- keine Mails und werden für Statistik/Monitoring gebraucht.

DO $$
BEGIN
  PERFORM cron.unschedule('process-invite-resend-queue');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'process-invite-resend-queue war nicht geplant: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('smtp-health-cron');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'smtp-health-cron war nicht geplant: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('send-chat-reminder');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'send-chat-reminder war nicht geplant: %', SQLERRM;
END $$;

-- Verifizieren (darf keine Mail-Jobs mehr listen):
--   SELECT jobname, schedule, active FROM cron.job;
