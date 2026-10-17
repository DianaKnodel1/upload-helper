# Backup-Server & Notfall-Wiederherstellung

Ziel: Wird der Frontend- oder Backend-Server gesperrt, liegt alles auf dem
Backup-Server. Du kaufst neue Server, spielst das Backup ein, stellst DNS um.

**Prinzip:** Der Backup-Server holt alle 6 Stunden die Daten ab. Die
Produktions-Server haben keinen Zugang zum Backup-Server — wird einer gehackt
oder gesperrt, sind die Backups trotzdem sicher.

**Maximaler Datenverlust:** 6 Stunden.

## Was gesichert wird

| Bereich | Inhalt |
|---|---|
| Datenbank | Kompletter Dump inkl. Logins, Rollen/Passwörter, Struktur-Reserve |
| Dateien | Storage (Verträge, Unterschriften, Ausweise, Bilder), Edge Functions |
| Schlüssel | `/opt/supabase/**/.env` (JWT-Secret, ANON-/SERVICE-Key, SMTP) |
| Frontend | `/opt/apps/portal` inkl. `.env` und `.env.server` |
| Einstellungen | nginx/Caddy, systemd-Dienste, Zertifikate, Cronjobs (jeder Server) |
| Weitere | Landing-, Bot-, WebID-Server (falls eingetragen) |

Aufbewahrung: 14 Tage alle 6 h + Monats-Sicherungen 3 Monate.

---

## Teil 1 — Backup-Server einrichten (einmalig)

**Server:** Ubuntu 24.04, 2+ Kerne, 4+ GB RAM, mind. 90 GB Platte,
möglichst anderer Anbieter als Frontend/Backend.

### 1. Code holen
```bash
apt update && apt install -y git
git clone https://github.com/DianaKnodel1/upload-helper.git /opt/apps/portal
cd /opt/apps/portal
```

### 2. Konfiguration anlegen
```bash
bash scripts/install-backup-orchestrator.sh     # legt beim ersten Mal die .env an
nano scripts/backup-orchestrator.env
```
Eintragen: `DB_HOST` (Backend-IP), `SERVER_PORTAL_HOST` (Frontend-IP),
optional Landing/Bot/WebID.

### 3. Verschlüsselung (empfohlen)
```bash
apt install -y age
age-keygen -o /root/key.txt
cat /root/key.txt
```
- Die **ganze Ausgabe** (Zeile `AGE-SECRET-KEY-…`) in den Passwortmanager.
- Die Zeile `# public key: age1…` → `AGE_PUBLIC_KEY=age1…` in die .env.
- Danach: `rm /root/key.txt` — der Backup-Server selbst kann die Backups dann
  nicht entschlüsseln. Ohne diesen Schlüssel ist kein Restore möglich!

### 4. Alarm (empfohlen)
Telegram: bei @BotFather einen Bot anlegen → Token. Dem Bot einmal schreiben,
Chat-ID über @userinfobot holen. Beides in `ALERT_TELEGRAM_BOT_TOKEN` /
`ALERT_TELEGRAM_CHAT_ID`. Alarm kommt bei Fehler, wenn das letzte Backup älter
als 12 h ist oder die Platte zu 80 % voll ist.

### 5. Installieren
```bash
bash scripts/install-backup-orchestrator.sh
```
Das Skript zeigt einen SSH-Schlüssel. Auf **Backend- und Frontend-Server**:
```bash
echo "ssh-ed25519 AAAA… backup@…" >> /root/.ssh/authorized_keys
```
Dann das Installationsskript noch einmal starten — alle Server müssen
„erreichbar“ melden.

### 6. Erster Lauf und Kontrolle
```bash
bash scripts/backup-orchestrator.sh full
ls -lh /var/backups/portal/daily/
cat /var/backups/portal/logs/latest.json
bash scripts/restore.sh inspect /var/backups/portal/daily/<archiv>
```

### 7. Probe-Wiederherstellung (wichtig!)
Einmal einen günstigen Testserver mieten und Teil 2 (Backend) durchspielen —
ohne DNS umzustellen. Erst dann weißt du sicher, dass das Backup funktioniert.

---

## Teil 2 — Notfall: Server gesperrt

### 1. Neue Server bestellen
- Backend: Ubuntu 24.04, 4 Kerne, 8 GB RAM, 160 GB
- Frontend: Ubuntu 24.04, 2 Kerne, 4 GB RAM, 40 GB

### 2. Neuester Stand vom Backup-Server holen
```bash
# auf dem Backup-Server
ls -t /var/backups/portal/daily/portal-* | head -2
scp /var/backups/portal/daily/<archiv>{,.sha256} root@<NEU-BACKEND>:/root/
scp /var/backups/portal/daily/<archiv>{,.sha256} root@<NEU-FRONTEND>:/root/
```

### 3. Neuer Backend-Server
```bash
apt update && apt install -y git age postgresql-client
curl -fsSL https://get.docker.com | sh
git clone https://github.com/DianaKnodel1/upload-helper.git /opt/apps/portal
cd /opt/apps/portal
bash scripts/restore.sh backend /root/<archiv>
```
Den age-Schlüssel aus dem Passwortmanager einfügen, wenn gefragt. Das Skript
spielt Supabase mit den **alten Schlüsseln** ein (alle Logins bleiben gültig),
startet die Datenbank und lädt alle Daten. Am Ende zeigt es die Anzahl der
Bewerbungen und Logins — mit den Zahlen „laut Backup“ vergleichen.

### 4. Neuer Frontend-Server
```bash
apt update && apt install -y git age
git clone https://github.com/DianaKnodel1/upload-helper.git /opt/apps/portal
cd /opt/apps/portal
bash scripts/setup-server2.sh          # Node/Bun, Grundeinrichtung
bash scripts/restore.sh frontend /root/<archiv>
```

### 5. DNS bei Cloudflare umstellen
- `mb-portal.com` und `www` → neue Frontend-IP
- `api.mb-portal.com` → neue Backend-IP
- Landing-Domains zeigen auf den Landing-Server (nur ändern, wenn auch der weg ist)

### 6. Prüfen
```bash
curl -s https://api.mb-portal.com/auth/v1/health
curl -I https://mb-portal.com
```
Im Browser: Login, Chat, Vertrag mit Unterschrift öffnen, eine Landing-Page,
eine Testbewerbung.

### 7. Nacharbeiten
- `scripts/backup-orchestrator.env` auf dem Backup-Server: neue IPs eintragen
  und den SSH-Schlüssel des Backup-Servers auf den neuen Servern hinterlegen.
- Weitere IP-Stellen: siehe `docs/SERVER-UMZUG.md`, Phase 5.
- Neuer Mail-Anbieter/IP: SPF/DKIM prüfen.

---

## Nützliche Befehle (Backup-Server)

| Was | Befehl |
|---|---|
| Letzter Status | `cat /var/backups/portal/logs/latest.json` |
| Verlauf | `tail /var/backups/portal/logs/history.jsonl` |
| Nächste Läufe | `systemctl list-timers 'backup-*'` |
| Protokoll | `journalctl -u backup-orchestrator -n 100` |
| Manuell sichern | `bash scripts/backup-orchestrator.sh full` |
| Wächter testen | `bash scripts/backup-verify.sh watchdog` |
| Archiv ansehen | `bash scripts/restore.sh inspect <archiv>` |
