#!/usr/bin/env bash
# =============================================================================
#  backup-verify.sh — Prüfungen für den Backup-Server
#
#    bash scripts/backup-verify.sh dump <ordner-mit-db.dump>   Dump lesbar & vollständig?
#    bash scripts/backup-verify.sh disk <backup-dir>           Platte unter Grenzwert?
#    bash scripts/backup-verify.sh watchdog                    Letztes erfolgreiches Backup zu alt?
#                                                              (+ Platte, Alarm bei Problem)
# =============================================================================
set -uo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"
[ -f scripts/backup-orchestrator.env ] && . scripts/backup-orchestrator.env
# shellcheck disable=SC1091
. scripts/backup-lib.sh

cmd="${1:-}"

check_dump() {
  local dir="$1" dump="$1/db.dump"
  [ -s "$dump" ] || { echo "✗ db.dump fehlt oder leer" >&2; return 1; }
  head -c 5 "$dump" | grep -q PGDMP || { echo "✗ db.dump ist kein pg_dump-Archiv" >&2; return 1; }
  local toc
  if command -v pg_restore >/dev/null; then
    toc=$(pg_restore -l "$dump" 2>/dev/null) || { echo "✗ pg_restore kann den Dump nicht lesen" >&2; return 1; }
  else
    toc=$(docker run --rm -i postgres:15-alpine pg_restore -l < "$dump" 2>/dev/null) || toc=""
  fi
  if [ -n "$toc" ]; then
    for t in "public applications" "public profiles" "auth users" "storage objects"; do
      echo "$toc" | grep -q "TABLE DATA ${t% *} ${t#* }" || { echo "✗ Tabelle ${t/ /.} fehlt im Dump" >&2; return 1; }
    done
  else
    echo "  · pg_restore nicht verfügbar — nur Kopf geprüft" >&2
  fi
  if [ -f "$dir/counts.txt" ]; then
    local tables apps
    tables=$(grep -oP 'tables_public=\K\d+' "$dir/counts.txt" || echo 0)
    apps=$(grep -oP 'applications=\K\d+' "$dir/counts.txt" || echo 0)
    [ "$tables" -ge "${MIN_PUBLIC_TABLES:-20}" ] || { echo "✗ nur ${tables} Tabellen in public" >&2; return 1; }
    # Plötzlicher Einbruch der Bewerbungen (>50 %) gegenüber letztem Lauf = verdächtig
    local prev_file="${BACKUP_DIR:-/var/backups/portal}/logs/last-counts.txt"
    if [ -f "$prev_file" ]; then
      local prev
      prev=$(grep -oP 'applications=\K\d+' "$prev_file" || echo 0)
      if [ "$prev" -gt 0 ] && [ "$apps" -lt $(( prev / 2 )) ]; then
        echo "✗ Bewerbungen von ${prev} auf ${apps} gefallen" >&2; return 1
      fi
    fi
    cp "$dir/counts.txt" "$prev_file" 2>/dev/null || true
  fi
  return 0
}

check_disk() {
  local used
  used=$(df -P "$1" | awk 'NR==2{gsub("%","",$5); print $5}')
  echo "  · Platte: ${used}% belegt"
  [ "$used" -lt "${DISK_ALERT_PERCENT:-80}" ]
}

watchdog() {
  local f="${BACKUP_DIR}/logs/last-success.json" max_h="${MAX_BACKUP_AGE_HOURS:-12}"
  if [ ! -f "$f" ]; then
    send_alert "❌ Noch kein erfolgreiches Backup auf $(hostname)"; return 1
  fi
  local age_h=$(( ( $(date +%s) - $(stat -c %Y "$f") ) / 3600 ))
  local rc=0
  if [ "$age_h" -ge "$max_h" ]; then
    send_alert "❌ Letztes erfolgreiches Backup ist ${age_h} h alt ($(hostname))"; rc=1
  fi
  if ! check_disk "${BACKUP_DIR}" >/dev/null; then
    send_alert "⚠️ Backup-Platte über ${DISK_ALERT_PERCENT:-80}% voll ($(hostname))"; rc=1
  fi
  [ $rc -eq 0 ] && echo "✓ Letztes Backup vor ${age_h} h, Platte OK"
  return $rc
}

case "$cmd" in
  dump) check_dump "${2:?Ordner fehlt}" ;;
  disk) check_disk "${2:?Ordner fehlt}" ;;
  watchdog) watchdog ;;
  *) echo "Nutzung: $0 dump <dir> | disk <dir> | watchdog" >&2; exit 2 ;;
esac
