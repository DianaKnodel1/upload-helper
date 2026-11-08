# Postfach: Antworten direkt anzeigen + übersichtlicher

## Problem
In Resend liegen Antworten (z. B. Benjamin Heise, Jesa Biskup, Marcel Steiner), im Portal-Postfach erscheinen sie nicht. Das Portal kann Antworten schon verarbeiten, bekommt sie aber offenbar nicht vom Webhook. Wahrscheinliche Ursachen (noch nicht bestätigt): Ereignis `email.received` fehlt im Resend-Webhook, oder das gespeicherte Signing Secret passt nicht, sodass Resend abgewiesen wird.

## 1. Antworten zuverlässig ins Postfach
- Knopf **„Neue Mails abrufen“** im Postfach: holt eingegangene Mails der letzten 15 Tage direkt aus Resend und legt fehlende im passenden Verlauf ab (keine Doppelten).
- Automatischer Abruf beim Öffnen des Postfachs und alle paar Minuten im Hintergrund.
- Hinweisleiste, wenn seit langem kein Webhook-Ereignis ankam („Webhook prüfen: email.received aktivieren / Secret neu eintragen“).
- Abmelde-Erkennung und Zuordnung zu Bewerber/Mitarbeiter laufen wie beim Webhook.

## 2. Übersichtlicheres Postfach
- Filter als klare Reiter: Alle · Ungelesen (mit Zahl) · Leads · Bewerber · Mitarbeiter.
- Liste: ungelesene Antworten fett mit Punkt, oben einsortiert; Symbol „Antwort erhalten“ vs. „nur gesendet“; Status (zugestellt/geöffnet) als kleines Abzeichen; kürzere Zeitangabe („vor 13 Std.“).
- Rechts: Verlauf als Chat-Blasen (eingehend links, gesendet rechts), Antwortfeld unten, Kopf mit Name, Adresse, Firma und Link zum Profil.
- Breitere Liste, bessere Lesbarkeit im Hell- und Dunkelmodus (Glas-Design bleibt).

## Technisch
- Neue Server-Funktion (Admin): Resend `GET /emails/receiving` (paginiert), pro Eintrag vorhandene `provider_id` in `lead_messages` prüfen, sonst die bestehende `email.received`-Logik aus `handleResendEvent` wiederverwenden.
- Webhook-Route speichert Zeitpunkt des letzten erfolgreichen Ereignisses (system_settings) für die Hinweisleiste; Fehlversuche mit falscher Signatur werden geloggt.
- Umbau nur in `admin.postfach.tsx` + Hilfskomponenten; Test für Duplikat-Schutz.
- Danach Deploy nötig.
