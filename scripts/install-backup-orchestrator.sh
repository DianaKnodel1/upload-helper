#!/usr/bin/env bash
# =============================================================================
#  install-backup-orchestrator.sh — Richtet den Backup-Orchestrator auf dem
#  BACKUP-Server ein (Pakete, SSH-Schlüssel, Timer, Wächter).
#
#  AUF DEM BACKUP-SERVER ALS ROOT (im Ordner /opt/apps/portal):
#    bash scripts/install-backup-orchestrator.sh
# =============================================================================
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

log() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }
ok()  { printf "\033[1;32m  ✓ %s\033[0m\n" "$*"; }

if [ ! -f scripts/backup-orchestrator.env ]; then
  cp scripts/backup-orchestrator.env.example scripts/backup-orchestrator.env
  chmod 600 scripts/backup-orchestrator.env
  echo "→ scripts/backup-orchestrator.env wurde angelegt. Bitte ausfüllen (nano scripts/backup-orchestrator.env) und dieses Skript erneut starten."
  exit 1
fi
chmod 600 scripts/backup-orchestrator.env
. scripts/backup-orchestrator.env

log "1/4  Pakete installieren"
if command -v apt-get >/dev/null; then
  apt-get update -qq && apt-get install -y -qq rsync openssh-client age curl postgresql-client
elif command -v dnf >/dev/null; then
  dnf install -y rsync openssh-clients age curl postgresql
fi
ok "rsync, age, pg_restore vorhanden"

log "2/4  SSH-Schlüssel des Backup-Servers"
[ -f /root/.ssh/id_ed25519 ] || ssh-keygen -t ed25519 -N "" -f /root/.ssh/id_ed25519 -C "backup@$(hostname)"
echo "  Diesen Schlüssel auf JEDEM Produktions-Server in /root/.ssh/authorized_keys eintragen:"
echo
cat /root/.ssh/id_ed25519.pub
echo

log "3/4  Verbindungen testen"
for h in "${DB_HOST:-}" "${SERVER_PORTAL_HOST:-}" "${SERVER_LANDING_HOST:-}" "${SERVER_BOT_HOST:-}" "${SERVER_WEBID_HOST:-}"; do
  [ -z "$h" ] && continue
  if ssh -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new "root@$h" true 2>/dev/null; then
    ok "$h erreichbar"
  else
    echo "  ✗ $h noch nicht erreichbar — Schlüssel oben dort eintragen"
  fi
done

log "4/4  Timer aktivieren"
mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/monthly" "${BACKUP_DIR}/logs"
chmod 700 "${BACKUP_DIR}"
chmod +x scripts/backup-orchestrator.sh scripts/backup-verify.sh scripts/restore.sh
cp scripts/systemd/backup-orchestrator.{service,timer} scripts/systemd/backup-watchdog.{service,timer} /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now backup-orchestrator.timer backup-watchdog.timer
ok "Backup alle 6 h, Wächter stündlich"
systemctl list-timers 'backup-*' --no-pager
echo
echo "Ersten Lauf jetzt starten:  bash scripts/backup-orchestrator.sh full"
