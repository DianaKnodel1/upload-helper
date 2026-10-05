-- WebID-Modul: eine zentrale, editierbare Meldung (ersetzt Vorgänge + Zuweisungen).

CREATE TABLE IF NOT EXISTS public.webid_sim_notice (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  meta text,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.webid_sim_notice TO anon, authenticated;
GRANT ALL ON public.webid_sim_notice TO service_role;

ALTER TABLE public.webid_sim_notice ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read notice" ON public.webid_sim_notice;
CREATE POLICY "read notice" ON public.webid_sim_notice FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin manage notice" ON public.webid_sim_notice;
CREATE POLICY "admin manage notice" ON public.webid_sim_notice
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Startwert: Text aus dem Screenshot des Kunden (jederzeit im Admin editierbar).
INSERT INTO public.webid_sim_notice (id, title, body, meta, is_active)
VALUES (1,
  'Vertraulich – bitte unbedingt beachten:',
  'Dieser Test erfolgt im offiziellen Auftrag der DKB. Gib dich zu keinem Zeitpunkt als Testperson zu erkennen und verhalte dich wie ein ganz normaler Kunde. Bewertet wird der DKB-Mitarbeiter (verständliches Deutsch, Freundlichkeit). Gib die Bewertung anschließend beim Auftragnehmer ein.',
  NULL,
  true)
ON CONFLICT (id) DO NOTHING;
