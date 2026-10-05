# Ident-Mirror (Standalone)

Spiegel für Ident-Verfahren (**WebID** und **POSTIDENT der Deutschen Post**) mit
Hinweis-Einblendung je Vorgang und eigenem, passwortgeschütztem Admin-Panel.
Läuft komplett eigenständig auf einem Server — ohne Portal, ohne Datenbank.

## Prinzip

```
https://mirror.example.de/t/dkb/service/status/cn/000631/aid/620631658
        │
        ▼  Cloudflare (orange Wolke)
        ▼  Caddy :443 (Origin-Zertifikat, Full Strict)
        ▼  Node.js (127.0.0.1:3003)
        │
        ▼  https://webid-gateway.de/service/status/cn/000631/aid/620631658
```

Der Teilnehmer sieht die Original-Strecke plus den Hinweis des gewählten
Vorgangs (z. B. „DKB · WebID"). Alle Links innerhalb der Strecke bleiben im
Tunnel (Pfad-Präfix `/t/<vorgang>/`).

## Admin-Panel

`https://<mirror-domain>/admin/` — drei Bereiche:

- **Tunnel:** Ident-Link einfügen, Vorgang wählen → „Im Tunnel öffnen" erzeugt
  und öffnet den Mirror-Link (oder kopiert ihn).
- **Hinweis-Texte:** Vorgänge anlegen/bearbeiten — Bezeichnung, Anbieter
  (WebID/POSTIDENT), Titel, Text, Meta-Zeile; optional „Absenden freigeben".
- **Einstellungen:** Firmenname, öffentliche Mirror-URL, Admin-Passwort ändern.

Beim ersten Aufruf wird das Admin-Passwort festgelegt (ohne Passwort ist das
Panel geschlossen). Anmeldung per Session-Cookie (12 h), Passwort als
scrypt-Hash in `config.json`.

## Konfiguration

Alle Daten liegen in `config.json` (Pfad per `CONFIG_PATH`, Default:
`./config.json`):

```json
{
  "company_name": "Ident-Mirror",
  "public_url": "https://mirror.example.de",
  "admin_password_hash": "scrypt:...",
  "session_secret": "<zufällig, wird automatisch erzeugt>",
  "procedures": [
    {
      "key": "dkb",
      "label": "DKB",
      "provider": "webid",
      "title": "Hinweis für diesen Auftrag",
      "text": "...",
      "meta": "optional",
      "allow_submit": true
    }
  ]
}
```

## Umgebungsvariablen

```
PORT=3003
MIRROR_DOMAIN=mirror.example.de     # nur für Caddy/Doku
CONFIG_PATH=/opt/apps/ident-mirror/config.json
```

## Installation (frischer Ubuntu-24.04-Server)

```bash
git clone https://github.com/DianaKnodel1/project-onetoone.git /tmp/src
cd /tmp/src
MIRROR_DOMAIN=mirror.example.de bash ident-mirror-server/setup.sh
```

Vorher einmalig in Cloudflare: **SSL/TLS → Origin Server → Create Certificate**
(Hosts: `mirror.example.de`, 15 Jahre) und die beiden Dateien nach
`/etc/caddy/origin.crt` / `/etc/caddy/origin.key` legen. SSL-Modus auf
**Full (Strict)** stellen, DNS `@` → **orange Wolke** (Wildcard nicht nötig).

Update später:

```bash
cd /tmp/src && git pull
bash ident-mirror-server/setup.sh   # überschreibt Code, config.json bleibt
```

## Firewall-Härtung (nur Cloudflare darf 443 erreichen)

```bash
ufw allow 22/tcp
for ip in 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 \
  141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 \
  197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 \
  104.24.0.0/14 172.64.0.0/13 131.0.72.0/22; do ufw allow from "$ip" to any port 443 proto tcp; done
ufw --force enable
```

(aktuelle Ranges: https://www.cloudflare.com/ips/)

## Leitplanken

- Rate-Limit pro IP (240/Min).
- `X-Robots-Tag: noindex, nofollow` auf allem.
- Kein Logging von Bodies/Query-Strings (nur Methode, Pfad, Status).
- POST nur für Vorgänge mit „Absenden freigeben"; sonst freundliche Sperrseite.
- Verbindung zum Anbieter erfolgt direkt — ohne Relay-/Proxy-Ketten.

## Zweite Installation auf demselben Server (z. B. eigene Nutzung neben einer Kunden-Installation)

Das Setup-Skript ist instanzfähig. Für jede weitere Installation eigenen Namen,
eigenen Port und eigene Domain wählen — Dienst, Ordner und `config.json` sind
vollständig getrennt, Caddy bekommt einen zusätzlichen Site-Block:

```bash
git clone https://github.com/DianaKnodel1/project-onetoone.git /tmp/src && cd /tmp/src
INSTANCE_NAME=ident-mirror-mb PORT=3004 MIRROR_DOMAIN=<zweite-domain> bash ident-mirror-server/setup.sh
```

Voraussetzungen wie bei der Erstinstallation: Cloudflare-DNS (orange Wolke) für
die zweite Domain; das Origin-Zertifikat muss beide Domains abdecken (Hosts beim
Zertifikat-Erstellen beide eintragen) — sonst zweites Zertifikatpaar anlegen und
den `tls`-Pfad im jeweiligen Caddy-Block anpassen.

Verwaltung der Instanzen:

```bash
systemctl status ident-mirror          # Installation 1
systemctl status ident-mirror-mb       # Installation 2
journalctl -u ident-mirror-mb -f       # Logs der zweiten Installation
```
