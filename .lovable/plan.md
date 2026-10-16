# Backup-Server: alles sichern, damit ein Serverwechsel jederzeit möglich ist

## Ziel
Ein eigener Backup-Server holt sich alle 6 Stunden selbst alle Daten von Frontend- und Backend-Server. Wenn ein Server gesperrt wird, liegt dort alles bereit: die Datenbank, hochgeladene Dateien (Verträge, Unterschriften, Ausweise), Zugangsdaten, Server-Einstellungen und Code. Mit einem Befehl wird auf neuen Servern alles wieder eingespielt.

Grundsatz: Der Backup-Server **holt** die Daten ab. Die Produktions-Server kennen ihn nicht. Wird ein Produktions-Server gesperrt oder gehackt, kann niemand von dort die Backups löschen.

## Ausgangslage
Im Projekt gibt es schon zwei Ansätze (`backup.sh` schiebt, `backup-orchestrator.sh` holt). Beim Orchestrator sind mir diese Fehler aufgefallen:
- Er meldet jeden Lauf als „Fehler“, auch einen erfolgreichen.
- Sein Archiv-Aufbau passt nicht zu dem, was `restore.sh` erwartet. Ein Restore würde Dateien nicht finden.
- Server-Einstellungen (Nginx/Caddy, systemd-Dienste, `.env`-Dateien) werden nicht gezielt gesichert.
- Die Backups sind nicht verschlüsselt.
- Den Status schreibt er in die Datenbank, die bei einer Sperre selbst weg ist.

## Was gebaut wird
1. **Orchestrator überarbeiten**
   - Datenbank-Dump (komplett, inklusive Login-Konten) plus ein reiner Struktur-Dump als Reserve
   - Hochgeladene Dateien (Speicher-Ordner) vom Backend
   - Supabase-Konfiguration inklusive Schlüssel (`/opt/supabase/docker/.env`)
   - `.env`-Dateien, Nginx/Caddy, systemd-Dienste, Cron-Einträge, Zertifikate aller Server
   - Landing-, Bot- und WebID-Server
   - Einheitlicher Archiv-Aufbau, den `restore.sh` versteht
   - Verschlüsselung mit `age`. Den privaten Schlüssel hast nur du, im Passwortmanager.
   - Status-Bug beheben. Status zusätzlich lokal speichern; die Datenbank-Meldung ist nur ein Bonus.
2. **Prüfung pro Lauf:** Ist der Dump vollständig lesbar? Stimmt die Anzahl der Tabellen und Bewerbungen? Ist das Archiv größer als ein Mindestwert?
3. **Alarm**, wenn ein Backup fehlschlägt oder älter als 12 Stunden ist (per E-Mail oder Telegram, wähle ich nach deiner Antwort).
4. **Aufbewahrung:** 14 Tage alle 6 h, 3 Monate monatlich (wie bisher).
5. **restore.sh anpassen:** Neuen Backend-Server und neuen Frontend-Server getrennt einspielen (`restore.sh backend <archiv>` / `restore.sh frontend <archiv>`).
6. **Optional:** zweite Kopie außer Haus (z. B. Hetzner Storage Box oder S3), falls auch der Backup-Server ausfällt.
7. **Anleitung** `docs/DISASTER-RECOVERY.md` neu: Einrichtung Schritt für Schritt, dann Notfall-Ablauf (neue Server kaufen → Restore → DNS bei Cloudflare umstellen).

## Einrichtung bei dir (einmalig, ca. 20 Min.)
```text
1. Backup-Server mieten (anderer Anbieter als Frontend/Backend, ab 100 GB)
2. Dort: git clone Repo, setup-backup-server.sh ausführen
3. SSH-Schlüssel des Backup-Servers auf Frontend + Backend hinterlegen
4. backup-orchestrator.env ausfüllen (IPs, Verschlüsselungs-Schlüssel)
5. install-backup-orchestrator.sh → Timer läuft alle 6 h
6. Einmal manuell starten und einen Test-Restore machen
```

## Wichtig
Ein Backup ist nur etwas wert, wenn der Restore einmal geprobt wurde. Ich empfehle einen Probelauf auf einem günstigen Testserver.

## Technische Details
- Dateien: `scripts/backup-orchestrator.sh`, `.env.example`, `scripts/restore.sh`, `scripts/systemd/*`, `docs/DISASTER-RECOVERY.md`, neu `scripts/backup-verify.sh`
- `pg_dumpall --globals-only` zusätzlich zu `pg_dump -Fc` (Rollen/Passwörter)
- Storage: `/opt/supabase/docker/volumes/storage`
- Trap nur auf ERR, Erfolg explizit setzen; `set -o pipefail` beim Dump über ssh
- Verschlüsselung: `tar | age -r <pubkey>`, plus sha256
