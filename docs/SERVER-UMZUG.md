# Umzug Frontend- + Backend-Server (Portal & Supabase)

Schritt-für-Schritt-Anleitung zum Wechsel von Portal- und Backend-Server bei
gleichbleibenden Domains (`mb-portal.com` / `api.mb-portal.com`).

Aktueller Stand: Portal `.124`, Backend `.123`, Landing `.234`, WebID-Sim `.224`,
Bot-Server separat.

## Zeitplan

| Phase | Dauer | Ausfallzeit? |
|---|---|---|
| Backup-Server aufsetzen (einmalig, vorab) | 2–3 h | nein |
| Neue Server bestellen + OS installieren | 0,5–2 h | nein |
| Backend parallel aufbauen (Supabase-Stack + Restore) | 2–4 h | nein |
| Frontend parallel aufbauen | 0,5–1 h | nein |
| Testlauf per hosts-Eintrag (ohne DNS-Änderung) | 0,5–1 h | nein |
| **Umschalten: letzter DB-Dump + DNS-Wechsel** | **15–60 Min** | **ja, nur hier** |
| Kontrolle + IP-Referenzen anpassen | 1 h | nein |

**Gesamt ca. ein Arbeitstag, echte Ausfallzeit nur 15–60 Minuten.**

## Grundprinzip

Nicht „umziehen", sondern **nebenbei neu aufbauen und dann umschalten**. Die
alten Server bleiben laufen, bis die neuen fertig getestet sind. Die Datenbank
ist der einzige kritische Teil und wird zuletzt mit einem frischen Dump
übernommen.

---

## Phase 0 — Backup-Server aufsetzen (zuerst)

Backups sind gleichzeitig die Grundlage des Umzugs. Alle Skripte liegen bereits
im Repo.

1. Kleinen VPS bestellen: Ubuntu 22.04/24.04, 2 vCPU, 4 GB RAM, Platte
   mindestens 5× so groß wie die Datenbank. Möglichst anderer Anbieter oder
   anderes Rechenzentrum als Portal/Backend.

2. Auf dem Backup-Server:
   ```bash
   git clone https://github.com/DianaKnodel1/direct-zip-import.git /opt/apps/portal
   cd /opt/apps/portal
   bash scripts/setup-backup-server.sh
   ```

3. Zugriff von Backup-Server auf alle Produktionsserver erlauben — auf dem
   Backup-Server einen Key erzeugen und den öffentlichen Teil auf Portal,
   Backend, Landing, Bot und WebID in `/root/.ssh/authorized_keys` eintragen:
   ```bash
   ssh-keygen -t ed25519 -N "" -f /root/.ssh/id_ed25519   # falls noch keiner da ist
   cat /root/.ssh/id_ed25519.pub
   ```

4. Konfiguration anlegen:
   ```bash
   cp scripts/backup-orchestrator.env.example scripts/backup-orchestrator.env
   ```
   Werte eintragen: `BACKUP_DIR`, `DB_HOST` (Backend), `DB_CONTAINER=supabase-db`,
   `SERVER_PORTAL_HOST`, `SERVER_LANDING_HOST`, `SERVER_BOT_HOST`,
   `SERVER_WEBID_HOST`, `BACKUP_RETENTION_DAYS`.

5. Zeitplan aktivieren (alle 6 Stunden):
   ```bash
   bash scripts/install-backup-orchestrator.sh
   ```

6. Erstlauf und Kontrolle:
   ```bash
   bash scripts/backup-orchestrator.sh full
   ls -lt /var/backups/portal/daily/ | head
   systemctl list-timers backup-orchestrator.timer
   ```
   Der Status erscheint auch im Portal unter `/admin/infrastructure`.

7. Empfohlen: Verschlüsselung mit `age` aktivieren (öffentlichen Schlüssel in
   die Backup-Konfiguration, privaten Schlüssel in den Passwortmanager) und
   einmal eine Probe-Wiederherstellung auf einem Wegwerf-Server testen.

**Maximaler Datenverlust: 6 Stunden.** Für weniger den Timer in
`scripts/systemd/backup-orchestrator.timer` auf stündlich stellen.

---

## Phase 1 — Vorbereitung

1. Neue Server bestellen (Ubuntu 22.04/24.04):
   - Backend: 4 vCPU, 8 GB RAM, 160 GB SSD
   - Portal/Frontend: 2 vCPU, 4 GB RAM, 40 GB SSD
2. In Cloudflare die TTL der A-Records für `mb-portal.com`, `www` und
   `api.mb-portal.com` auf 300 Sekunden senken (mindestens einen Tag vorher).
3. Frisches Vollbackup ziehen und das Archiv auf den neuen Backend-Server kopieren:
   ```bash
   # Backup-Server
   bash scripts/backup-orchestrator.sh full
   scp /var/backups/portal/daily/<archiv>.tar.gz root@<NEU-BACKEND-IP>:/opt/apps/
   ```

---

## Phase 2 — Neuen Backend-Server aufbauen

1. Supabase-Stack installieren (Docker + `/opt/supabase`), Struktur wie auf `.123`.
   **Wichtig:** dieselben Werte aus `/opt/supabase/.env` übernehmen —
   `JWT_SECRET`, ANON-/SERVICE-Keys, SMTP-Zugangsdaten. Ändern sich die Keys,
   brechen alle Sessions und der Mailversand.
2. Repo klonen:
   ```bash
   git clone https://github.com/DianaKnodel1/direct-zip-import.git /opt/apps/portal
   ```
3. Restore aus dem Archiv:
   ```bash
   cd /opt/apps/portal
   bash scripts/restore.sh /opt/apps/<archiv>.tar.gz
   ```
4. TLS für `api.mb-portal.com` vorbereiten (Cloudflare-Origin-Cert oder Let's Encrypt).
5. Testlauf ohne DNS-Änderung — lokal in `/etc/hosts`:
   ```
   <NEU-BACKEND-IP>  api.mb-portal.com
   ```
   Danach im Browser Login, Chat und E-Mail-Log prüfen.
   Health-Check: `curl https://api.mb-portal.com/auth/v1/health`

---

## Phase 3 — Neuen Portal-Server aufbauen

```bash
git clone https://github.com/DianaKnodel1/direct-zip-import.git /opt/apps/portal
cd /opt/apps/portal
bash scripts/setup-server2.sh
```

Dann:
1. `.env` und `.env.server` aus dem Backup zurückspielen (inkl. `TARGET_DB_URL`,
   `LANDING_SYNC_HOST`, `LANDING_SYNC_USER`, `LANDING_SYNC_PATH`).
2. Erster Build und Start:
   ```bash
   bash scripts/deploy.sh
   curl -I http://127.0.0.1:3000/
   ```
3. SSH-Key des neuen Portal-Servers auf dem Landing-Server (`.234`) eintragen,
   damit der Landing-Sync im Deploy funktioniert:
   ```bash
   ssh root@190.97.165.234 "echo Verbindung ohne Passwort funktioniert"
   ```

---

## Phase 4 — Umschalten (Wartungsfenster)

1. Alte Portal-App stoppen: `systemctl stop portal.service` auf `.124`.
2. Finalen Datenbank-Dump ziehen und auf dem neuen Backend einspielen:
   ```bash
   # alt (.123)
   docker exec supabase-db pg_dump -U postgres -Fc postgres > /tmp/final.dump
   scp /tmp/final.dump root@<NEU-BACKEND-IP>:/tmp/
   # neu
   docker exec -i supabase-db pg_restore -U postgres -d postgres --clean --if-exists < /tmp/final.dump
   ```
3. Edge Functions deployen: `bash scripts/deploy-backend.sh`
4. In Cloudflare die A-Records umstellen:
   - `mb-portal.com` und `www` → neue Portal-IP
   - `api.mb-portal.com` → neue Backend-IP
5. Verifizieren:
   ```bash
   curl -I https://mb-portal.com                      # 200
   curl https://api.mb-portal.com/auth/v1/health      # ok
   ```
   Im Browser: Login, Chat inkl. „Zuletzt aktiv", CSV-Export, Landing-Domain,
   WebID-Sim-Domain, Testbewerbung über eine Landing-Page.
6. Alte Server erst nach 24–48 Stunden abschalten (Rückfallmöglichkeit).

---

## Phase 5 — IP-Referenzen nachziehen

| Stelle | Was ändern |
|---|---|
| `/opt/apps/portal/.env` (Portal) | `TARGET_DB_URL` auf neue Backend-IP |
| `scripts/backend-server.env` | Backend-Host |
| `scripts/sync-to-backend.sh` | Backend-IP (Default `190.97.167.123`) |
| `scripts/remote-deploy.sh` | `BACKEND_IP` |
| `scripts/backup-orchestrator.env` (Backup-Server) | `DB_HOST`, `SERVER_PORTAL_HOST` |
| Landing-/Bot-/WebID-Server | `SUPABASE_URL` bleibt (Domain gleich), nur SSH-Keys neu |
| Cronjobs (Auto-Assign u. a.) | laufen über die Domain — bleiben unverändert |

---

## Zu beachten

- Datenbankgröße vorher messen (`docker exec supabase-db psql -U postgres -c
  "SELECT pg_size_pretty(pg_database_size('postgres'));"`) — sie bestimmt die
  Länge des Wartungsfensters.
- Bei einem Anbieterwechsel ändern sich die ausgehenden Mail-IPs: SPF-, DKIM-
  und DMARC-Einträge prüfen, sonst landen Mails im Spam.
- Cloudflare: bei „Full (strict)" müssen die Origin-Zertifikate auf den neuen
  Servern liegen, bevor umgeschaltet wird.
