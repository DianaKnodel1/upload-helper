# Website-Themes 1–15: Texte komplett auf Fast-Track umstellen

## Befund
Alle 15 Website-Themes haben Standardtexte, die zur Vermittlung passen. Pro Theme sind das 10–12 Stellen, zum Beispiel „Wir vermitteln Fachkräfte“, „Direktvermittlung“, „Vermittlung kostenlos für Bewerber“ oder die FAQ-Frage „Kostet die Vermittlung etwas?“.

## Was ich ändere
- In allen 15 Themes ersetze ich die Standardtexte komplett durch **Fast-Track-Texte**. Das gilt für jede Unterseite: Start, Jobs, Team, FAQ, Kontakt, Fußzeile und die Google-Beschreibung.
- Die neuen Texte beschreiben die Arbeit im Homeoffice direkt beim Auftraggeber:
  - Apps und Webseiten testen
  - Festanstellung mit Sozialversicherung
  - freie Zeiten von 8 bis 21 Uhr, 19–21 € pro Stunde
  - Minijob, Teilzeit oder Vollzeit
  - bezahlte Einarbeitung und ein persönlicher Teamleiter
- Die Wörter „Vermittlung“ und „Vermittler“ kommen in keinem Theme mehr vor.
- Die Leistungen, Kennzahlen und FAQs werden passend umgeschrieben, zum Beispiel „Aufgaben“ statt „Direktvermittlung“ und „Mitarbeitende“ statt „Vermittlungen“.
- Jedes Theme bekommt leicht andere Formulierungen, damit sich die Seiten nicht wortgleich lesen.
- Das Design der Themes bleibt unverändert.

## Bestand
Seiten, die schon live sind, behalten ihre Texte, weil diese gespeichert sind. Die neuen Texte erscheinen, wenn du ein Theme neu auswählst. Eine bestehende Seite kannst du danach im Generator anpassen.

## Prüfung
- Ein automatischer Test für jedes Theme: Kein Standardtext darf „Vermittl…“ enthalten.
- Ich sehe mir die Vorschau aller 15 Themes an, damit es keine leeren oder unpassenden Stellen gibt.

## Technische Details
- Die `default`-Werte in `src/landing-themes/site-1` bis `site-15/meta.json` werden ersetzt.
- Ein Vitest prüft alle `site-*/meta.json` auf `/vermittl/i`.
- Generator, Landing-Server und Datenbank bleiben unverändert.
