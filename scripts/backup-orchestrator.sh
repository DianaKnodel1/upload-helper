#!/usr/bin/env bash
# =============================================================================
#  backup-orchestrator.sh — Zentraler Backup-Orchestrator (läuft auf dem Backup-Server)
#
#  Der Backup-Server HOLT alle Daten von den Produktions-Servern ab (pull).
#  Die Produktions-Server haben keinen Zugriff auf den Backup-Server.
#
#  Archiv-Aufbau (wird von scripts/restore.sh erwartet):
#    db/db.dump          pg_dump -Fc der Datenbank (inkl. auth-Schema)
#    db/globals.sql      Rollen + Passwörter (pg_dumpall --globals-only)
#    db/schema.sql       nur Struktur (Reserve)
#    db/counts.txt       Tabellen-/Zeilenzahlen zur Plausibilitätsprüfung
#    backend/supabase/   /opt/supabase ohne laufende DB-Rohdaten (inkl. .env, Storage)
#    backend/portal/     /opt/apps/portal vom Backend-Server
#    backend/etc/        nginx/caddy/systemd/letsencrypt/cron
#    frontend/portal/    /opt/apps/portal (inkl. .env, .env.server)
#    frontend/etc/
#    landing/ bot/ webid/  jeweils app/ + etc/
#    MANIFEST.txt
#
#  AUF DEM BACKUP-SERVER ALS ROOT:
#    bash scripts/backup-orchestrator.sh [full]
# =============================================================================
set -Eeuo pipefail

START_MS=$(date +%s%3N)
cd "$(cd "$(dirname "$0")/.." && pwd)"

CONF_FILE="scripts/backup-orchestrator.env"
[ -f "$CONF_FILE" ] || { echo "✗ $CONF_FILE fehlt." >&2; exit 1; }
# shellcheck disable=SC1090
. "$CONF_FILE"
# shellcheck disable=SC1091
. scripts/backup-lib.sh

: "${BACKUP_DIR:?BACKUP_DIR fehlt in $CONF_FILE}"
: "${DB_HOST:?DB_HOST fehlt in $CONF_FILE}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase}"
MIN_ARCHIVE_MB="${MIN_ARCHIVE_MB:-50}"

BACKUP_MODE="${1:-full}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -o BatchMode=yes)
STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="${BACKUP_DIR}/daily/.run-${STAMP}"
mkdir -p "$RUN_DIR" "${BACKUP_DIR}/monthly" "${BACKUP_DIR}/logs"

WARNINGS=()
STATUS="error"
MESSAGE="abgebrochen"
SIZE="0"
ARCHIVE_PATH=""

log()  { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m  ✓ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m  ! %s\033[0m\n" "$*"; WARNINGS+=("$*"); }

ssh_run() { local h="$1"; shift; ssh "${SSH_OPTS[@]}" "root@${h}" "$@"; }
RSYNC=(rsync -a --numeric-ids --delete-excluded --human-readable
  --exclude='.git/' --exclude='node_modules/' --exclude='dist/' --exclude='.output/'
  --exclude='.tanstack/' --exclude='.wrangler/' --exclude='.cache/' --exclude='.pnpm-store/'
  --exclude='.releases/' --exclude='*.log'
  -e "ssh ${SSH_OPTS[*]}")

finish() {
  local rc=$?
  [ "$STATUS" = "success" ] || { STATUS="error"; [ "$MESSAGE" = "abgebrochen" ] && MESSAGE="Abbruch (Exit $rc)"; }
  local dur=$(( $(date +%s%3N) - START_MS ))
  write_local_status "$STATUS" "$MESSAGE" "$STAMP" "$SIZE" "$dur" "${ARCHIVE_PATH##*/}"
  # Bonus: Status auch in die Portal-DB (schlägt still fehl, wenn Backend weg ist)
  local sql="INSERT INTO public.backup_status (host, archive, size, mode, status, backup_host, duration_ms) VALUES ('backup-orchestrator', '${STAMP}', '${SIZE}', '${BACKUP_MODE}', '${STATUS}', '$(hostname)', ${dur});"
  ssh_run "${DB_HOST}" "docker exec ${DB_CONTAINER} psql -U postgres -d postgres -c \"$sql\"" >/dev/null 2>&1 || true
  if [ "$STATUS" != "success" ]; then
    send_alert "❌ Backup FEHLGESCHLAGEN auf $(hostname): ${MESSAGE}"
  elif [ ${#WARNINGS[@]} -gt 0 ]; then
    send_alert "⚠️ Backup OK mit Warnungen ($(hostname), ${SIZE}): ${WARNINGS[*]}"
  fi
  rm -rf "$RUN_DIR"
}
trap finish EXIT

# ── 1/5  Datenbank ──────────────────────────────────────────────────────────
log "1/5  Datenbank von ${DB_HOST}"
mkdir -p "${RUN_DIR}/db"
MESSAGE="Datenbank-Dump fehlgeschlagen"
ssh_run "${DB_HOST}" "docker exec ${DB_CONTAINER} pg_dump -U postgres -Fc postgres" > "${RUN_DIR}/db/db.dump"
ssh_run "${DB_HOST}" "docker exec ${DB_CONTAINER} pg_dumpall -U postgres --globals-only" > "${RUN_DIR}/db/globals.sql" || warn "Rollen-Dump fehlgeschlagen"
ssh_run "${DB_HOST}" "docker exec ${DB_CONTAINER} pg_dump -U postgres --schema-only postgres" > "${RUN_DIR}/db/schema.sql" || warn "Struktur-Dump fehlgeschlagen"
ssh_run "${DB_HOST}" "docker exec ${DB_CONTAINER} psql -U postgres -d postgres -tAc \"SELECT 'tables_public='||count(*) FROM pg_tables WHERE schemaname='public' UNION ALL SELECT 'applications='||(SELECT count(*) FROM public.applications) UNION ALL SELECT 'auth_users='||(SELECT count(*) FROM auth.users)\"" > "${RUN_DIR}/db/counts.txt" || warn "Zeilenzahlen nicht ermittelt"
ok "Dump: $(du -h "${RUN_DIR}/db/db.dump" | cut -f1)"

MESSAGE="Dump-Prüfung fehlgeschlagen"
bash scripts/backup-verify.sh dump "${RUN_DIR}/db" || { MESSAGE="Datenbank-Dump unvollständig/unlesbar"; exit 1; }
ok "Dump geprüft"

# ── 2/5  Backend-Dateien (Supabase-Konfig, Storage, Functions) ──────────────
log "2/5  Backend-Dateien von ${DB_HOST}"
MESSAGE="Backend-Dateien fehlgeschlagen"
mkdir -p "${RUN_DIR}/backend/supabase" "${RUN_DIR}/backend/portal"
# Laufende DB-Rohdaten NICHT kopieren (inkonsistent) — die DB steckt im Dump.
"${RSYNC[@]}" --exclude='volumes/db/data/' --exclude='docker/volumes/db/data/' \
  "root@${DB_HOST}:${SUPABASE_DIR}/" "${RUN_DIR}/backend/supabase/"
"${RSYNC[@]}" "root@${DB_HOST}:/opt/apps/portal/" "${RUN_DIR}/backend/portal/" 2>/dev/null || warn "Backend: /opt/apps/portal fehlt"
pull_etc() {
  local host="$1" dest="$2"
  mkdir -p "$dest"
  for p in /etc/nginx /etc/caddy /etc/systemd/system /etc/letsencrypt /etc/cron.d /var/spool/cron /root/.ssh/authorized_keys; do
    if ssh_run "$host" "test -e $p" 2>/dev/null; then
      mkdir -p "${dest}$(dirname "$p")"
      "${RSYNC[@]}" "root@${host}:${p}" "${dest}$(dirname "$p")/" || warn "${host}: ${p} nicht gesichert"
    fi
  done
  ssh_run "$host" "crontab -l" > "${dest}/crontab.txt" 2>/dev/null || true
}
pull_etc "${DB_HOST}" "${RUN_DIR}/backend/etc"
ok "Backend-Dateien gesichert (Storage: $(du -sh "${RUN_DIR}/backend/supabase" | cut -f1))"

# ── 3/5  Weitere Server ─────────────────────────────────────────────────────
log "3/5  Frontend, Landing, Bot, WebID"
pull_server() {
  local name="$1" host="$2" src="$3"
  [ -z "$host" ] && return 0
  mkdir -p "${RUN_DIR}/${name}/app"
  if "${RSYNC[@]}" "root@${host}:${src}/" "${RUN_DIR}/${name}/app/"; then
    pull_etc "$host" "${RUN_DIR}/${name}/etc"
    ok "${name} (${host})"
  else
    warn "${name} (${host}) nicht erreichbar"
  fi
}
pull_server frontend "${SERVER_PORTAL_HOST:-}"  /opt/apps/portal
pull_server landing  "${SERVER_LANDING_HOST:-}" /opt/apps/landing
pull_server bot      "${SERVER_BOT_HOST:-}"     /opt/apps
pull_server webid    "${SERVER_WEBID_HOST:-}"   /opt/apps/webid-sim
# Einheitlicher Pfad für restore.sh
[ -d "${RUN_DIR}/frontend/app" ] && mv "${RUN_DIR}/frontend/app" "${RUN_DIR}/frontend/portal"

# ── 4/5  Archiv bauen (optional verschlüsselt) ──────────────────────────────
log "4/5  Archiv bauen"
MESSAGE="Archiv konnte nicht gebaut werden"
{
  echo "stamp=${STAMP}"; echo "mode=${BACKUP_MODE}"; echo "created=$(date -Iseconds)"
  echo "db_host=${DB_HOST}"; echo "frontend_host=${SERVER_PORTAL_HOST:-}"
  cat "${RUN_DIR}/db/counts.txt" 2>/dev/null || true
} > "${RUN_DIR}/MANIFEST.txt"

BASE="${BACKUP_DIR}/daily/portal-${STAMP}-${BACKUP_MODE}.tar.gz"
if [ -n "${AGE_PUBLIC_KEY:-}" ] && [ "${AGE_PUBLIC_KEY}" != "age1..." ]; then
  command -v age >/dev/null || { MESSAGE="age nicht installiert, Verschlüsselung unmöglich"; exit 1; }
  ARCHIVE_PATH="${BASE}.age"
  tar -czf - -C "${RUN_DIR}" . | age -r "${AGE_PUBLIC_KEY}" -o "${ARCHIVE_PATH}"
else
  ARCHIVE_PATH="${BASE}"
  warn "Ohne Verschlüsselung (AGE_PUBLIC_KEY leer)"
  tar -czf "${ARCHIVE_PATH}" -C "${RUN_DIR}" .
fi
(cd "$(dirname "$ARCHIVE_PATH")" && sha256sum "$(basename "$ARCHIVE_PATH")" > "$(basename "$ARCHIVE_PATH").sha256")
SIZE=$(du -h "${ARCHIVE_PATH}" | cut -f1)
SIZE_MB=$(( $(stat -c %s "${ARCHIVE_PATH}") / 1024 / 1024 ))
[ "$SIZE_MB" -ge "$MIN_ARCHIVE_MB" ] || warn "Archiv nur ${SIZE_MB} MB (< ${MIN_ARCHIVE_MB} MB erwartet)"
ok "Archiv: ${ARCHIVE_PATH##*/} (${SIZE})"

# ── 5/5  Aufbewahrung + optionale Außer-Haus-Kopie ──────────────────────────
log "5/5  Aufbewahrung"
find "${BACKUP_DIR}/daily" -maxdepth 1 -type f -name 'portal-*' -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete || true
if [ "$(date +%d)" = "01" ] && [ "$(date +%H)" -lt 6 ]; then
  cp -a "${ARCHIVE_PATH}" "${ARCHIVE_PATH}.sha256" "${BACKUP_DIR}/monthly/"
fi
find "${BACKUP_DIR}/monthly" -type f -mtime +"${BACKUP_MONTHLY_RETENTION_DAYS:-92}" -delete || true

if [ -n "${OFFSITE_RSYNC_TARGET:-}" ]; then
  rsync -a -e "ssh ${SSH_OPTS[*]} ${OFFSITE_SSH_OPTS:-}" "${ARCHIVE_PATH}" "${ARCHIVE_PATH}.sha256" "${OFFSITE_RSYNC_TARGET}/" \
    && ok "Außer-Haus-Kopie" || warn "Außer-Haus-Kopie fehlgeschlagen"
fi

bash scripts/backup-verify.sh disk "${BACKUP_DIR}" || warn "Backup-Platte über ${DISK_ALERT_PERCENT:-80}% voll"

STATUS="success"
MESSAGE="OK"
ok "Backup abgeschlossen: ${ARCHIVE_PATH}"
