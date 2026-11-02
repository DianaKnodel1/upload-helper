# Fix: Mitarbeiter-Portal stürzt ab („Kurz hat etwas nicht geklappt")

## Ursache (aus den Videos bestätigt)
Fehlermeldung im Video: „`Tooltip` must be used within `TooltipProvider`". Der schwebende Chat-Knopf im Mitarbeiter-Portal (`FloatingChat`) nutzt einen Tooltip, aber seit dem Design-Rückbau ist kein Tooltip-Rahmen mehr um das Portal gelegt. Dadurch bricht jede Seite ab, sobald der Chat-Knopf erscheint – bei allen Mitarbeitern.

## Umsetzung
1. Einen globalen `TooltipProvider` in `src/routes/__root.tsx` um `<Outlet />` legen – damit funktionieren alle Tooltips überall (Admin, Mitarbeiter, Landing).
2. Zusätzlich `FloatingChat` absichern (eigener Provider), damit er nie wieder allein abstürzen kann.
3. Kurzer Test (Playwright, als Mitarbeiter angemeldet, Handy-Größe): Dashboard lädt ohne Fehlerseite, Chat-Knopf sichtbar.

## Danach
Deploy auf dem Frontend-Server: `cd /opt/apps/portal && git fetch --all && git reset --hard origin/main && bash scripts/deploy.sh`. Kein DB-Update nötig.
