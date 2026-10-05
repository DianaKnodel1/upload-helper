# WebID-Simulationsumgebung

Transparenter Reverse-Proxy vor `webid-gateway.de` (oder anderer konfigurierter
Origin) mit fest eingeblendeten Simulations-Kennzeichnungen. Nur für interne
Awareness- und Schulungszwecke.

## Prinzip

```
https://uwk-consulting.webid-portal.de/service/status/cn/000631/aid/620631658
          │
          ▼  Cloudflare (orange Wolke, Universal SSL)
          ▼  Caddy :443 (Origin-Zertifikat, Full Strict)
          ▼  Node.js-Proxy (127.0.0.1:3002)
          │
          ▼  https://webid-gateway.de/service/status/cn/000631/aid/620631658
```

Domain wird 1:1 gegen die Original-URL ausgetauscht, Pfad und Query bleiben.
HTML wird gestreamt, das Simulations-Overlay wird server-seitig injiziert.

## Sichtbare Kennzeichnungen

- Topbar (nicht ausblendbar, hoher Kontrast)
- Hinweis-Popup beim ersten Aufruf (Session)
- Titel-Präfix `[SIMULATION]`
- Logo unten rechts
- Ersetztes Favicon

## Sicherheitsleitplanken (Defaults)

- POST-Requests werden geblockt (keine echten Submits an WebID).
  Auf Wunsch pro Domain aktivierbar (`allow_submit`).
- Nur Whitelist-Pfade (`/service/*`, Assets); alles andere → 404.
- Rate-Limit pro IP.
- `X-Robots-Tag: noindex, nofollow`.
- Kein Logging von Bodies/Query-Strings.
- Origin-IP hinter Cloudflare verborgen; Port 443 per Firewall nur für
  Cloudflare-IP-Ranges, Port 80 geschlossen, Bun nur auf 127.0.0.1.

## Umgebungsvariablen

```
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
PORT=3002
SIM_BASE_DOMAIN=webid-portal.de
DEFAULT_TARGET_ORIGIN=https://webid-gateway.de   # optional
```

## Deployment

```
bash webid-sim-server/setup.sh
```

Der angegebene Schlüssel muss am REST-Endpunkt funktionieren. Test vor dem
Setup (bei einer erfolgreichen Verbindung kommt JSON statt `Unauthorized`):

```bash
curl -s "$SUPABASE_URL/rest/v1/webid_sim_notice?select=title,is_active&id=eq.1" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY"
```

Vorher einmalig in Cloudflare: **SSL/TLS → Origin Server → Create Certificate**
(Hosts: `webid-portal.de`, `*.webid-portal.de`, 15 Jahre) und die beiden Dateien
nach `/etc/caddy/origin.crt` / `/etc/caddy/origin.key` legen. SSL-Modus auf
**Full (Strict)** stellen, DNS `*` und `@` → **orange Wolke**.

Firewall-Härtung (nur Cloudflare darf 443 erreichen):

```bash
ufw allow 22/tcp
for ip in 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 \
  141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 \
  197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 \
  104.24.0.0/14 172.64.0.0/13 131.0.72.0/22; do ufw allow from "$ip" to any port 443 proto tcp; done
ufw --force enable
```

(aktuelle Ranges: https://www.cloudflare.com/ips/)

Domains werden im Portal unter `/admin/webid-sim` gepflegt.
