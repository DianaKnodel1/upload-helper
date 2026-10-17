#!/usr/bin/env bash
# =============================================================================
#  restore.sh — Spielt ein Backup des Orchestrators auf einem NEUEN Server ein.
#
#    bash scripts/restore.sh backend  <archiv>   Neuer Backend-Server (DB, Storage, Supabase)
#    bash scripts/restore.sh frontend <archiv>   Neuer Frontend-/Portal-Server
#    bash scripts/restore.sh landing|bot|webid <archiv>
#    bash scripts/restore.sh inspect  <archiv>   Nur anzeigen, was im Archiv ist
#
#  Verschlüsselte Archive (*.age): Schlüsseldatei mit AGE_KEY_FILE=/root/key.txt
#  angeben (aus dem Passwortmanager), sonst wird danach gefragt.
# =============================================================================
set -euo pipefail

ROLE="${1:?Nutzung: restore.sh backend|frontend|landing|bot|webid|inspect <archiv>}"
ARCHIVE="${2:?Archiv-Pfad fehlt}"
SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
PROJECT_DIR="${PROJECT_DIR:-/opt/apps/portal}"
WORK="${TMPDIR:-/tmp}/portal-restore-$$"

log()  { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m  ✓ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m  ! %s\033[0m\n" "$*"; }
die()  { printf "\033[1;31m✗ %s\033[0m\n" "$*" >&2; exit 1; }
trap 'rm -rf "$WORK"' EXIT

# ── Archiv prüfen + entpacken ───────────────────────────────────────────────
log "Archiv prüfen"
[ -f "$ARCHIVE" ] || die "Archiv nicht gefunden: $ARCHIVE"
if [ -f "${ARCHIVE}.sha256" ]; then
  (cd "$(dirname "$ARCHIVE")" && sha256sum -c "$(basename "$ARCHIVE").sha256" >/dev/null) || die "Prüfsumme stimmt nicht — Archiv beschädigt"
  ok "Prüfsumme OK"
else
  warn "Keine .sha256-Datei — Prüfsumme übersprungen"
fi
mkdir -p "$WORK/x"
if [[ "$ARCHIVE" == *.age ]]; then
  command -v age >/dev/null || die "age nicht installiert (apt install age)"
  KEY="${AGE_KEY_FILE:-}"
  if [ -z "$KEY" ]; then
    echo "Privaten age-Schlüssel einfügen (Zeile AGE-SECRET-KEY-...), dann Enter:"
    read -rs KEYLINE; echo
    KEY="$WORK/key.txt"; printf '%s\n' "$KEYLINE" > "$KEY"; chmod 600 "$KEY"
  fi
  age -d -i "$KEY" "$ARCHIVE" | tar -xzf - -C "$WORK/x" || die "Entschlüsseln fehlgeschlagen (falscher Schlüssel?)"
else
  tar -xzf "$ARCHIVE" -C "$WORK/x"
fi
X="$WORK/x"
ok "Entpackt"
[ -f "$X/MANIFEST.txt" ] && sed 's/^/  · /' "$X/MANIFEST.txt"

restore_etc() {
  local src="$1"
  [ -d "$src" ] || return 0
  for d in etc/nginx etc/caddy etc/letsencrypt etc/cron.d; do
    [ -d "$src/$d" ] && { mkdir -p "/$d"; cp -a "$src/$d/." "/$d/"; ok "/$d"; }
  done
  if [ -d "$src/etc/systemd/system" ]; then
    # Nur eigene Dienste, keine System-Links
    find "$src/etc/systemd/system" -maxdepth 1 -type f \( -name '*.service' -o -name '*.timer' \) -exec cp -a {} /etc/systemd/system/ \;
    systemctl daemon-reload; ok "systemd-Dienste"
  fi
  if [ -s "$src/crontab.txt" ]; then crontab "$src/crontab.txt" && ok "crontab"; fi
}

case "$ROLE" in
inspect)
  find "$X" -maxdepth 3 -type d | sed "s#$X#  #"
  du -sh "$X"/* ;;

backend)
  [ -f "$X/db/db.dump" ] || die "Kein Datenbank-Dump im Archiv"
  log "1/5  Supabase-Dateien nach ${SUPABASE_DIR}"
  command -v docker >/dev/null || die "Docker fehlt — erst installieren: curl -fsSL https://get.docker.com | sh"
  mkdir -p "$SUPABASE_DIR"
  cp -a "$X/backend/supabase/." "$SUPABASE_DIR/"
  ok "Konfiguration, Schlüssel (.env), Storage-Dateien, Edge Functions"
  [ -d "$X/backend/portal" ] && { mkdir -p "$PROJECT_DIR"; cp -a "$X/backend/portal/." "$PROJECT_DIR/"; ok "$PROJECT_DIR"; }

  log "2/5  Server-Einstellungen"
  restore_etc "$X/backend/etc"

  log "3/5  Supabase starten"
  COMPOSE_DIR="$(dirname "$(find "$SUPABASE_DIR" -maxdepth 2 \( -name docker-compose.yml -o -name compose.yaml \) | head -n1)")"
  [ -n "$COMPOSE_DIR" ] && [ "$COMPOSE_DIR" != "." ] || die "docker-compose.yml unter $SUPABASE_DIR nicht gefunden"
  (cd "$COMPOSE_DIR" && docker compose up -d)
  for i in $(seq 1 60); do docker exec "$DB_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 3; done
  docker exec "$DB_CONTAINER" pg_isready -U postgres >/dev/null || die "Datenbank startet nicht"
  ok "Datenbank läuft"

  log "4/5  Datenbank einspielen"
  HAS=$(docker exec "$DB_CONTAINER" psql -U postgres -d postgres -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public'" || echo 0)
  if [ "${HAS:-0}" -gt 0 ]; then
    warn "Die Datenbank enthält schon ${HAS} Tabellen. Einspielen überschreibt sie."
    read -rp "Wirklich überschreiben? Tippe 'ja': " A; [ "$A" = "ja" ] || die "Abgebrochen"
  fi
  [ -f "$X/db/globals.sql" ] && docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q < "$X/db/globals.sql" >/dev/null 2>&1 || true
  docker exec -i "$DB_CONTAINER" pg_restore -U postgres -d postgres --clean --if-exists --no-owner --role=postgres < "$X/db/db.dump" \
    || warn "pg_restore meldete Hinweise (bei Supabase normal für vorhandene System-Objekte)"
  APPS=$(docker exec "$DB_CONTAINER" psql -U postgres -d postgres -tAc "SELECT count(*) FROM public.applications" 2>/dev/null || echo "?")
  USERS=$(docker exec "$DB_CONTAINER" psql -U postgres -d postgres -tAc "SELECT count(*) FROM auth.users" 2>/dev/null || echo "?")
  ok "Eingespielt: ${APPS} Bewerbungen, ${USERS} Logins"
  grep -E 'applications=|auth_users=' "$X/db/counts.txt" 2>/dev/null | sed 's/^/  · laut Backup: /' || true

  log "5/5  Dienste neu starten"
  (cd "$COMPOSE_DIR" && docker compose restart)
  for s in nginx caddy; do systemctl list-unit-files "$s.service" >/dev/null 2>&1 && systemctl restart "$s" 2>/dev/null && ok "$s"; done
  echo; echo "Test: curl -s https://api.mb-portal.com/auth/v1/health  (nach DNS-Umstellung)" ;;

frontend)
  SRC="$X/frontend/portal"; [ -d "$SRC" ] || die "Kein Frontend im Archiv"
  log "1/3  Portal-Dateien nach ${PROJECT_DIR}"
  mkdir -p "$PROJECT_DIR"; cp -a "$SRC/." "$PROJECT_DIR/"
  ok "Code + .env + .env.server"
  log "2/3  Server-Einstellungen"
  restore_etc "$X/frontend/etc"
  log "3/3  Bauen und starten"
  command -v bun >/dev/null || command -v node >/dev/null || warn "Node/Bun fehlt — erst: bash scripts/setup-server2.sh"
  if [ -f "$PROJECT_DIR/scripts/deploy.sh" ]; then (cd "$PROJECT_DIR" && bash scripts/deploy.sh) || warn "deploy.sh meldete Fehler"; fi
  for s in nginx caddy portal; do systemctl list-unit-files "$s.service" >/dev/null 2>&1 && systemctl restart "$s" 2>/dev/null && ok "$s"; done ;;

landing|bot|webid)
  case "$ROLE" in landing) DEST=/opt/apps/landing;; bot) DEST=/opt/apps;; webid) DEST=/opt/apps/webid-sim;; esac
  [ -d "$X/$ROLE/app" ] || die "Kein ${ROLE} im Archiv"
  mkdir -p "$DEST"; cp -a "$X/$ROLE/app/." "$DEST/"; ok "$DEST"
  restore_etc "$X/$ROLE/etc"
  systemctl daemon-reload ;;

*) die "Unbekannte Rolle: $ROLE" ;;
esac

ok "Fertig."
[ "$ROLE" != inspect ] && echo "Danach in Cloudflare die A-Records auf $(hostname -I | awk '{print $1}') umstellen (siehe docs/DISASTER-RECOVERY.md)."
exit 0
