# Prüfen, ob das Fenster „Aufgabe bearbeiten" jetzt lesbar ist

## Stand
- Die Korrektur ist eingebaut: Popup-Fenster haben im Glas-Design jetzt einen festen, milchigen Hintergrund statt eines durchsichtigen.
- Noch nicht geprüft: das Fenster im eingeloggten Admin-Portal (hell und dunkel). Live ist es erst nach dem Deploy.

## Schritte
1. Im Preview als Admin anmelden, Auftrags-Übersicht → Bearbeiten öffnen, Screenshots in hell und dunkel machen.
2. Zusätzlich „Neue Nachricht" (Postfach) und „Zuweisen" prüfen.
3. Falls etwas noch blass ist (z. B. Beschriftungen oder Felder), Kontrast nachschärfen und erneut prüfen.
4. Ergebnis mit Screenshot-Befund melden, danach Deploy-Befehl:
   `cd /opt/apps/portal && git fetch --all && git reset --hard origin/main && bash scripts/deploy.sh`
