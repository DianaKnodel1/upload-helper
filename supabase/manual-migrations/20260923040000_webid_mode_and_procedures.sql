-- WebID-Modul: Modus pro Sim-Domain, Vorgänge (Hinweis-Texte), Vorgang pro Auftrag.

-- Modus pro Sim-Domain
ALTER TABLE public.webid_sim_domains
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'simulation'
    CHECK (mode IN ('simulation','tunnel'));

-- Vorgänge / Hinweis-Texte
CREATE TABLE IF NOT EXISTS public.webid_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('webid','postident')),
  title text NOT NULL,
  body text NOT NULL,
  meta text,
  allow_submit boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.webid_procedures TO anon, authenticated;
GRANT ALL ON public.webid_procedures TO service_role;

ALTER TABLE public.webid_procedures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read procedures" ON public.webid_procedures;
CREATE POLICY "read procedures" ON public.webid_procedures FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin manage procedures" ON public.webid_procedures;
CREATE POLICY "admin manage procedures" ON public.webid_procedures
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Vorgang pro Auftrag
ALTER TABLE public.task_assignments
  ADD COLUMN IF NOT EXISTS webid_procedure_key text;
