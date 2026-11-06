# Postfach: Firmenliste, Resend-Zugang und Mail an Bewerber

## Was passiert
1. **„Firma wählen" ist leer:** Das ist richtig so, weil unter Lead-Mailing noch keine Firma mit Absender-Adresse gespeichert ist. Sobald ihr pro Firma die Absender-Adresse speichert, erscheint sie in der Liste.
2. **Resend-Zugang leer:** Der Schlüssel wird als gespeichert gemeldet, liegt danach aber nicht in der Datenbank.
3. **Bewerbungen:** In der Liste gibt es noch keinen „E-Mail senden"-Knopf, nur bei Mitarbeitern.

Die genaue Ursache für 1 und 2 ist noch nicht bestätigt. Vermutung: Das Speichern meldet „erfolgreich", auch wenn in der Datenbank gar nichts geändert wurde, oder ein Datenbank-Update auf dem Backend fehlt.

## Schritt 1 – Ursache prüfen (ein Befehl auf dem Backend-Server)
Ein reiner Lesebefehl. Er zeigt, ob der Resend-Schlüssel und die Absender-Adressen gespeichert sind und ob alle nötigen Felder vorhanden sind. Die Schlüssel selbst werden dabei nicht angezeigt. Die Ausgabe schickst du mir.

## Schritt 2 – Speichern zuverlässig machen
- Resend-Zugang: Nach dem Speichern wird geprüft, ob der Wert wirklich in der Datenbank steht. Fehlt die Zeile für die Einstellungen, wird sie angelegt. Klappt das nicht, erscheint eine klare Fehlermeldung statt „gespeichert".
- Absender pro Firma: Genauso. Nach dem Speichern wird der Wert neu geladen und angezeigt.
- Unter Lead-Mailing steht sichtbar „Resend verbunden" bzw. „Kein Schlüssel gespeichert".

## Schritt 3 – Postfach-Auswahl verständlicher
- Ist keine Firma eingerichtet, steht unter „Absender (Firma)" der Hinweis „Noch keine Absender-Adresse hinterlegt" mit Link zu Lead-Mailing.
- Fehlt der Resend-Schlüssel, ist „Senden" gesperrt und es erscheint ein entsprechender Hinweis.

## Schritt 4 – E-Mail an Bewerber
- In der Bewerbungsliste kommt neben „Öffnen" ein Briefumschlag-Knopf (an der markierten Stelle). Er öffnet „Neue Nachricht" mit vorausgewähltem Bewerber und seiner Firma.
- Dasselbe gibt es in der Bewerber-Detailansicht.
- Gesendete Mails erscheinen beim Bewerber und im Postfach mit Status (Gesendet/Zugestellt/Geöffnet).

## Technische Details
- `saveResendAccess`: `upsert({id:1,...})` mit `.select()`, Rückgabe auf Inhalt prüfen; danach `getLeadMailingOverview` neu laden.
- `saveLeadMailSettings`: nach dem Upsert mit `.select()` prüfen; fehlende Spalten (z. B. `sig_*` aus `20261101000000_unified_postfach.sql`) erzeugen eine sichtbare Meldung „Datenbank-Update fehlt".
- `getMailComposeContext` liefert zusätzlich `hasResendKey`.
- `ComposeMailDialog` bekommt die Eigenschaft `applicationId`; der Kontext löst den Bewerber über `applications` auf (Name, E-Mail, Tenant).
- Bewerbungen: Knopf in `admin.bewerbungen.tsx` und in der Bewerber-Detailansicht.
- Tests: Bewerber-Empfänger wird korrekt aufgelöst; Speichern ohne geänderte Zeile meldet einen Fehler.
