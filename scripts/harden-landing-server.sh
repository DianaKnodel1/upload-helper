#!/usr/bin/env bash
# =============================================================================
#  harden-landing-server.sh — Basis-Absicherung des Landing-Servers
#
#  AUF DEM LANDING-SERVER ALS ROOT AUSFÜHREN:
#    bash scripts/harden-landing-server.sh
#
#  Optional:
#    SSH_ALLOW_IP=1.2.3.4 bash scripts/harden-landing-server.sh
#      → SSH nur noch für diese IP erreichbar (dein fester Standort/VPN)
#
#  Macht (alle Schritte idempotent — gefahrlos wiederholbar):
#    1. ufw: Standard "deny incoming", SSH erlaubt, 80/443 NUR für
#       Cloudflare-IP-Bereiche (via update-cloudflare-ips.sh)
#    2. Cloudflare-IP-Liste täglich automatisch aktualisieren (systemd-Timer)
#    3. fail2ban gegen SSH-Bruteforce
#    4. SSH: Passwort-Login aus (nur wenn ein SSH-Key hinterlegt ist),
#       Root-Login nur per Schlüssel
#    5. unattended-upgrades (automatische Sicherheitsupdates)
#
#  WICHTIG VORHER: Stellen Sie sicher, dass der SSH-Zugang per Schlüssel
#  funktioniert (ssh-copy-id), bevor das Skript Passwort-Logins deaktiviert.
# =============================================================================
set -euo pipefail

SSH_PORT="${SSH_PORT:-22}"
SSH_ALLOW_IP="${SSH_ALLOW_IP:-}"
SSH_PORT_CONFIG="${SSH_PORT_CONFIG:-}"
PROJECT_DIR="${PROJECT_DIR:-/opt/apps/portal}"
[ -d "$PROJECT_DIR" ] || PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf "\n\033[1;36m[harden] %s\033[0m\n" "$*"; }
ok()  { printf "\033[1;32m  ✓ %s\033[0m\033[0m\n" "$*"; }
warn(){ printf "\033[1;33m  ! %s\033[0m\n" "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte als root ausführen (sudo bash $0)." >&2; exit 1
fi

# ── 1) Pakete ───────────────────────────────────────────────────────────────
log "1/6 Pakete installieren (ufw, fail2ban, unattended-upgrades)"
if command -v apt-get >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ufw fail2ban unattended-upgrades curl ca-certificates >/dev/null
elif command -v dnf >/dev/null; then
  dnf install -y ufw fail2ban unattended-upgrades curl
else
  echo "Weder apt noch dnf gefunden." >&2; exit 1
fi
ok "Pakete vorhanden"

# ── 2) Cloudflare-IPs: nur CF darf auf 80/443 ────────────────────────────────
log "2/6 Cloudflare-IP-Regeln setzen"
install -m 755 "$PROJECT_DIR/scripts/update-cloudflare-ips.sh" /usr/local/sbin/update-cloudflare-ips.sh
bash /usr/local/sbin/update-cloudflare-ips.sh
ok "80/443 nur noch für Cloudflare offen"

# ── 3) Täglicher IP-Refresh (systemd-Timer) ─────────────────────────────────
log "3/6 Täglicher Cloudflare-IP-Refresh"
cat > /etc/systemd/system/landing-cf-ips.service <<'EOF'
[Unit]
Description=Update Cloudflare IP allowlist (ufw + Caddy trusted_proxies)

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/update-cloudflare-ips.sh
EOF
cat > /etc/systemd/system/landing-cf-ips.timer <<'EOF'
[Unit]
Description=Update Cloudflare IP allowlist daily

[Timer]
OnCalendar=*-*-* 04:17:00
RandomizedDelaySec=600
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now landing-cf-ips.timer >/dev/null 2>&1
ok "Timer aktiv (täglich ~04:17 UTC)"

# ── 4) SSH härten ────────────────────────────────────────────────────────────
log "4/6 SSH härten"
if [ -n "$SSH_PORT_CONFIG" ]; then
  SSH_PORT="$SSH_PORT_CONFIG"
fi

# SSH-Zugang sicherstellen, BEVAL wir das Firewall-Enable machen
if [ -n "$SSH_ALLOW_IP" ]; then
  ufw allow from "$SSH_ALLOW_IP" to any port "$SSH_PORT" proto tcp comment 'ssh-admin' >/dev/null
  ok "SSH-Port $SSH_PORT nur für $SSH_ALLOW_IP erlaubt"
else
  ufw allow "$SSH_PORT/tcp" comment 'ssh' >/dev/null
  warn "SSH ist für alle IPs offen. Besser: SSH_ALLOW_IP=<deine-ip> bash $0"
fi

# Passwort-Login nur abschalten, wenn für root ein SSH-Key existiert
ROOT_KEYS="/root/.ssh/authorized_keys"
if [ -s "$ROOT_KEYS" ] && grep -qE '^(ssh-|ecdsa-|sk-)' "$ROOT_KEYS"; then
  mkdir -p /etc/ssh/sshd_config.d
  cat > /etc/ssh/sshd_config.d/99-hardening.conf <<EOF
PasswordAuthentication no
PermitRootLogin prohibit-password
KbdInteractiveAuthentication no
X11Forwarding no
MaxAuthTries 4
EOF
  # Falls sshd_config den Port ändert, sauber setzen
  if [ "$SSH_PORT" != "22" ]; then
    sed -i "s/^#\?Port .*/Port $SSH_PORT/" /etc/ssh/sshd_config || true
    grep -qE '^Port ' /etc/ssh/sshd_config || printf 'Port %s\n' "$SSH_PORT" >> /etc/ssh/sshd_config
  fi
  if sshd -t 2>/dev/null; then
    systemctl restart sshd 2>/dev/null || systemctl restart ssh || true
    ok "SSH: nur noch Schlüssel-Login (Passwort deaktiviert)"
  else
    rm -f /etc/ssh/sshd_config.d/99-hardening.conf
    warn "sshd-Konfiguration ungültig — Härtung zurückgenommen, nichts geändert."
  fi
else
  warn "Kein SSH-Key für root gefunden — Passwort-Login bleibt (ERST Key einrichten!)."
fi

# ── 5) fail2ban (systemd-Backend, ohne auth.log) ────────────────────────────
log "5/6 fail2ban aktivieren"
cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = $SSH_PORT
backend = systemd
EOF
systemctl enable --now fail2ban >/dev/null 2>&1
systemctl restart fail2ban
ok "fail2ban sperrt IPs nach 5 Fehlversuchen für 1 h"

# ── 6) Automatische Sicherheitsupdates + Firewall scharf schalten ────────────
log "6/6 Automatische Updates + ufw aktivieren"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true

ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw --force enable >/dev/null
systemctl enable ufw >/dev/null 2>&1 || true
ok "ufw aktiv: deny incoming; SSH + Cloudflare-80/443 erlaubt"

log "Fertig — Zusammenfassung:"
ufw status | sed 's/^/  /' | head -n 20
fail2ban-client status sshd 2>/dev/null | sed 's/^/  /' | head -n 8 || true
