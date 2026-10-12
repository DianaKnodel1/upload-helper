# Standard-Aufträge entfernen + Status-Filter in Bewerbungen aufräumen

## 1. Standard-Aufträge löschen (Einstellungen → Aufträge)
- Die Karte „Standard-Aufträge“ verschwindet aus den Einstellungen.
- Der Punkt „Standard-Aufträge“ wird auch aus der Prüfliste „Ist die Firma startklar?“ entfernt, damit dort keine Warnung mehr für etwas erscheint, das es nicht mehr gibt.
- Die automatische Zuweisung bleibt unverändert.
- Die Datenbank-Tabelle bleibt vorerst bestehen (kein Risiko für Live-Daten). Sie kann später mit einem eigenen Update entfernt werden.

## 2. Status-Filter in Bewerbungen prüfen
Ergebnis der Prüfung:
- **„Zusage erteilt“ und „Zusage ohne Registrierung“ zeigen immer dieselben Personen.** Wer sich registriert, wandert automatisch nach „Onboarded“. In „Zusage erteilt“ bleibt also nur, wer noch nicht registriert ist. Deshalb steht bei beiden Filtern 70.
- Die anderen Filter (Eingegangen, Termin gebucht, Interview, Nicht erschienen, Abgesagt, Abgelehnt, Onboarded) sind sauber getrennt und richtig zugeordnet.

Änderung:
- Beide Filter werden zu einem einzigen Filter zusammengelegt: **„Zusage – noch nicht registriert“**.
- In diesem Filter gibt es bei jeder Person den Knopf **„Per WhatsApp nachfassen“**. Bisher war er nur im zweiten Filter zu sehen.
- Der Hinweis unter dem Status heißt dann ebenfalls „Zusage erteilt“. Die Fortschrittsanzeige bleibt wie bisher.

## Technische Details
- `src/routes/admin.settings.tsx`: Import und Darstellung von `StandardTasksCard` entfernen. `src/components/admin/StandardTasksCard.tsx` löschen.
- `src/lib/tenant-readiness.functions.ts`: Abfrage von `tenant_default_tasks` und die zugehörige Prüfung entfernen.
- `src/routes/admin.bewerbungen.tsx`: Die Gruppe `nachfassen` streichen und `zusage` umbenennen. Den WhatsApp-Knopf an `tab === "zusage"` binden und die Sonderlogik in `matchesGroup` entfernen.
