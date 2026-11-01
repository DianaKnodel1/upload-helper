# Plan: Glas-Design wie im Video, Mitarbeiter-Mail mit Signatur

## Vorab: Schlüssel
- **Resend-Schlüssel:** Den könnt ihr schon heute im Portal eintragen, unter Admin → Lead-Mailing (Resend-Schlüssel und Webhook-Secret). Die neue Mitarbeiter-Mail nutzt denselben Schlüssel. Es ist nichts Neues nötig.
- **Gemini-Schlüssel:** Den tragt ihr unter Admin → KI-Einstellungen ein. Ein neuer Schlüssel ist nur nötig, wenn noch keiner gültig hinterlegt ist. Danach könnt ihr dort die festen Anweisungen selbst anpassen.

## Teil 1 – Portal-Design wie im Video (Admin + Mitarbeiter)
- Hintergrund: unscharfes, warmes Wohnraum-Foto (neu generiert), darüber eine große milchige Glasfläche
- Farben: Sand/Taupe, dunkle Schrift, fast schwarze Haupt-Knöpfe, aktive Stelle als weiße Kapsel
- **Oben:** schwebende Glasleiste mit Profilbild und „Willkommen, Name“, Suche in der Mitte, Glocke rechts, Hell/Dunkel-Schalter
- **Links:** schmale schwebende Symbol-Kapsel; der Name erscheint beim Draufzeigen, Hinweis-Punkte bleiben
- **Unten:** Reiterleiste als Kapsel mit den Unterseiten des aktuellen Bereichs (z. B. bei Personen: Bewerbungen, Mitarbeiter …)
- Übersicht mit großer Begrüßung („Guten Morgen, Name“), Kennzahl-Karten aus Glas, Diagramme in Koralle, Schwarz, Gelb und Blau
- Dunkler Modus: dieselbe Gestaltung in dunkel-warm
- Handy: Symbol-Kapsel wird zum Menü-Knopf, die Reiterleiste unten bleibt wischbar
- Die Menüpunkte, Rechte und Seiten bleiben alle erhalten; nur das Aussehen ändert sich

## Teil 2 – Direkte E-Mail an Mitarbeiter
- Knopf „E-Mail senden“ im Mitarbeiterprofil (und in der Mitarbeiterliste), z. B. wenn jemand nicht online kommt
- Betreff + Text, optional Vorlage („Bitte melden Sie sich“), Versand über Resend vom Firmen-Absender der jeweiligen Firma
- Gesendete Mails erscheinen im Verlauf beim Mitarbeiter; Antworten landen wie bei Leads im Postfach
- Nur Einzelversand, kein Massenversand

## Teil 3 – Professionelle HTML-Signatur
- Pro Firma einstellbar: Name, Position, Telefon, Website, Logo (aus Domains/Tenants), Farbe
- Schönes E-Mail-Layout: Kopf mit Logo, sauberer Text, Signatur unten, Abmelde-/Impressum-Zeile
- Live-Vorschau beim Bearbeiten; gilt für Lead-Mails, Lead-Antworten und Mitarbeiter-Mails

## Technische Details
- Design: Tokens in `src/styles.css` (glass-shell hell/dunkel neu), `GlassSidebar` → Symbol-Kapsel + neue `GlassTopBar` und `GlassTabDock`, Layouts in `AdminLayout`/`EmployeeLayout`; Navigationsgruppen liefern die Reiter für den Dock. Hintergrundbild unter `src/assets`.
- Mail: neue Server-Funktion (Admin-geprüft) in `lead-mailing.functions.ts` / `.server.ts`, nutzt `system_settings.resend_api_key`; neue Tabelle `employee_messages` (oder `lead_messages` mit `profile_id`) und Signaturfelder je Tenant (Migration). Ein gemeinsamer HTML-Renderer `src/lib/mail-template.ts` mit Text-Fallback; Tests für Escaping und Signatur.
- AGENTS.md: Regel zu gemeinsamem Mail-Layout und Navigationsstruktur aktualisieren.
