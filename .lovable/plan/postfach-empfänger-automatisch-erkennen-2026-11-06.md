# Postfach: Empfänger automatisch erkennen

## Kurz
Ja, das lässt sich ändern. Wer im Postfach eine Adresse frei einträgt, wird künftig automatisch dem passenden Bewerber oder Mitarbeiter zugeordnet. Der „E-Mail"-Knopf in den Listen (wie im Screenshot) funktioniert weiterhin und bleibt der schnellste Weg.

## Was sich ändert
- Beim Senden über „Neue Nachricht" sucht das Portal die eingetragene Adresse bei Mitarbeitern und Bewerbungen (Groß-/Kleinschreibung egal).
- Treffer Mitarbeiter: Mail wird dem Mitarbeiter zugeordnet. Treffer nur Bewerbung: der neuesten Bewerbung zugeordnet.
- Im Fenster erscheint vor dem Senden ein Hinweis wie „Erkannt: Nikolaus Barnowski (Mitarbeiter)" bzw. „Keine Person gefunden – wird nur im Postfach gespeichert".
- Dasselbe gilt für eingehende Antworten: Eine Antwort von einer bekannten Adresse landet ebenfalls bei der Person.
- Bei mehreren Firmen mit derselben Adresse wird die Firma bevorzugt, die als Absender gewählt ist.

## Technische Details
- `src/lib/lead-mailing.functions.ts` (Versand): wenn weder `profileId` noch `applicationId` mitgegeben werden, Lookup über `applications.email` (ilike, neueste, tenant bevorzugt) und Profile über Auth-E-Mail (über `applications.user_id`/`profiles.application_id`); Ergebnis in `profile_id`/`application_id` und `kind` speichern.
- Neue kleine Server-Funktion `resolveRecipientByEmail` für den Hinweis im `ComposeMailDialog`.
- Resend-Webhook: gleiche Zuordnung für eingehende Mails ohne Treffer.
- Test: Adresse eines bekannten Mitarbeiters ohne Auswahl → Zuordnung gesetzt; unbekannte Adresse → keine Zuordnung.
