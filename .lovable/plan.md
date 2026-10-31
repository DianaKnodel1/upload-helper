# Plan: Indeed-Lead-Mailing, KI-Interview, Vertrags-Unterschrift und Aufräumen

## Teil 1 – Bewerber-Mails an Indeed-Leads (400–500 pro Tag, möglichst im Posteingang)

### Grundlagen für gute Zustellung
1. **Eigene Versand-Subdomain:** `bewerbung.it-agentur.solutions`. Die Hauptdomain bleibt geschützt.
2. **Saubere Einrichtung:** SPF, DKIM und DMARC bei Cloudflare. Ich führe Schritt für Schritt durch die Einträge.
3. **Langsam hochfahren:** Woche 1 etwa 50 Mails pro Tag, danach wöchentlich verdoppeln bis 500 pro Tag.
4. **Persönliche, nüchterne Mail:** mit Namen, 1–2 Links, kein reißerischer Betreff und eine echte Antwortadresse.
5. **Abmeldelink und Bounce-Prüfung:** Ungültige Adressen werden automatisch ausgeschlossen.

### Anbieter: Resend
Resend bietet keine klassischen Postfächer zum Einloggen. Es kann aber Antworten an `bewerbung.it-agentur.solutions` empfangen und ans Portal weiterreichen. Ihr seht sie dann im Admin-Portal (siehe unten).

### Funktion „Lead-Mailing“ (Admin)
- CSV-Export aus dem Indeed-Dashboard im Portal hochladen.
- Das Portal prüft Namen und E-Mail-Adressen, entfernt Dubletten und markiert Leads, die schon angeschrieben wurden.
- Bearbeitbare Vorlage mit `{Vorname} {Nachname}`, Homepage-Link, Calendly-Link und Kontakt.
- Mit Tageslimit (50 → 500) wird automatisch über den Tag verteilt verschickt.
- Jeder Lead hat einen Status: wartend, gesendet, unzustellbar, abgemeldet oder hat geantwortet.

### Lead-Postfach im Admin-Portal
- Antworten der Bewerber erscheinen beim jeweiligen Lead (Name, Betreff, Text, Datum).
- Ihr könnt direkt aus dem Portal antworten und jede Antwort als offen oder beantwortet markieren.

### Entwurf der Mail-Vorlage
Betreff: „Ihre Bewerbung bei {Firma} – nächster Schritt“
> Guten Tag {Vorname} {Nachname},
> vielen Dank für Ihre Bewerbung über Indeed. Sie wurden in die engere Auswahl aufgenommen.
> Bitte registrieren Sie sich auf unserer Website {Link} und wählen Sie anschließend über Calendly einen Interviewtermin: {Calendly-Link}.
> Bei Fragen antworten Sie einfach auf diese E-Mail.
> Freundliche Grüße, {Name}, {Firma}

## Teil 2 – KI-Interview seriöser und ausfallsicher machen
1. **Offizielle Anbieter direkt nutzen:** ein Hauptmodell und ein zweiter Anbieter als automatischer Ersatz.
2. **Aktuelle Fakten:** Der Bot bekommt das heutige Datum, die aktuelle Minijob-Grenze, die Firmendaten und die Stellendaten aus dem Portal. Er erfindet keine Zahlen; bei offenen Fragen verweist er auf das Team.
3. **Fester Ablauf:** Begrüßung → Motivation → Erfahrung → Verfügbarkeit und Beschäftigungsart → Fachfragen → Rückfragen des Bewerbers → klarer Abschluss mit den nächsten Schritten.
4. **Professioneller Ton:** Sie-Form, sachlich, keine Emojis, eine Frage pro Nachricht, Nachfragen bei sehr kurzen Antworten.
5. **Auswertung für Admins:** Zusammenfassung mit Bewertung (Motivation, Eignung, Verfügbarkeit).

### Anbieter für den Bot (eure Frage)
- **OpenAI direkt:** Konto auf platform.openai.com anlegen, Guthaben aufladen und einen API-Schlüssel erzeugen.
- **Google Gemini direkt:** In Google AI Studio (aistudio.google.com) die Abrechnung aktivieren und einen API-Schlüssel erzeugen.
- Empfehlung: Legt beide an, einer wird Hauptmodell, der andere Ersatz. Die Schlüssel tragt ihr unter Admin → AI-Einstellungen ein.

## Teil 3 – Geschäftsführer-Unterschrift im AV-Export (vor der nächsten Ads-Welle)
- Beim Export unter Mitarbeiter → Dokumente wird bisher nur die Unterschrift des Mitarbeiters eingesetzt.
- Künftig kommt die Geschäftsführer-Unterschrift aus dem Tenant (Admin → Domains/Tenants), genauso wie im Vertrags-PDF. Fehlt sie im Tenant, sehen Admins einen Hinweis.

## Teil 4 – Aufräumen
- Einstellungen → Konto & Team: Die Kachel und die Seite „Teamleiter“ werden entfernt, weil das im Tenant gepflegt wird.
- Die Seite „Domain-Übersicht“ und ihr Menüeintrag werden entfernt. Die Tenant-Verwaltung bleibt.

## Was ihr liefern müsst
- Ein Resend-Konto und den Zugang zu Cloudflare für `bewerbung.it-agentur.solutions`.
- Homepage-Link, Calendly-Link, Firmenname und Absendername.
- API-Schlüssel von OpenAI und/oder Google.
- Aktuelle Minijob- und Stellendaten zum Prüfen.

## Technische Details
- Neue Tabellen `lead_imports`, `lead_contacts` und `lead_messages` per Migration im selbst gehosteten Backend.
- Ein Versand-Job (systemd-Timer auf dem Frontend-Server) verschickt mit Tageslimit über die Resend-API. Signierte Resend-Webhooks melden Bounces und Abmeldungen und speichern eingehende Antworten.
- Der Interview-Prompt wird serverseitig aus der Vorlage und Live-Daten gebaut, die Phase wird pro Sitzung gespeichert. Die bestehende Ersatz-Logik und die sicheren Fehlermeldungen für Bewerber bleiben.
- Der AV-Export in Mitarbeiter-Dokumente nutzt dieselbe serverseitige Ermittlung der Unterschrift wie das Vertrags-PDF.
- Tests für Tageslimit, Dubletten-Erkennung, Datum im Prompt und die Unterschrift im Export.
