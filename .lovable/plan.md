# Aufräumen: Bewerber und Mitarbeiter vor dem 1.8.2026 löschen

## Was passiert
Ein einmaliges Skript für den Backend-Server löscht alle Bewerbungen und Mitarbeiter, die **vor dem 1. August 2026** angelegt wurden, inklusive Login, Chats, Verträgen, Dokumenten, Unterschriften und hochgeladenen Dateien.

**Bleibt immer erhalten:** Admin- und Teamleiter-Konten, Firmen, Aufträge-Vorlagen, Landingpages, Einstellungen, Indeed-Leads, alles ab dem 1.8.

## Ablauf (3 Schritte)
1. **Frisches Backup** auf dem Backup-Server auslösen und prüfen, dass es erfolgreich war.
2. **Vorschau (nichts wird gelöscht):** `bash scripts/cleanup-before-date.sh 2026-08-01`
   Zeigt pro Firma: Anzahl Bewerbungen, Mitarbeiter, Logins, Chats, Verträge, Dateien. Zusätzlich eine CSV-Liste aller betroffenen Personen zum Durchsehen.
3. **Löschen:** `bash scripts/cleanup-before-date.sh 2026-08-01 --execute`
   Fragt nochmals nach Bestätigung (Eingabe „LÖSCHEN"), läuft komplett in einem Durchgang – bricht etwas ab, wird nichts gelöscht.

## Ausnahmen
Optional eine Datei mit E-Mail-Adressen, die behalten werden sollen (`--keep keep.txt`). Ohne diese Datei wird jeder vor dem 1.8. gelöscht. Bitte Bescheid geben, falls z. B. grün/blau markierte oder aktive Mitarbeiter bleiben sollen.

## Technische Details
- Neues Skript `scripts/cleanup-before-date.sh`, nutzt die gleiche DB-Verbindung wie `migrate.sh`.
- Auswahl: `applications.created_at < Datum` sowie `profiles` mit `created_at < Datum`, ausgenommen Nutzer mit Rolle admin/teamleader in `user_roles` und Keep-Liste.
- Löschreihenfolge in einer Transaktion: chat_messages, chat_conversations, task_submissions/submission_answers/task_progress/task_assignments, step_feedback, contracts, documents, kyc_verifications, bookings, notifications, admin_notes, activity_log, user_transactions, sms_assignments, invitation_tokens, profiles, user_roles, applications, zuletzt `auth.users`.
- Dateien: zugehörige Objekte in `storage.objects` (Dokumente, Unterschriften) werden mitgelöscht.
- Vorschau-Modus nutzt `ROLLBACK`, Ausführmodus `COMMIT`; Protokoll nach `/var/log/portal-cleanup-<datum>.log`.
- Rückweg nur über `scripts/restore.sh` aus dem Backup von Schritt 1.
