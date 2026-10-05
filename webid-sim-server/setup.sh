#!/usr/bin/env bash
# =============================================================================
#  setup.sh — Erst-Setup für WebID-Simulations-Proxy (Cloudflare-Modus)
# =============================================================================
#  Installiert:
#    1. Node.js + Bun (Build) + Caddy + git
#    2. Kopiert webid-sim-server nach /opt/apps/webid-sim
#    3. .env mit SUPABASE_URL + ANON_KEY + SIM_BASE_DOMAIN
#    4. systemd-Service `webid-sim.service` (Node.js auf 127.0.0.1:3002)
#    5. Caddy mit Cloudflare-Origin-Zertifikat (kein Let's Encrypt nötig)
#
#  Vorab nötig (manuell, einmalig):
#    - Cloudflare: SSL/TLS → Origin Server → Zertifikat erstellen
#      (Hosts: webid-portal.de, *.webid-portal.de, 15 Jahre)
#    - Zertifikat nach /etc/caddy/origin.crt, Key nach /etc/caddy/origin.key
#    - Cloudflare SSL-Modus: Full (Strict), DNS * und @ → orange Wolke
#
#  Pflicht-Env vor Aufruf:
#    SUPABASE_URL=https://supabase.deine-domain.de
#    SUPABASE_PUBLISHABLE_KEY=<anon-key>
#    SIM_BASE_DOMAIN=webid-portal.de
#
#  Optional:
#    PROJECT_DIR=/opt/apps/webid-sim
#    SIM_WILDCARD_DOMAIN=webid-portal.com   # alle *.webid-portal.com → Simulation
#    DEFAULT_TARGET_ORIGIN=https://webid-gateway.de
# =============================================================================
set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL nicht gesetzt}"
: "${SUPABASE_PUBLISHABLE_KEY:?SUPABASE_PUBLISHABLE_KEY nicht gesetzt}"
: "${SIM_BASE_DOMAIN:?SIM_BASE_DOMAIN nicht gesetzt (z. B. webid-portal.de)}"

PROJECT_DIR="${PROJECT_DIR:-/opt/apps/webid-sim}"
DEFAULT_TARGET_ORIGIN="${DEFAULT_TARGET_ORIGIN:-https://webid-gateway.de}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }
ok()  { printf "\033[1;32m  ✓ %s\033[0m\n" "$*"; }

log "1/4  Node.js + Bun + Caddy sicherstellen"
if command -v apt-get >/dev/null; then
  apt-get update
  apt-get install -y curl unzip git nodejs debian-keyring debian-archive-keyring apt-transport-https ca-certificates
  if ! command -v caddy >/dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
  fi
fi
if ! command -v bun >/dev/null; then
  curl -fsSL https://bun.sh/install | bash
  ln -sf /root/.bun/bin/bun /usr/local/bin/bun
fi
ok "Node.js + Bun + Caddy vorhanden"

log "2/4  Code nach $PROJECT_DIR"
mkdir -p "$PROJECT_DIR"
cp -a "$SCRIPT_DIR/." "$PROJECT_DIR/"
cd "$PROJECT_DIR"
bun install --production >/dev/null 2>&1 || true
bun build server.ts --target=node --outfile=server.js
ok "Code platziert"

log "3/4  .env schreiben"
cat > "$PROJECT_DIR/.env" <<EOF
SUPABASE_URL=$SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
PORT=3002
SIM_BASE_DOMAIN=$SIM_BASE_DOMAIN
DEFAULT_TARGET_ORIGIN=$DEFAULT_TARGET_ORIGIN
EOF
chmod 600 "$PROJECT_DIR/.env"
ok ".env angelegt"

log "4/4  systemd + Caddy"
cat > /etc/systemd/system/webid-sim.service <<EOF
[Unit]
Description=WebID-Simulations-Proxy (Node.js)
After=network.target

[Service]
Type=simple
WorkingDirectory=$PROJECT_DIR
EnvironmentFile=$PROJECT_DIR/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

mkdir -p /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/override.conf <<EOF
[Service]
Environment=SIM_BASE_DOMAIN=$SIM_BASE_DOMAIN
EOF

if [[ ! -s /etc/caddy/origin.crt || ! -s /etc/caddy/origin.key ]]; then
  echo
  echo "⚠️  /etc/caddy/origin.crt bzw. /etc/caddy/origin.key fehlt."
  echo "    Cloudflare → SSL/TLS → Origin Server → Create Certificate:"
  echo "    Hosts: $SIM_BASE_DOMAIN, *.$SIM_BASE_DOMAIN (15 Jahre)"
  echo "    Zertifikat → /etc/caddy/origin.crt, Private Key → /etc/caddy/origin.key"
  echo "    Danach:  chown root:caddy /etc/caddy/origin.crt /etc/caddy/origin.key"
  echo "              chmod 640 /etc/caddy/origin.crt /etc/caddy/origin.key"
else
  # Der Caddy-Dienst läuft als Benutzer caddy und muss Zertifikat sowie Key lesen können.
  chown root:caddy /etc/caddy/origin.crt /etc/caddy/origin.key
  chmod 640 /etc/caddy/origin.crt /etc/caddy/origin.key
fi

# Caddyfile zusammenführen statt überschreiben. Der verwaltete Abschnitt wird
# über Marker ersetzt; alte Sim-Blöcke und der früher angehängte globale
# auto_https-Block werden beim ersten Lauf einmalig bereinigt.
CADDY_TARGET=/etc/caddy/Caddyfile
MANAGED_BEGIN="# BEGIN WEBID-SIM ($SIM_BASE_DOMAIN)"
MANAGED_END="# END WEBID-SIM ($SIM_BASE_DOMAIN)"
if [[ -f "$CADDY_TARGET" ]]; then
  python3 - "$CADDY_TARGET" "$SIM_BASE_DOMAIN" "${SIM_WILDCARD_DOMAIN:-}" <<'PYEOF'
import sys
path, domain, wild = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path) as f:
    text = f.read()

lines = text.splitlines()
kept = []
i = 0
while i < len(lines):
    stripped = lines[i].strip()
    if stripped.startswith('# BEGIN WEBID-SIM'):
        i += 1
        while i < len(lines) and not lines[i].strip().startswith('# END WEBID-SIM'):
            i += 1
        i += 1
        continue

    # Alte, nicht markierte Top-Level-Bloecke vollstaendig erkennen.
    if stripped and not stripped.startswith('#') and '{' in stripped:
        block = []
        depth = 0
        while i < len(lines):
            line = lines[i]
            block.append(line)
            depth += line.count('{') - line.count('}')
            i += 1
            if depth == 0:
                break
        header = block[0].strip()
        body = '\n'.join(block)
        if domain in header or '$SIM_BASE_DOMAIN' in header or '{$SIM_BASE_DOMAIN}' in header or (header == '{' and 'auto_https disable_redirects' in body):
            continue
        # Einzelne Firmen-Bloecke (z. B. testumgebung.<wild>) werden durch den
        # Sammel-Block ersetzt. Die Hauptdomain selbst (Mirror) bleibt erhalten.
        if wild:
            names = [n.strip() for n in header.rstrip('{').split(',')]
            if names and all(n.endswith('.' + wild) for n in names):
                continue
        kept.extend(block)
        continue

    kept.append(lines[i])
    i += 1

with open(path, 'w') as f:
    cleaned = '\n'.join(kept).strip()
    f.write(cleaned + ('\n' if cleaned else ''))
PYEOF
fi
# Nur unseren Site-Block anhaengen. Globale Optionen gehören in Caddy zwingend
# an den Dateianfang und werden deshalb nicht als Modulfragment verwaltet.
{
  echo
  echo "$MANAGED_BEGIN"
  cat "$PROJECT_DIR/Caddyfile"
  echo "$MANAGED_END"
} >> "$CADDY_TARGET"

# Optional: Sammel-Block, damit jede Firmen-Subdomain (z. B. bv-agentur.<domain>)
# sofort funktioniert, ohne eigenen Caddy-Eintrag. Die Hauptdomain bleibt unberührt.
if [[ -n "${SIM_WILDCARD_DOMAIN:-}" ]]; then
  cat >> "$CADDY_TARGET" <<EOF

# BEGIN WEBID-SIM-WILDCARD ($SIM_WILDCARD_DOMAIN)
*.$SIM_WILDCARD_DOMAIN {
	tls /etc/caddy/origin.crt /etc/caddy/origin.key
	encode zstd gzip
	reverse_proxy 127.0.0.1:3002 {
		header_up Host {host}
		header_up X-Real-IP {http.request.header.CF-Connecting-IP}
		header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
		header_up X-Forwarded-Proto https
	}
}
# END WEBID-SIM-WILDCARD ($SIM_WILDCARD_DOMAIN)
EOF
fi
systemctl daemon-reload
systemctl enable webid-sim.service
systemctl restart webid-sim.service
if SIM_BASE_DOMAIN="$SIM_BASE_DOMAIN" caddy validate --config "$CADDY_TARGET"; then
  systemctl enable caddy
  systemctl restart caddy
else
  echo "⚠️  Caddy-Konfiguration ungültig — Caddy wurde nicht neu gestartet."
  echo "    Bitte $CADDY_TARGET prüfen."
fi
sleep 2
systemctl status webid-sim.service --no-pager | head -n 10

ok "Fertig. Test:  curl http://127.0.0.1:3002/_health"
echo
echo "Nicht vergessen: Firewall — Port 443 nur für Cloudflare-IP-Ranges öffnen,"
echo "Port 80 komplett schließen (siehe README)."
