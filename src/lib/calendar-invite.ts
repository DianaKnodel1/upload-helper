/**
 * Kalendereintrag (.ics) direkt im Browser erzeugen.
 *
 * Hintergrund: Das Portal verschickt keine eigenen Mails mehr, es gibt also
 * auch keinen Kalender-Anhang. Ohne Eintrag im Handy-Kalender erinnert
 * niemanden etwas an den Termin — das ist der größte Hebel gegen
 * Nichterscheinen. Die Datei wird lokal gebaut, kein Server nötig.
 */

export interface CalendarEvent {
  title: string;
  description?: string;
  /** Ort oder URL zum Gespräch. */
  location?: string;
  start: Date;
  end: Date;
  /** Erinnerung vor Beginn in Minuten (Standard: 30). */
  reminderMinutes?: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC-Zeitstempel im iCalendar-Format (20260922T131500Z). */
function toIcsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(event: CalendarEvent): string {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@portal`;
  const reminder = event.reminderMinutes ?? 30;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mitarbeiter-Portal//Termin//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(event.start)}`,
    `DTEND:${toIcsDate(event.end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    event.description ? `DESCRIPTION:${escapeText(event.description)}` : null,
    event.location ? `LOCATION:${escapeText(event.location)}` : null,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(event.title)}`,
    `TRIGGER:-PT${reminder}M`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];
  return lines.join("\r\n");
}

/** Lädt den Termin als .ics herunter (iPhone, Android, Outlook, Google). */
export function downloadIcs(event: CalendarEvent, fileName = "termin.ics"): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
