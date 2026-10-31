# Plan: Indeed-Leads per E-Mail anschreiben und KI-Interview überarbeiten

## Teil 1 – Bewerber-Mails an Indeed-Leads (400–500 pro Tag, möglichst im Posteingang)

### Was am meisten bringt (wichtiger als die Anbieterwahl)
1. **Eigene Versand-Subdomain**, z. B. `bewerbung.eurefirma.de`. Die Hauptdomain bleibt geschützt, falls etwas im Spam landet.
2. **Saubere Einrichtung:** SPF, DKIM und DMARC. Ich führe Schritt für Schritt durch die Einträge bei Cloudflare.
3. **Langsam hochfahren:** In Woche 1 etwa 50 Mails pro Tag, dann verdoppeln, bis 500 pro Tag. Neue Domains mit 1.000 Mails am ersten Tag landen fast immer im Spam.
4. **Persönliche, nüchterne Mail:** mit Namen, reinem Text oder schlichtem Layout, höchstens 1–2 Links, keine Wörter wie „Herzlichen Glückwunsch!!!“ im Betreff und eine echte Antwortadresse.
5. **Abmeldelink und Bounce-Prüfung:** Ungültige Adressen fliegen automatisch raus. Zu viele Bounces ruinieren den Ruf der Domain.

### Anbieter
Empfehlung: **Brevo** (EU-Server, DSGVO-freundlich, günstig bei 15.000 Mails pro Monat, eingebaute Versandsteuerung). Alternative: **Resend**. Normales SMTP mit eigenen Postfächern bleibt außen vor; daran lag euer Spam-Problem.

### Funktion im Portal: „Lead-Mailing“ (Admin)
- Ihr exportiert die Kandidaten als CSV aus dem Indeed-Dashboard und ladet die Datei im Portal hoch.
- Das Portal prüft Namen und E-Mail, entfernt Dubletten und zeigt Leads, die schon angeschrieben wurden.
- Bearbeitbare Vorlage mit Platzhaltern: `{Vorname} {Nachname}`, Homepage-Link, Calendly-Link, Kontakt.
- Ein Tageslimit (z. B. 50 → 500) wird automatisch über den Tag verteilt verschickt, nicht alles auf einmal.
- Status je Lead: wartend, gesendet, unzustellbar, abgemeldet. So schreibt ihr niemanden doppelt an.

### Entwurf der Mail-Vorlage
Betreff: „Ihre Bewerbung bei {Firma} – nächster Schritt“
> Guten Tag {Vorname} {Nachname},
> vielen Dank für Ihre Bewerbung über Indeed. Wir freuen uns, Ihnen mitzuteilen, dass Sie in die engere Auswahl gekommen sind.
> Bitte registrieren Sie sich auf unserer Website {Link} und wählen Sie anschließend über Calendly einen Termin für Ihr Interview: {Calendly-Link}.
> Bei Fragen antworten Sie einfach auf diese E-Mail.
> Freundliche Grüße, {Name}, {Firma}

## Teil 2 – KI-Interview seriöser und ausfallsicher machen

### Probleme
Ausfälle (503), alte Angaben (Datum 2024, falscher Minijob-Betrag), zu lockerer Ton, oberflächliche Fragen und kein klares Ende.

### Lösung
1. **Verlässliche Anbieter:** Hauptmodell über einen offiziellen Schlüssel (OpenAI oder Google, nicht der Zwischenhändler apinet.cloud), dazu ein zweiter Anbieter als automatischer Ersatz. Höhere Kosten sind laut euch in Ordnung.
2. **Aktuelle Fakten statt Modellwissen:** Bei jedem Gespräch bekommt der Bot das heutige Datum, die aktuelle Minijob-Grenze, die Firmendaten und die Stellendaten aus den Admin-Einstellungen. Der Bot erfindet keine Zahlen mehr; was er nicht weiß, verweist er an das Team.
3. **Fester Ablauf in Phasen:** Begrüßung → Motivation → Erfahrung → Verfügbarkeit und Beschäftigungsart → 2–3 Fachfragen → Rückfragen des Bewerbers → klarer Abschluss mit den nächsten Schritten. Danach endet das Interview sichtbar.
4. **Professioneller Ton:** Sie-Form, sachlich, keine Emojis, eine Frage pro Nachricht, Nachfragen bei sehr kurzen Antworten.
5. **Auswertung für Admins:** Nach dem Interview gibt es eine Zusammenfassung mit Bewertung (Motivation, Eignung, Verfügbarkeit), damit ihr ernsthafte Bewerber schneller erkennt.

## Was ihr beitragen müsst
- Eine Domain bzw. Subdomain für den Versand und ein Brevo-Konto (ich helfe bei der Einrichtung).
- Homepage- und Calendly-Link, Firmenname und Absendername.
- Einen offiziellen OpenAI- oder Google-Schlüssel für den Bot.
- Aktuelle Minijob- und Stellendaten (ich trage die bekannten Werte vor und ihr prüft sie).

## Technische Details
- Neue Tabellen `lead_imports` und `lead_contacts` (Status, Zeitpunkt, Fehler) im selbst gehosteten Backend, per Migration.
- Ein Versand-Job auf dem Frontend-Server (systemd-Timer) verschickt wartende Leads mit Tageslimit und Drosselung über die Brevo-API. Webhooks für Bounces und Abmeldungen setzen den Status.
- Der Interview-Prompt wird serverseitig aus Vorlage plus Live-Daten (Datum, Einstellungen) gebaut; die Phase wird pro Sitzung gespeichert. Die bestehende Fallback-Logik und die sicheren Fehlermeldungen für Bewerber bleiben erhalten.
- Tests für Tageslimit, Dubletten-Erkennung und Datum bzw. Fakten im Prompt.
