# Website-Themes 1–15: Fast-Track-Texte

## Befund
Dein Kollege hat recht. Alle 15 Website-Themes haben Standardtexte, die nur zur Vermittlung passen. Jedes Theme hat 10–12 solche Stellen, zum Beispiel „Wir vermitteln Fachkräfte“, „Direktvermittlung“, „Vermittlung kostenlos für Bewerber“ oder die FAQ-Frage „Kostet die Vermittlung etwas?“. Für die Fast-Track-Seiten gibt es keine eigenen Texte. Bei den alten Einseiten-Designs gibt es dagegen schon zwei Textwelten (Vermittlung / Fast-Track).

## Was ich ändere
- Jedes Theme bekommt **zwei Text-Sets**:
  - **Vermittlung:** die heutigen Texte, unverändert.
  - **Fast-Track:** neue Texte für Arbeit im Homeoffice beim Auftraggeber selbst. Inhalt: Apps und Webseiten testen, Festanstellung mit Sozialversicherung, freie Zeiten von 8 bis 21 Uhr, bezahlte Einarbeitung, persönlicher Teamleiter. Die Begriffe „Vermittlung“ oder „Vermittler“ kommen darin nicht vor.
- Der Generator nimmt beim Auswählen eines Themes automatisch das Set, das zur Art der Landing passt (Fast-Track oder Vermittlung). Danach kannst du alles wie bisher frei ändern.
- Wechselst du die Art der Landing, fragt der Generator, ob er die Standardtexte austauschen soll. Deine eigenen Änderungen überschreibt er nur, wenn du das bestätigst.
- Die Fast-Track-Texte gelten für alle Unterseiten: Start, Jobs, Team, FAQ, Kontakt, Fußzeile und Google-Beschreibung. Damit sich die Themes nicht gleich lesen, ist jedes Set leicht anders formuliert.
- **Bestand:** Live-Seiten, die schon gespeichert sind, bleiben unverändert. Ihre Texte liegen gespeichert in der Datenbank.

## Prüfung
- Ein automatischer Test für jedes Theme: In den Fast-Track-Texten darf kein „Vermittl…“ vorkommen.
- Vorschau aller 15 Themes im Fast-Track-Modus durchsehen, damit keine Lücken oder leeren Stellen entstehen.

## Technische Details
- In `site-N/meta.json` bekommen die Slots einen zusätzlichen Wert `default_fast` (nur dort, wo sich der Text unterscheidet). Die Fallback-Regel lautet `default_fast ?? default`.
- `admin.landing-generator.tsx` belegt die Slots beim Wählen des Themes nach `flow_type` (`fast` → `default_fast`, sonst `default`). Beim Wechsel des `flow_type` werden nur Felder ersetzt, die noch dem alten Standardtext entsprechen. Alles andere passiert nur nach Bestätigung.
- Am Landing-Server und an der Datenbank ändert sich nichts.
