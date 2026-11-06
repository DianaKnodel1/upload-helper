# Postfach: Zustellung/Öffnung anzeigen + nur Firmen mit Absender

## 1. Zustellt / Geöffnet im Portal
- Resend-Meldungen `email.delivered`, `email.opened` (und `email.bounced`) werden der gesendeten Nachricht zugeordnet (über die Resend-Nachrichten-ID).
- Im Postfach-Verlauf erscheint unter jeder gesendeten Mail ein kleiner Status: **Gesendet → Zugestellt → Geöffnet (Datum/Uhrzeit)** bzw. **Unzustellbar**.
- In der Threadliste ein Symbol „geöffnet" beim letzten ausgehenden Mail.
- Unter Lead-Mailing: Zähler „zugestellt / geöffnet" pro Firma; Lead-Status „Geöffnet" bei Bewerbern.
- Hinweis im Portal: „Geöffnet" ist ein Anhaltspunkt, kein sicherer Lesebeweis.
- Webhook-Hinweistext auf der Lead-Mailing-Seite listet alle fünf Ereignisse.

## 2. Firmenauswahl „Neue Nachricht"
- Dropdown zeigt nur Firmen mit hinterlegter Absender-Adresse (aktuell 5: BCU, B-H-V, MM Agentur, June Fund, IT-Agentur, sobald dort eingetragen).
- Kleiner Link „Alle Firmen anzeigen" für Ausnahmen; Firmen ohne Absender bleiben dort nicht wählbar.
- Ist nur eine Firma eingerichtet, wird sie automatisch vorausgewählt.

## Was ihr in Resend tun müsst
- Webhook: zusätzlich `email.delivered` und `email.opened` anhaken.
- Domains: bei allen 5 Domains **Open Tracking** einschalten.

## Technische Details
- Migration: `lead_messages` erhält `delivered_at`, `opened_at`, `open_count`, `bounced_at`; Index auf `provider_id` (existiert schon, unique mit direction).
- `handleResendEvent`: neue Zweige für delivered/opened, Update per `provider_id = data.email_id and direction='out'`; idempotent (opened_at nur setzen wenn null, open_count++).
- Bounce zusätzlich auf Nachricht setzen.
- `ComposeMailDialog`: Filter `sender_email` vorhanden, Toggle für alle.
- Thread-Abfrage in `lead-mailing.functions.ts` liefert neue Felder.
- Test für die Zuordnungslogik (delivered/opened setzt Felder, doppelte Opens zählen hoch, erstes Datum bleibt).
- Deploy + Migration auf dem Backend nötig.
