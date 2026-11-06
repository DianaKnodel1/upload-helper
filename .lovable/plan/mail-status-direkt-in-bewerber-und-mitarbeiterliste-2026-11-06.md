# Mail-Status direkt in Bewerber- und Mitarbeiterliste

## Ist-Stand
- Bewerbungen-Liste: Neben dem Namen erscheint schon ein kleines Mail-Abzeichen, aber nur wenn eine Mail über das Portal rausging (im Screenshot gibt es noch keine, deshalb fehlt es).
- Mitarbeiter-Liste: zeigt bisher keinen Mail-Status, nur das Profil.

## Änderungen
1. **Mitarbeiter-Liste**: dasselbe Abzeichen neben dem Namen („Gesendet“, „Zugestellt – ungelesen“, „Geöffnet 06.11. (2×)“, „Unzustellbar“) für die zuletzt gesendete Mail.
2. **Beide Listen**: Steht keine Mail drin, wird ein dezentes „✉ keine Mail“ angezeigt, damit klar ist, dass noch nichts rausging.
3. **Tooltip** am Abzeichen: Betreff und Sendezeit der letzten Mail.
4. Optional ein Filter-Chip „Mail ungeöffnet“ in Bewerbungen.

## Hinweis
Status „Zugestellt/Geöffnet“ kommt nur nach Deploy, mit Open Tracking in Resend und den Webhook-Ereignissen `email.delivered` / `email.opened`. „Geöffnet“ ist kein sicherer Lesebeweis.

## Technisch
- `admin.mitarbeiter.tsx` (und ggf. `admin.personen.tsx`): `getMailStatuses` mit `profileIds` gebündelt laden, `MailStatusBadge` rendern.
- `MailStatusBadge`: Variante „keine Mail“ und `title` mit Betreff/Datum; `getMailStatuses` liefert dafür `subject` mit.
