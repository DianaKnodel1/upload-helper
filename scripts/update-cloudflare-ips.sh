#!/usr/bin/env bash
# =============================================================================
#  update-cloudflare-ips.sh — Cloudflare-IP-Liste aktuell halten
#
#  1. Lädt die offiziellen Cloudflare-IP-Bereiche (v4 + v6).
#  2. Schreibt sie als ufw-Regeln: NUR Cloudflare darf auf 80/443.
#     Entfernte/neue Bereiche werden sauber ab- bzw. angemeldet.
#  3. Schreibt /etc/caddy/cloudflare-trusted.caddy (trusted_proxies-Snippet),
#     damit Caddy die echte Besucher-IP erkennt — und lädt Caddy neu.
#
#  Läuft als root (direkt, per Cron oder systemd-Timer). Wiederholbar.
# =============================================================================
set -euo pipefail

STATE_DIR="${STATE_DIR:-/var/lib/landing-hardening}"
CADDY_SNIPPET="${CADDY_SNIPPET:-/etc/caddy/cloudflare-trusted.caddy}"
RULE_COMMENT='cf-landing'

log() { printf "[cf-ips] %s\n" "$*"; }

mkdir -p "$STATE_DIR" "$(dirname "$CADDY_SNIPPET")"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4 -o "$TMP/v4"
curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6 -o "$TMP/v6"

# Nur gültige CIDR-Zeilen übernehmen (leerzeichenfrei, mit "/" oder eine IPv4/6)
grep -E '^[0-9a-fA-F:.]+(/[0-9]+)?$' "$TMP/v4" "$TMP/v6" | sed 's/^[^:]*://' | sort -u > "$TMP/ips"
COUNT=$(wc -l < "$TMP/ips")
if [ "$COUNT" -lt 10 ]; then
  log "FEHLER: Nur $COUNT IP-Bereiche geladen — breche ab, ändere nichts."
  exit 1
fi
log "$COUNT Cloudflare-IP-Bereiche geladen"

# ── 1) Caddy-Snippet schreiben (trusted_proxies) ────────────────────────────
{
  printf 'trusted_proxies'
  while IFS= read -r cidr; do printf ' %s' "$cidr"; done < "$TMP/ips"
  printf '\n'
} > "$CADDY_SNIPPET"
chmod 644 "$CADDY_SNIPPET"

# ── 2) ufw-Regeln pflegen ───────────────────────────────────────────────────
if ! command -v ufw >/dev/null; then
  log "ufw nicht installiert — überspringe Firewall-Teil (Caddy-Snippet wurde geschrieben)."
else
  PREV_FILE="$STATE_DIR/ips.prev"
  [ -f "$PREV_FILE" ] || touch "$PREV_FILE"

  # a) cf-landing-Regeln entfernen, deren Bereich nicht mehr in der Liste ist
  #    (Löschen nach Regelnummer, absteigend — robust gegen ufw-Kommentar-Syntax)
  CF_ALT=$(printf '%s|' $(cat "$TMP/ips")); CF_ALT="${CF_ALT%|}"
  mapfile -t STALE_NUMS < <(ufw status numbered \
    | grep -F "$RULE_COMMENT" \
    | grep -vE "(${CF_ALT})" \
    | grep -oE '^\[[ 0-9]+\]' | grep -oE '[0-9]+' | sort -rn)
  for n in "${STALE_NUMS[@]}"; do
    ufw --force delete "$n" >/dev/null 2>&1 || true
    log "Entfernt: Regel #$n (Bereich nicht mehr in der Cloudflare-Liste)"
  done

  # b) Regeln für neue Bereiche hinzufügen (idempotent: nur wenn noch nicht vorhanden)
  while IFS= read -r cidr; do
    [ -n "$cidr" ] || continue
    if ! ufw status | grep -qF "$cidr"; then
      ufw allow from "$cidr" to any port 80,443 proto tcp comment "$RULE_COMMENT" >/dev/null 2>&1 || true
      log "Erlaubt:  $cidr → 80,443"
    fi
  done < "$TMP/ips"

  # c) Falls 80/443 früher pauschal offen waren: schließen
  ufw --force delete allow 80/tcp  >/dev/null 2>&1 || true
  ufw --force delete allow "80"    >/dev/null 2>&1 || true
  ufw --force delete allow 443/tcp >/dev/null 2>&1 || true
  ufw --force delete allow "443"   >/dev/null 2>&1 || true

  ufw reload >/dev/null 2>&1 || true
  cp "$TMP/ips" "$PREV_FILE"
  ok_rules=$(ufw status | grep -cF "$RULE_COMMENT" || true)
  log "ufw: $ok_rules Cloudflare-Regeln aktiv."
fi

# ── 3) Caddy neu laden, falls das Snippet sich geändert hat ─────────────────
if command -v caddy >/dev/null; then
  if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
    systemctl reload caddy 2>/dev/null || systemctl restart caddy 2>/dev/null || true
    log "Caddy neu geladen (trusted_proxies aktuell)."
  else
    log "Caddyfile noch nicht auf Cloudflare-Variante umgestellt — kein Reload."
  fi
fi

log "Fertig."
