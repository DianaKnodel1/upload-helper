#!/usr/bin/env bash
# =============================================================================
#  cleanup-before-date.sh — Bewerber + Mitarbeiter vor einem Stichtag löschen
# =============================================================================
#  Auf dem BACKEND-Server ausführen (dort läuft der Container supabase-db).
#
#   Vorschau (löscht nichts):   bash scripts/cleanup-before-date.sh 2026-08-01
#   Wirklich löschen:           bash scripts/cleanup-before-date.sh 2026-08-01 --execute
#
#  Gelöscht wird alles, was VOR dem Stichtag angelegt wurde:
#   - Bewerbungen (applications.created_at < Stichtag)
#   - Mitarbeiter-Konten (profiles.created_at < Stichtag) inkl. Login,
#     Chats, Verträge, Dokumente, Aufgaben, Termine, KYC, Dateien
#  Chatnachrichten werden ausschließlich nach ihrem Datum gelöscht (vor Stichtag).
#  Alte Konten mit Chatnachrichten ab Stichtag bleiben samt Verknüpfungen erhalten,
#  damit neuere Chats weiterhin im Portal sichtbar und zuordenbar sind.
#  Bleibt immer: Konten mit Admin-Rolle (alles außer 'user'), Firmen,
#  Vorlagen, Landingpages, Einstellungen, Indeed-Leads (lead_*), alles ab Stichtag.
#  Alles läuft in EINER Transaktion: bei einem Fehler wird nichts gelöscht.
#  Vorher unbedingt ein frisches Backup ziehen. Rückweg nur via scripts/restore.sh.
# =============================================================================
set -euo pipefail

CUTOFF="${1:-}"
MODE="${2:-}"
DB_CT="${BACKEND_DB_CONTAINER:-supabase-db}"

if ! [[ "$CUTOFF" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "Aufruf: bash scripts/cleanup-before-date.sh JJJJ-MM-TT [--execute]" >&2
  exit 1
fi
docker inspect "$DB_CT" >/dev/null 2>&1 || { echo "✗ Container $DB_CT nicht gefunden." >&2; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="/var/log/portal-cleanup-${STAMP}.log"
CSV="/root/portal-cleanup-${STAMP}-betroffene.csv"
touch "$LOG" 2>/dev/null || LOG="/tmp/portal-cleanup-${STAMP}.log"

FINISH="ROLLBACK"
if [ "$MODE" = "--execute" ]; then
  echo
  echo "⚠  Es werden ALLE Bewerber und Mitarbeiter vor dem $CUTOFF endgültig gelöscht."
  echo "   Ist ein frisches Backup vorhanden? Zum Fortfahren LÖSCHEN eintippen:"
  read -r ANSWER
  [ "$ANSWER" = "LÖSCHEN" ] || { echo "Abgebrochen."; exit 1; }
  FINISH="COMMIT"
fi

PSQL=(docker exec -i "$DB_CT" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q)

# --- Liste der Betroffenen als CSV (zum Durchsehen) -------------------------
"${PSQL[@]}" -c "\copy (
  SELECT 'bewerbung' AS art, a.id::text, a.full_name, a.email, a.created_at::date, t.name AS firma
    FROM public.applications a LEFT JOIN public.tenants t ON t.id = a.tenant_id
   WHERE a.created_at < '$CUTOFF'
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.application_id = a.id
       AND (p.created_at >= '$CUTOFF'
         OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role::text <> 'user')
         OR EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.created_at >= '$CUTOFF'
           AND (m.sender_id = p.user_id OR m.receiver_id = p.user_id))))
  UNION ALL
  SELECT 'mitarbeiter', p.user_id::text, p.full_name, u.email, p.created_at::date, t.name
    FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
    LEFT JOIN public.tenants t ON t.id = p.tenant_id
   WHERE p.created_at < '$CUTOFF'
     AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role::text <> 'user')
     AND NOT EXISTS (SELECT 1 FROM public.chat_messages m
       WHERE m.created_at >= '$CUTOFF' AND (m.sender_id = p.user_id OR m.receiver_id = p.user_id))
     AND NOT EXISTS (SELECT 1 FROM public.applications a WHERE a.id = p.application_id AND a.created_at >= '$CUTOFF')
  ORDER BY 1, 5
) TO STDOUT WITH CSV HEADER" > "$CSV" 2>>"$LOG" || echo "(CSV-Liste konnte nicht vollständig erstellt werden, siehe $LOG)"

# --- Löschen (bzw. Probelauf) ------------------------------------------------
{
cat <<SQL
BEGIN;
-- Einheitlicher Stand für Auswahl und Löschung; keine parallelen neuen Chats.
LOCK TABLE public.chat_messages IN SHARE ROW EXCLUSIVE MODE;
SET LOCAL session_replication_role = replica;  -- Reihenfolge der Verknüpfungen egal

CREATE TEMP TABLE del_users ON COMMIT DROP AS
  SELECT p.user_id AS id FROM public.profiles p
   WHERE p.created_at < '$CUTOFF'
     AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role::text <> 'user')
     AND NOT EXISTS (SELECT 1 FROM public.chat_messages m
       WHERE m.created_at >= '$CUTOFF' AND (m.sender_id = p.user_id OR m.receiver_id = p.user_id));
CREATE TEMP TABLE del_apps ON COMMIT DROP AS
  SELECT a.id FROM public.applications a
   WHERE a.created_at < '$CUTOFF';
-- Auch ein älteres Konto bleibt, wenn es zu einer neueren Bewerbung gehört.
DELETE FROM del_users d USING public.profiles p, public.applications a
 WHERE p.user_id = d.id AND p.application_id = a.id AND a.created_at >= '$CUTOFF';
-- Bewerbungen, deren Mitarbeiter-Konto bleibt, nicht anfassen
DELETE FROM del_apps d USING public.profiles p
 WHERE p.application_id = d.id AND p.user_id NOT IN (SELECT id FROM del_users);

DO \$\$
DECLARE r record; n bigint; total bigint := 0;
BEGIN
  RAISE NOTICE 'Mitarbeiter-Konten: %', (SELECT count(*) FROM del_users);
  RAISE NOTICE 'Bewerbungen:        %', (SELECT count(*) FROM del_apps);
  RAISE NOTICE 'Alte Konten mit neueren Chats bleiben: %', (
    SELECT count(*) FROM public.profiles p WHERE p.created_at < '$CUTOFF'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles roles WHERE roles.user_id = p.user_id AND roles.role::text <> 'user')
    AND EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.created_at >= '$CUTOFF'
      AND (m.sender_id = p.user_id OR m.receiver_id = p.user_id)));
  DELETE FROM public.chat_messages WHERE created_at < '$CUTOFF';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'Chatnachrichten vor Stichtag: %', n;
  FOR r IN
    SELECT c.table_name, c.column_name
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
       AND c.table_name NOT LIKE 'lead\_%'
       AND c.table_name NOT IN ('tenants','system_settings','applications','profiles','user_roles','chat_messages')
       AND c.column_name IN ('user_id','sender_id','receiver_id','employee_id','recipient_id','application_id')
     ORDER BY c.table_name, c.column_name
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE %I IN (SELECT id FROM %s)',
      r.table_name, r.column_name,
      CASE WHEN r.column_name = 'application_id' THEN 'del_apps' ELSE 'del_users' END);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE '  %.%: %', r.table_name, r.column_name, n; END IF;
  END LOOP;

  DELETE FROM storage.objects o
   WHERE o.owner IN (SELECT id FROM del_users)
      OR EXISTS (SELECT 1 FROM del_users u WHERE o.name LIKE u.id::text || '/%')
      OR EXISTS (SELECT 1 FROM del_apps a WHERE o.name LIKE a.id::text || '/%');
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'Dateien:            %', n;

  DELETE FROM public.user_roles   WHERE user_id IN (SELECT id FROM del_users);
  DELETE FROM public.profiles     WHERE user_id IN (SELECT id FROM del_users);
  DELETE FROM public.applications WHERE id      IN (SELECT id FROM del_apps);
  DELETE FROM auth.users          WHERE id      IN (SELECT id FROM del_users);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'Logins zur Löschung ausgewählt: %', n;
END \$\$;
$FINISH;
SQL
} | "${PSQL[@]}" 2>&1 | sed 's/^psql:.*NOTICE:  //' | tee -a "$LOG"

echo
echo "Liste der Betroffenen: $CSV"
echo "Protokoll:             $LOG"
if [ "$FINISH" = "ROLLBACK" ]; then
  echo "➜ Das war nur die VORSCHAU, nichts wurde gelöscht."
  echo "  Wirklich löschen: bash scripts/cleanup-before-date.sh $CUTOFF --execute"
else
  echo "✓ Gelöscht."
fi
