# Website-Themes: Baukasten löschen & Weiterbau

## Klarstellung (bestätigt)
- Der Landing-Generator arbeitet mit **festen Website-Vorlagen** (Website-Theme 1 … 15).
- Nach der Theme-Auswahl bearbeitbar: alle Texte, Bilder (Upload/KI), Farben (mit Kontrast-Schutz), Schriften (2–3 Alternativen pro Theme), Unterseiten ein-/ausblenden, umbenennen, duplizieren.
- Nicht editierbar: Layout und Charakter des Themes — garantiert die professionelle Optik.

## Baukasten komplett entfernen (User-Entscheidung)
- Abschnitts-Editor (Baukasten) wird gelöscht: `src/lib/landing-builder.functions.ts` (Vorschau/KI-Entwurf/Bild-Funktionen), `src/lib/landing-sections.ts`, `src/lib/landing-blueprints.ts`, zugehörige UI im Generator und die Tabelle `landing_templates` (per Migration droppen).
- Vorher prüfen: Ob bestehende Landing Pages mit `sections` (Baukasten-Seiten) existieren. Falls ja: diese Seiten bleiben online (Landing-Server rendert sie weiter), nur die Bearbeitung im Portal entfällt — oder sie werden vorher auf ein Website-Theme umgestellt. Rückfrage an User, falls solche Seiten existieren.
- KI-Bild-Generierung (`generateLandingImage`) wird in den Website-Theme-Editor übernommen, damit Bilder weiter per KI erzeugt werden können.

## Nächste Schritte
1. Baukasten löschen (Code + Tabelle), Generator zeigt nur noch Website-Themes.
2. Themes 2–5 bauen (Etappe 2), danach 6–10 und 11–15 nach dem Muster von Theme 1.
3. ZIP-Export für mehrseitige Themes.
4. Deploy-Hinweis: Migration `20261006000000_landing_site_themes.sql` auf dem Backend-Server einspielen, dann `git pull` + `deploy.sh` — erst danach funktioniert der Generator mit den neuen Themes live.

## Bestandsschutz
- Bestehende einseitige Landing Pages bleiben online und bearbeitbar, genau wie heute.
