-- APPLY MANUALLY via: bash scripts/migrate.sh
-- Chat: zuverlässiger Status "Antwort offen".
-- Offen = nach der letzten ECHTEN Admin-Antwort gibt es noch Mitarbeiter-
-- Nachrichten. Lesestatus entscheidet NICHT. Systemnachrichten und interne
-- KI-Notizen zählen nicht als Antwort.
-- Regel identisch zu src/lib/chat-open-status.ts (Fallback im Browser).
-- Zusätzlich: nur Admins / Admin-Mitarbeiter (mit Firmen-Freigabe) erhalten Daten.

DROP FUNCTION IF EXISTS public.list_chat_conversations();

CREATE FUNCTION public.list_chat_conversations()
RETURNS TABLE (
  partner_id uuid,
  last_message text,
  last_at timestamptz,
  unread bigint,
  last_from_partner_at timestamptz,
  open_since timestamptz,
  open_count bigint,
  open_preview text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH admin_ids AS (
    SELECT user_id FROM public.user_roles
    WHERE role::text IN ('admin', 'admin_mitarbeiter')
  ),
  relevant AS (
    SELECT
      CASE WHEN m.sender_id IN (SELECT user_id FROM admin_ids)
           THEN m.receiver_id ELSE m.sender_id END AS partner_id,
      m.sender_id,
      m.message,
      m.read,
      m.is_system,
      m.created_at
    FROM public.chat_messages m
    WHERE (m.sender_id IN (SELECT user_id FROM admin_ids)
        OR m.receiver_id IN (SELECT user_id FROM admin_ids))
      AND m.message NOT LIKE '🤖 KI-Eskalation%'
      AND m.message NOT LIKE '🤖 KI Eskalation%'
      AND m.message NOT LIKE '[ESCALATE]%'
  ),
  filtered AS (
    SELECT r.* FROM relevant r
    LEFT JOIN public.profiles p ON p.user_id = r.partner_id
    WHERE r.partner_id IS NOT NULL
      AND r.partner_id NOT IN (SELECT user_id FROM admin_ids)
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.staff_can_access_tenant(auth.uid(), p.tenant_id)
      )
  ),
  last_reply AS (
    SELECT f.partner_id, MAX(f.created_at) AS at
    FROM filtered f
    WHERE f.sender_id <> f.partner_id
      AND NOT COALESCE(f.is_system, false)
      AND NOT (
        f.message LIKE '✅%' OR f.message LIKE '🎓%' OR f.message LIKE '📋%'
        OR f.message LIKE '💰%' OR f.message LIKE '⚠️%' OR f.message LIKE '🎉%'
        OR f.message LIKE '📅%' OR f.message LIKE '✍️%' OR f.message LIKE '📩%'
        OR f.message LIKE 'Neuer Auftrag:%'
        OR f.message IN ('Vertrag unterschrieben!', 'Einführung abgeschlossen!', 'Verifizierung bestätigt!')
        OR f.message LIKE '%Willkommen im Team!%'
      )
    GROUP BY f.partner_id
  ),
  open_cases AS (
    SELECT
      f.partner_id,
      MIN(f.created_at) AS open_since,
      COUNT(*) AS open_count,
      (ARRAY_AGG(f.message ORDER BY f.created_at DESC))[1] AS open_preview
    FROM filtered f
    LEFT JOIN last_reply lr ON lr.partner_id = f.partner_id
    WHERE f.sender_id = f.partner_id
      AND (lr.at IS NULL OR f.created_at > lr.at)
    GROUP BY f.partner_id
  )
  SELECT
    f.partner_id,
    (ARRAY_AGG(f.message ORDER BY f.created_at DESC))[1] AS last_message,
    MAX(f.created_at) AS last_at,
    COUNT(*) FILTER (WHERE f.sender_id = f.partner_id AND f.read = false) AS unread,
    MAX(f.created_at) FILTER (WHERE f.sender_id = f.partner_id) AS last_from_partner_at,
    MAX(o.open_since) AS open_since,
    COALESCE(MAX(o.open_count), 0) AS open_count,
    MAX(o.open_preview) AS open_preview
  FROM filtered f
  LEFT JOIN open_cases o ON o.partner_id = f.partner_id
  GROUP BY f.partner_id;
$$;

REVOKE ALL ON FUNCTION public.list_chat_conversations() FROM public;
GRANT EXECUTE ON FUNCTION public.list_chat_conversations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_chat_conversations() TO service_role;
