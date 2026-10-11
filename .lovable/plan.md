# Website-Themes: Klarstellung & Weiterbau

## Klarstellung (kein Umbau nötig)
- Der Landing-Generator arbeitet mit **festen Website-Vorlagen** (Website-Theme 1 … 15), nicht mit dem Baukasten.
- Nach der Theme-Auswahl bearbeitbar: alle Texte, Bilder (Upload/KI), Farben (mit Kontrast-Schutz), Schriften (2–3 Alternativen pro Theme), Unterseiten ein-/ausblenden, umbenennen, duplizieren.
- Nicht editierbar: Layout und Charakter des Themes — garantiert die professionelle Optik.
- Der Baukasten (freie Abschnitte) ist ein separates älteres Werkzeug und wird für neue Seiten **nicht mehr angeboten**; bestehende Baukasten-Seiten bleiben bearbeitbar.

## Nächste Schritte
1. Baukasten aus dem Auswahl-Flow für neue Seiten entfernen (nur Website-Themes wählbar; Bestand unverändert).
2. Themes 2–5 bauen (Etappe 2), danach 6–10 und 11–15 nach dem Muster von Theme 1.
3. ZIP-Export für mehrseitige Themes.
4. Deploy-Hinweis: Migration `20261006000000_landing_site_themes.sql` auf dem Backend-Server einspielen, dann `git pull` + `deploy.sh` — erst danach funktioniert der Generator mit den neuen Themes live.

## Bestandsschutz
- Bestehende Landing Pages (einseitig oder Baukasten) bleiben online und bearbeitbar, genau wie heute.
