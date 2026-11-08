# Fenster „Aufgabe bearbeiten" wieder lesbar machen

## Problem (Screenshot)
Im Admin-Portal (Auftrags-Übersicht → Bearbeiten) ist das Fenster fast unlesbar: Beschriftungen, Felder und Fragebogen sind blass/verwaschen, nur markierter Text ist sichtbar. Betrifft vermutlich alle Fenster (Dialoge) im neuen Glas-Design, nicht nur dieses.

## Vermutete Ursache (noch unbestätigt, wird zuerst geprüft)
Im Glas-Design ist der Hintergrund der Fenster auf „durchsichtig" gesetzt bzw. die dunkle Abdeckung liegt optisch über dem Fensterinhalt. Dadurch scheint die Seite durch und alles wirkt grau.

## Umsetzung
1. Im Preview als Admin das Fenster öffnen (hell und dunkel) und per Screenshot die genaue Ursache bestätigen.
2. Fenster im Glas-Design bekommen einen festen, milchigen, gut deckenden Hintergrund (hell: fast weiß, dunkel: dunkles Glas) mit klarer Schrift; Abdeckung immer hinter dem Fenster.
3. Beschriftungen, Eingabefelder, Platzhalter und Scrollbereich mit ausreichendem Kontrast (gut lesbar in hell und dunkel).
4. Gegenprüfung an weiteren Fenstern (Neue Nachricht im Postfach, Zuweisen, Mitarbeiter-Dialoge).

## Technisch
- Zentrale Korrektur in `src/styles.css` (Glas-Variablen für `--popover`/`--background` in Dialogen) bzw. `src/components/ui/dialog.tsx` (eigene deckende Fläche, z-index Overlay < Content), keine Einzel-Hacks pro Seite.
- Prüfung per Playwright mit Screenshots in hell/dunkel.
- Live erst nach Deploy.
