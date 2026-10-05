-- Domain-Monitoring: manuelle Watchlist + persistierte Check-Ergebnisse
-- Manuell im Supabase SQL-Editor ausführen (wie die übrigen Dateien in manual-migrations/).
--
-- Hintergrund: Der Domain-Health-Cron (alle 5 Min) schrieb Ausfälle bisher nur
-- ins Activity-Log. Diese Tabellen machen den Status flächendeckend sichtbar:
--  - domain_watchlist:     Admin kann beliebige Domains zur Überwachung hinzufügen
--  - domain_check_results: letzter Prüfstand pro Domain (Basis fürs Admin-Dashboard-Banner)

-- 1) Manuelle Watchlist ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.domain_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.domain_watchlist TO authenticated;
GRANT ALL ON public.domain_watchlist TO service_role;

ALTER TABLE public.domain_watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage domain watchlist" ON public.domain_watchlist;
CREATE POLICY "Admins manage domain watchlist"
  ON public.domain_watchlist FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Persistierte Check-Ergebnisse ------------------------------------------
CREATE TABLE IF NOT EXISTS public.domain_check_results (
  domain text PRIMARY KEY,
  source text NOT NULL DEFAULT 'tenant',   -- tenant | landing_page | watchlist
  label text,                              -- Tenant-Name / Landing-Name / Notiz
  status text NOT NULL DEFAULT 'unknown',  -- ok | slow | down | no_landing | unknown
  http_status integer,
  latency_ms integer,
  error text,
  checked_url text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.domain_check_results TO authenticated;
GRANT ALL ON public.domain_check_results TO service_role;

ALTER TABLE public.domain_check_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read domain check results" ON public.domain_check_results;
CREATE POLICY "Admins read domain check results"
  ON public.domain_check_results FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Schreiben erfolgt ausschließlich serverseitig (Service Role / Cron).

COMMENT ON TABLE public.domain_watchlist IS
  'Vom Admin manuell hinzugefügte Domains, die der Health-Cron zusätzlich zu Tenant- und Landing-Domains überwacht.';
COMMENT ON TABLE public.domain_check_results IS
  'Letzter Prüfstand pro Domain (vom domain-health-cron bzw. manuellem Check geschrieben). Basis für das Warn-Banner im Admin-Dashboard.';
