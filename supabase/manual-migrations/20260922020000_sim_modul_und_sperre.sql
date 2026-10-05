-- APPLY MANUALLY via: bash scripts/migrate.sh
-- 1) Mitarbeiter-Sperre (unabhängig vom Status)
-- 2) SMS nur ab Zeitpunkt der Zuweisung sichtbar, nicht für gesperrte Konten

-- ── 1) Sperre ───────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_by uuid;

CREATE INDEX IF NOT EXISTS profiles_is_blocked_idx ON public.profiles (is_blocked) WHERE is_blocked;

-- ── 2) SMS-Sichtbarkeit für Mitarbeiter ─────────────────────────────────────
-- Nur Nachrichten, die NACH der Zuweisung eingegangen sind, nur bei aktiver
-- Zuweisung, nur bei aktivem Kanal und nur für nicht gesperrte Konten.
DROP POLICY IF EXISTS "Users view sms for assigned channels" ON public.sms_messages;
CREATE POLICY "Users view sms for assigned channels"
ON public.sms_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sms_assignments a
    WHERE a.sms_channel_id = sms_messages.channel_id
      AND a.user_id = auth.uid()
      AND a.is_active = true
      AND sms_messages.created_at >= a.assigned_at
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.is_blocked = true
  )
);

-- Zuweisungen gesperrter Mitarbeiter liefern nichts mehr aus.
CREATE OR REPLACE FUNCTION public.get_my_sms_assignments()
RETURNS TABLE(
  assignment_id uuid, is_active boolean, note text, assigned_at timestamptz,
  channel_id uuid, label text, phone_number text, provider text, channel_is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sa.id, sa.is_active, COALESCE(sa.note, ''), sa.assigned_at,
         sc.id, COALESCE(sc.label, ''), sc.phone_number, sc.provider, sc.is_active
  FROM public.sms_assignments sa
  JOIN public.sms_channels sc ON sc.id = sa.sms_channel_id
  WHERE sa.user_id = auth.uid()
    AND sa.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_blocked = true
    );
$$;
