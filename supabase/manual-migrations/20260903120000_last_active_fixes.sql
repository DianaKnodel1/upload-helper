-- APPLY MANUALLY via: bash scripts/migrate.sh
-- Fixes für die Anzeige "Zuletzt aktiv" im Admin-Chat.
-- Idempotent: kann mehrfach laufen.

-- 1) Aktivitätsspalte absichern
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx
  ON public.profiles (last_seen_at DESC NULLS LAST);

-- 2) Letzter Login: auch für admin_mitarbeiter lesbar (bisher nur 'admin')
CREATE OR REPLACE FUNCTION public.get_last_sign_ins(_user_ids uuid[])
RETURNS TABLE (user_id uuid, last_sign_in_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_mitarbeiter'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT u.id, u.last_sign_in_at FROM auth.users u WHERE u.id = ANY(_user_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_last_sign_ins(uuid[]) TO authenticated;

-- 3) Heartbeat serverseitig stempeln (statt Client-Uhr)
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS timestamptz
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ts timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.profiles SET last_seen_at = ts WHERE user_id = auth.uid();
  RETURN ts;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_last_seen() FROM public;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;
