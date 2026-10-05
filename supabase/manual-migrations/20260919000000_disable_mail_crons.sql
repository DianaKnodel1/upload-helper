-- APPLY MANUALLY:
-- docker exec -i supabase-db psql -U postgres -d postgres < 20260919000000_disable_mail_crons.sql
--
-- Schaltet ALLE automatischen Bewerber-Mail-Jobs ab.
-- Grund: Terminbestätigung, Erinnerungen und SMS laufen vollständig über
-- Calendly (bessere Zustellung). Das eigene Mail-System soll im
-- Bewerber-Funnel vorerst schweigen; der Code der Edge Functions bleibt
-- für eine spätere Conversion-Optimierung (z. B. eigene Eingangs-
-- bestätigung, die Calendly nicht hat) bestehen und kann per Admin-
-- Knopf weiterhin manuell ausgelöst werden.
--
-- NICHT abgeschaltet wird der reine Status-Job
-- (auto_complete_and_noshow_appointments / "termin verpasst -> no_show"),
-- damit die Statistik weiter stimmt. Der verschickt keine Mails.
--
-- WICHTIG: scripts/fix-mail-crons.sh NICHT mehr ausführen — es würde
-- diese Jobs wieder anlegen.

DO $$
BEGIN
  PERFORM cron.unschedule('send-booking-confirmation');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'send-booking-confirmation war nicht geplant: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('send-appointment-reminders');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'send-appointment-reminders war nicht geplant: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('send-application-reminders');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'send-application-reminders war nicht geplant: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('send-reminders-hourly');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'send-reminders-hourly war nicht geplant: %', SQLERRM;
END $$;

-- Verifizieren (darf die vier Jobs nicht mehr listen):
--   SELECT jobname, schedule, active FROM cron.job;
