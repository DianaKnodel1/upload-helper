#!/usr/bin/env bash
# Liest .env, schickt alle 60s einen Heartbeat und lädt Themes bei Bedarf neu.
# Wichtig: Der Heartbeat läuft auch dann weiter, wenn der Renderer gerade kaputt ist.
set -euo pipefail
[ -f /opt/landing-server/.env ] && set -a && . /opt/landing-server/.env && set +a
THEMES_DIR=/opt/landing-server/themes
AGENT_VERSION="1.4.0"

if [ -z "${SERVER_FILES_BASE:-}" ]; then
  SERVER_FILES_BASE="${HEARTBEAT_URL%/landing-server-heartbeat}/landing-server-files"
fi

log() { echo "[heartbeat] $*" >&2; }

# Prüft, ob eine heruntergeladene Datei valide aussieht (nicht HTML-Fehlerseite)
validate_js() {
  local f="$1"
  [ -s "$f" ] || return 1
  if head -c 64 "$f" | grep -qi '<!DOCTYPE html|<html|404|502|503'; then
    log "Download $f enthält HTML/Fehlerseite — verworfen"
    return 1
  fi
  return 0
}

# Einzelne Datei mit Retry herunterladen
curl_with_retry() {
  local url="$1" out="$2" tries="${3:-3}"
  rm -f "$out"
  for i in $(seq 1 "$tries"); do
    if curl -fsSL --max-time 30 "$url" -o "$out" 2>/dev/null && validate_js "$out"; then
      return 0
    fi
    rm -f "$out"
    sleep $((i * 2))
  done
  return 1
}

resync_themes() {
  log "Resync angefordert — lade Themes + Renderer-Dateien neu …"
  mkdir -p "$THEMES_DIR"

  THEMES_JSON=$(curl -fsSL --max-time 30 "$SERVER_FILES_BASE/themes.json" 2>/dev/null || echo '{"themes":[]}')
  if ! echo "$THEMES_JSON" | head -c 64 | grep -q '["themes"|"themes"'; then
    log "themes.json ungültig — überspringe Theme-Sync"
    THEMES_JSON='{"themes":[]}'
  fi

  echo "$THEMES_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{JSON.parse(s).themes.forEach(t=>console.log(t))}catch(e){console.error("parse themes",e.message)}})' | while read -r THEME_ID; do
    [ -z "$THEME_ID" ] && continue
    mkdir -p "$THEMES_DIR/$THEME_ID"
    for F in template.html style.css script.js; do
      curl -fsSL --max-time 30 "$SERVER_FILES_BASE/themes/$THEME_ID/$F" -o "$THEMES_DIR/$THEME_ID/$F" 2>/dev/null || true
    done
    # Assets pro Theme syncen
    mkdir -p "$THEMES_DIR/$THEME_ID/assets"
    ASSETS_JSON=$(curl -fsSL --max-time 30 "$SERVER_FILES_BASE/themes/$THEME_ID/assets.json" 2>/dev/null || echo '{"files":[]}')
    echo "$ASSETS_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{JSON.parse(s).files.forEach(f=>console.log(f))}catch(e){console.error("parse assets",e.message)}})' | while read -r ASSET_FILE; do
      [ -z "$ASSET_FILE" ] && continue
      curl -fsSL --max-time 30 "$SERVER_FILES_BASE/themes/$THEME_ID/assets/$ASSET_FILE" -o "$THEMES_DIR/$THEME_ID/assets/$ASSET_FILE" 2>/dev/null || true
    done
  done

  # Renderer-Dateien zusätzlich syncen (server.js braucht legal-content.js und
  # ggf. sections-renderer.js; nur gemeinsam austauschen)
  local UPDATED=false
  if curl_with_retry "$SERVER_FILES_BASE/server.js" /opt/landing-server/server.js.new 3 \
    && curl_with_retry "$SERVER_FILES_BASE/legal-content.js" /opt/landing-server/legal-content.js.new 3; then
    # Baukasten-Renderer mitaustauschen, wenn das neue server.js ihn referenziert
    if grep -q 'sections-renderer\.js' /opt/landing-server/server.js.new; then
      curl_with_retry "$SERVER_FILES_BASE/sections-renderer.js" /opt/landing-server/sections-renderer.js.new 3 || true
    fi
    if grep -q 'legal-content.js' /opt/landing-server/server.js.new \
      && { ! grep -q 'sections-renderer\.js' /opt/landing-server/server.js.new || [ -s /opt/landing-server/sections-renderer.js.new ]; }; then
      mv /opt/landing-server/legal-content.js.new /opt/landing-server/legal-content.js
      if [ -s /opt/landing-server/sections-renderer.js.new ]; then
        mv /opt/landing-server/sections-renderer.js.new /opt/landing-server/sections-renderer.js
      fi
      mv /opt/landing-server/server.js.new /opt/landing-server/server.js
      chown landing:landing /opt/landing-server/server.js /opt/landing-server/legal-content.js /opt/landing-server/sections-renderer.js 2>/dev/null || true
      log "Renderer-Dateien aktualisiert"
      UPDATED=true
    else
      log "server.js unerwartet bzw. sections-renderer.js fehlt — überspringe Renderer-Update"
      rm -f /opt/landing-server/server.js.new /opt/landing-server/legal-content.js.new /opt/landing-server/sections-renderer.js.new
    fi
  else
    log "Download von server.js/legal-content.js fehlgeschlagen — Renderer-Dateien bleiben unverändert"
    rm -f /opt/landing-server/server.js.new /opt/landing-server/legal-content.js.new /opt/landing-server/sections-renderer.js.new
  fi

  # Renderer nur neustarten, wenn wir wirklich neue Dateien bekommen haben ODER ein Theme-Update stattfand
  if [ "$UPDATED" = true ] || [ -n "$(ls -A "$THEMES_DIR" 2>/dev/null)" ]; then
    systemctl restart landing-server.service 2>/dev/null || systemctl restart landing.service 2>/dev/null || true
    log "Renderer neu gestartet"
  fi
  log "Resync fertig"
}

while true; do
  COUNT=0
  RENDERER_HEALTHY=false
  if curl -fsS --max-time 10 http://127.0.0.1:3001/_health >/dev/null 2>&1; then
    RENDERER_HEALTHY=true
  fi

  PAYLOAD=$(printf '{"token":"%s","landing_count":%s,"agent_version":"%s","renderer_healthy":%s}' "$BOOTSTRAP_TOKEN" "$COUNT" "$AGENT_VERSION" "$RENDERER_HEALTHY")
  RESP=$(curl -sS --max-time 30 -X POST "$HEARTBEAT_URL" \
    -H 'Content-Type: application/json' \
    --data "$PAYLOAD" \
    2>/dev/null || echo '')

  if echo "$RESP" | grep -q '"resync_needed":true'; then
    resync_themes || log "resync_themes ist fehlgeschlagen, nächster Versuch in 60s"
    # Bestätigung an Portal
    RESYNC_PAYLOAD=$(printf '{"token":"%s","resync_done":true,"agent_version":"%s","renderer_healthy":%s}' "$BOOTSTRAP_TOKEN" "$AGENT_VERSION" "$RENDERER_HEALTHY")
    curl -sS --max-time 30 -X POST "$HEARTBEAT_URL" \
      -H 'Content-Type: application/json' \
      --data "$RESYNC_PAYLOAD" \
      >/dev/null 2>&1 || true
  fi
  sleep 60
done
