# Landing-Server härten (DDoS, IP verstecken, Angriffsfläche)

Ziel: Der Landing-Server ist nicht mehr direkt aus dem Internet erreichbar.
Besucher laufen über Cloudflare, Angriffe treffen Cloudflare — der Server selbst
nimmt nur noch Anfragen von Cloudflare-IPs an.

```text
Besucher ──► Cloudflare (DDoS-Filter, WAF, echte IP bleibt versteckt)
                    │  Firewall: nur Cloudflare-IPs auf 80/443
                    ▼
             Landing-Server (Caddy ► Renderer)
```

## Teil 1 — Cloudflare (macht die IP unsichtbar)

Die Landing-Domains liegen in **vielen verschiedenen Cloudflare-Konten**
(je Kunde/Seite eines). Deshalb wird **kein** Origin-Zertifikat pro Konto
gepflegt — Caddy stellt sich für jede Domain automatisch selbst ein
Zertifikat aus (lokale CA). Pro Domain sind daher nur zwei Klicks nötig:

1. **DNS:** A-Record auf die Server-IP (z. B. `190.97.165.152`), Status
   **Proxied** (orange Wolke). Damit sieht die Welt nur noch Cloudflare-IPs.
2. **SSL/TLS → Overview:** Verschlüsselungsmodus **Full**
   (nicht *Full (strict)*, sonst lehnt Cloudflare das selbst ausgestellte
   Zertifikat ab). Die Verbindung Besucher ↔ Cloudflare ↔ Server ist
   trotzdem durchgehend verschlüsselt; gegen Direktzugriffe schützt die
   Firewall aus Teil 2, die nur Cloudflare-IPs durchlässt.
3. Empfohlen, einmalig pro Zone:
   - **Security → Bots:** *Bot Fight Mode* an.
   - **Security → Settings:** *Security Level* mindestens *Medium*; im
     Notfall (aktiver Angriff) *Under Attack Mode* einschalten.
   - **Security → WAF → Rate limiting rules:** Regel für das Bewerbungs-
     formular, z. B. `http.request.uri.path eq "/api/public/applications"`
     → max. 10 Requests/Minute pro IP, Aktion *Block*.

**Achtung Kunden-Domains:** Liegt die Domain in keinem Cloudflare-Konto und
läuft ungeproxyt, bleibt die Server-IP für diese Domain sichtbar. Lösung:
Kunden bitten, die Domain über Cloudflare (kostenloser Tarif genügt) laufen
zu lassen — oder Cloudflare *Custom Hostnames* (SaaS) buchen.

## Teil 2 — Auf dem Landing-Server (einmalig ausführen)

Voraussetzung: SSH-Zugang per Schlüssel funktioniert (sonst zuerst
`ssh-copy-id` von Ihrem Rechner).

```bash
apt-get update && apt-get install -y git rsync
git clone https://github.com/DianaKnodel1/direct-zip-import.git /opt/src/portal   # falls noch nicht vorhanden

# 1) Caddy auf Cloudflare-Betrieb umstellen (lokale CA, keine Zertifikatspflege)
cp /opt/src/portal/landing-server/Caddyfile.cloudflare /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy

# 2) Härtung: Firewall (nur Cloudflare auf 80/443), fail2ban, SSH, Auto-Updates
bash /opt/src/portal/scripts/harden-landing-server.sh
```


# 2) Härtung: Firewall (nur Cloudflare auf 80/443), fail2ban, SSH, Auto-Updates
bash /opt/src/portal/scripts/harden-landing-server.sh
```

Das Skript macht, alles wiederholbar und ohne Risiko für laufende Seiten:

| Schritt | Wirkung |
|---|---|
| Cloudflare-IP-Liste | 80/443 nur noch für offizielle Cloudflare-Bereiche; Liste wird **täglich** automatisch aktualisiert (`landing-cf-ips.timer`) |
| Direct-IP-Access | Pauschale 80/443-Freigaben werden entfernt — Aufruf der nackten IP scheitert |
| SSH | Passwort-Login aus (nur bei vorhandenem Key), Bruteforce-Sperre via fail2ban |
| Updates | Automatische Sicherheitsupdates aktiviert |
| Caddy | `trusted_proxies` für Cloudflare → Logs/Sperrungen sehen die echte Besucher-IP; Timeouts + Body-Limit gegen Slowloris/Riesen-Requests |

Wer die eigene IP bei SSH freigeben will (nur noch Ihr Standort kommt auf SSH):

```bash
SSH_ALLOW_IP=<ihre-statische-ip> bash scripts/harden-landing-server.sh
```

## Teil 3 — Prüfen

Auf dem Server:

```bash
ufw status numbered          # 80/443 nur mit "cf-landing"-Regeln, sonst deny
fail2ban-client status sshd  # Jail läuft
systemctl status landing-cf-ips.timer  # täglicher IP-Refresh aktiv
```

Von außen:

```bash
curl -m 10 -sI https://<landing-domain>/        # → HTTP/2 200 (über Cloudflare)
curl -m 10 -sI https://190.97.165.152/ -k       # → Timeout/refused (direkt nicht erreichbar)
# Host-Header-Spoofing muss auch scheitern, wenn die Firewall steht:
curl -m 10 -sI --resolve kunde.de:443:190.97.165.152 https://kunde.de/ -k   # → Timeout
```

In Cloudflare: bei der Domain unter **DNS** die Wolke „orange" — ein
`dig +short <domain>` darf **keine** Server-IP mehr liefern, sondern
Cloudflare-IPs.

## Notfall-Schalter

- **Angriff läuft:** In Cloudflare *Under Attack Mode* an → Besucher bekommen
  eine JavaScript-Prüfseite, Bots fliegen raus.
- **Cloudflare ausgefallen/Firewall falsch:** Notöffnung auf dem Server:
  `ufw allow 80/tcp && ufw allow 443/tcp && ufw reload`
  (danach die Cloudflare-Regeln mit `bash /usr/local/sbin/update-cloudflare-ips.sh`
  wiederherstellen).

## Rollout-Reihenfolge

1. Origin-Zertifikat erzeugen und auf den Server legen (Teil 1, Punkte 3).
2. Caddyfile tauschen + validieren (`caddy validate …` VOR dem Reload).
3. `harden-landing-server.sh` ausführen.
4. Erst dann in Cloudflare die orange Wolke aktivieren — so bleibt die Seite
   während der Umstellung erreichbar.
5. Prüfen (Teil 3), danach die alte Firewall-Öffnung automatisch durch das
   Skript entfernt.
