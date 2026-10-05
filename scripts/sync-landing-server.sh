#!/usr/bin/env bash
# =============================================================================
#  sync-landing-server.sh — Push-Deploy auf einen (oder mehrere) Landing-Server
# =============================================================================
# Wird von deploy.sh aufgerufen, kann aber auch manuell laufen:
#   LANDING_SYNC_HOST=uwkconsulting bash scripts/sync-landing-server.sh
#
# Kopiert Renderer und Themes direkt auf den Remote-Server, setzt zusätzlich
# themes_resync_requested_at in der DB und startet die Services neu. Damit
# hängen Theme-Updates nicht davon ab, ob der Heartbeat ein Resync-Flag erhält.
# =============================================================================
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/apps/portal}"
ENV_FILE="$PROJECT_DIR/.env.server"
[ -f "$ENV_FILE" ] || ENV_FILE="$PROJECT_DIR/.env"

env_file_value() {
  local key="$1"
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'
}

LANDING_SYNC_HOST="${LANDING_SYNC_HOST:-$(env_file_value LANDING_SYNC_HOST)}"
LANDING_SYNC_USER="${LANDING_SYNC_USER:-$(env_file_value LANDING_SYNC_USER)}"
LANDING_SYNC_USER="${LANDING_SYNC_USER:-root}"
LANDING_SYNC_PATH="${LANDING_SYNC_PATH:-$(env_file_value LANDING_SYNC_PATH)}"
LANDING_SYNC_PATH="${LANDING_SYNC_PATH:-/opt/landing-server}"
SKIP_LANDING_SYNC="${SKIP_LANDING_SYNC:-0}"
TARGET_DB_URL="${TARGET_DB_URL:-$(env_file_value TARGET_DB_URL)}"

log() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }
ok()  { printf "\033[1;32m  ✓ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m  ! %s\033[0m\n" "$*"; }

if [ "$SKIP_LANDING_SYNC" = "1" ]; then
  warn "Landing-Server-Sync übersprungen (SKIP_LANDING_SYNC=1)"
  exit 0
fi

if [ -z "$LANDING_SYNC_HOST" ]; then
  warn "Landing-Server-Sync übersprungen (LANDING_SYNC_HOST nicht gesetzt)"
  exit 0
fi

REMOTE="${LANDING_SYNC_USER}@${LANDING_SYNC_HOST}"
REMOTE_DIR="$LANDING_SYNC_PATH"

cd "$PROJECT_DIR"

log "Landing-Server-Sync → $REMOTE:$REMOTE_DIR"

# ── 1. Core-Dateien auf den Remote-Server kopieren ──────────────────────────
for f in server.js legal-content.js sections-renderer.js package.json heartbeat.sh; do
  src="$PROJECT_DIR/landing-server/$f"
  if [ ! -f "$src" ]; then
    warn "Quelldatei fehlt: $src — Sync abgebrochen"
    exit 1
  fi
done

# rsync mit --checksum, damit wirklich nur geänderte Dateien übertragen werden
rsync -avz --checksum --no-perms \
  "$PROJECT_DIR/landing-server/server.js" \
  "$PROJECT_DIR/landing-server/legal-content.js" \
  "$PROJECT_DIR/landing-server/sections-renderer.js" \
  "$PROJECT_DIR/landing-server/package.json" \
  "$PROJECT_DIR/landing-server/heartbeat.sh" \
  "$REMOTE:$REMOTE_DIR/"

ok "Core-Dateien übertragen"

# Themes immer direkt übertragen. Ohne TARGET_DB_URL kann das Resync-Flag nicht
# gesetzt werden; früher blieb dadurch trotz erfolgreichem Deploy eine alte
# script.js auf dem Landing-Server liegen.
#
# WICHTIG: Die Rohdateien unter src/landing-themes/ enthalten NICHT das
# Bewerbungsformular. Template/CSS/JS werden erst im Portal zusammengebaut
# (withSharedForm) und über den Files-Endpunkt ausgeliefert. Wir laden daher
# exakt diese fertigen Dateien und übertragen sie; die Assets kommen weiterhin
# direkt aus dem Repo.
if [ ! -d "$PROJECT_DIR/src/landing-themes" ]; then
  warn "Theme-Verzeichnis fehlt: $PROJECT_DIR/src/landing-themes — Sync abgebrochen"
  exit 1
fi

FILES_BASE="${LANDING_FILES_BASE:-$(env_file_value LANDING_FILES_BASE)}"
if [ -z "$FILES_BASE" ]; then
  HB_URL=$(ssh -o ConnectTimeout=10 -o BatchMode=yes "$REMOTE" \
    "grep -E '^HEARTBEAT_URL=' $REMOTE_DIR/.env 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '\"'" || true)
  [ -n "$HB_URL" ] && FILES_BASE="${HB_URL%/landing-server-heartbeat}/landing-server-files"
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
BUILT_OK=false

if [ -n "$FILES_BASE" ]; then
  BUILT_OK=true
  for THEME_DIR in "$PROJECT_DIR"/src/landing-themes/theme-*; do
    [ -d "$THEME_DIR" ] || continue
    TID="$(basename "$THEME_DIR")"
    mkdir -p "$STAGE/$TID"
    for F in template.html style.css script.js; do
      if ! curl -fsSL --max-time 30 "$FILES_BASE/themes/$TID/$F" -o "$STAGE/$TID/$F" \
         || [ ! -s "$STAGE/$TID/$F" ]; then
        warn "Theme-Datei konnte nicht geladen werden: $TID/$F"
        BUILT_OK=false
      fi
    done
    if [ -d "$THEME_DIR/assets" ]; then
      mkdir -p "$STAGE/$TID/assets"
      cp -a "$THEME_DIR/assets/." "$STAGE/$TID/assets/"
    fi
  done
fi

if [ "$BUILT_OK" = true ]; then
  # Sicherung: Formular UND Formular-Stile müssen enthalten sein, sonst nichts anfassen.
  if ! grep -rqs "application-form" "$STAGE"; then
    warn "Fertige Theme-Dateien ohne Bewerbungsformular — Theme-Sync übersprungen"
    BUILT_OK=false
  fi
  for TDIR in "$STAGE"/theme-*; do
    [ -d "$TDIR" ] || continue
    if ! grep -qs "lov-apply-modal" "$TDIR/style.css"; then
      warn "Stildatei ohne Formular-Stile: $(basename "$TDIR")/style.css — Theme-Sync übersprungen"
      BUILT_OK=false
    fi
  done
fi

if [ "$BUILT_OK" = true ]; then
  rsync -avz --checksum --delete --no-perms "$STAGE/" "$REMOTE:$REMOTE_DIR/themes/"
  ssh -o ConnectTimeout=10 -o BatchMode=yes "$REMOTE" \
    "chown -R landing:landing '$REMOTE_DIR/themes' 2>/dev/null || true"
  ok "Fertige Theme-Dateien übertragen (inkl. Bewerbungsformular)"
else
  warn "Theme-Sync übersprungen — Heartbeat holt die Themes vom Portal"
fi

# ── 2. Resync-Flag in der DB setzen (damit der Heartbeat sofort zieht) ──────
DB_UPDATED=false
if [ -n "$TARGET_DB_URL" ]; then
  # Wir kennen den Server anhand Host/IP in landing_servers. Da es nur einen
  # gibt, aktualisieren wir alle Zeilen, die auf diesen Host/IP verweisen.
  HOST_PART="${LANDING_SYNC_HOST%%@*}"
  [ "$HOST_PART" = "$LANDING_SYNC_HOST" ] && HOST_PART=""
  SERVER_HOST="${HOST_PART:-$LANDING_SYNC_HOST}"

  SQL="UPDATE public.landing_servers SET themes_resync_requested_at = now() WHERE hostname = '${SERVER_HOST}' OR ip = '${SERVER_HOST}';"
  if psql "$TARGET_DB_URL" -c "$SQL" >/dev/null 2>&1; then
    ok "themes_resync_requested_at gesetzt"
    DB_UPDATED=true
  else
    warn "DB-Update für themes_resync_requested_at fehlgeschlagen"
  fi
fi

if [ "$DB_UPDATED" = false ]; then
  warn "Kein TARGET_DB_URL — Resync-Flag übersprungen; Themes wurden bereits direkt übertragen"
fi

# ── 3. Services auf dem Remote-Server neustarten ───────────────────────────
ssh -o ConnectTimeout=10 -o BatchMode=yes "$REMOTE" "
set -euo pipefail
chmod +x $REMOTE_DIR/heartbeat.sh

# Heartbeat zuerst neustarten: er macht sofort einen Beat und zieht Themes
systemctl restart landing-heartbeat.service 2>/dev/null || systemctl restart landing-agent.service 2>/dev/null || true

# Renderer danach neustarten, damit neues server.js geladen wird
systemctl restart landing-server.service 2>/dev/null || systemctl restart landing.service 2>/dev/null || true

# Kurz warten, bis der Renderer wieder antwortet
for i in {1..15}; do
  if curl -fsS http://127.0.0.1:3001/_health >/dev/null 2>&1; then
    echo 'HEALTHY'
    exit 0
  fi
  sleep 1
done
echo 'UNHEALTHY'
exit 1
" || { warn "Remote-Health-Check fehlgeschlagen"; exit 1; }

ok "Landing-Server-Dienste laufen"

# ── 4. Sanity-Check: PORTAL_API ist gesetzt? ────────────────────────────────
# Wir prüfen anhand der ersten Domain, die auf dem Server läuft. Falls bekannt,
# kann der Aufrufer eine eigene CHECK_DOMAIN setzen.
CHECK_DOMAIN="${CHECK_DOMAIN:-tb-app.de}"
PORTAL_API=$(ssh -o ConnectTimeout=10 -o BatchMode=yes "$REMOTE" "
  curl -fsS -m 10 'https://${CHECK_DOMAIN}/' 2>/dev/null | grep -oE 'window\.PORTAL_API = \"[^\"]+\"' | head -n1 | grep -oE 'https://[^\"]+' || true
")

if [ -n "$PORTAL_API" ]; then
  ok "window.PORTAL_API = $PORTAL_API"
else
  warn "window.PORTAL_API konnte nicht ermittelt werden (Domain ${CHECK_DOMAIN} liefert keine gültige Konfiguration)"
fi

ok "Landing-Server-Sync abgeschlossen ✅"
