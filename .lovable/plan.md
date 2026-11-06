# Mail-Status bei Bewerbern sichtbar

Ziel: Wenn ihr einem Bewerber manuell eine Mail schickt, seht ihr direkt beim Bewerber, ob sie angekommen ist und ob sie geöffnet wurde.

## Was ihr seht
- **Postfach (schon eingebaut):** unter jeder gesendeten Mail „Gesendet / Zugestellt / Geöffnet (Datum, Anzahl) / Unzustellbar“.
- **Neu, Bewerberliste:** kleines Abzeichen zur letzten Mail an diesen Bewerber:
  - grau „Gesendet“ – noch keine Bestätigung
  - blau „Zugestellt – ungelesen“
  - grün „Geöffnet“ mit Datum
  - rot „Unzustellbar“
- **Neu, Bewerber-Detail:** Abschnitt „E-Mails“ mit allen gesendeten Mails an diese Person samt Status; Klick öffnet den Verlauf im Postfach.
- Gleiches Abzeichen im Mitarbeiterprofil (dort gibt es den E-Mail-Knopf schon).
- Hinweis: „Geöffnet“ ist ein Anhaltspunkt, kein sicherer Lesebeweis.

## Technische Details
- Neue Server-Funktion: letzter ausgehender `lead_messages`-Eintrag je `application_id` / `profile_id` (Batch für Listen, Admin-geprüft), Felder `delivered_at`, `opened_at`, `open_count`, `bounced_at`.
- Gemeinsame Komponente `MailStatusBadge` + Hilfsfunktion `mailStatus(msg)` (rein, getestet: bounced > opened > delivered > sent).
- Einbindung in Bewerberliste, Bewerber-Detail und Mitarbeiterprofil.
- Keine neue Migration (Spalten kommen aus dem letzten Update).
