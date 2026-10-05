/**
 * Einfacher, Excel-kompatibler CSV-Export (UTF-8 mit BOM, Semikolon-Trennung).
 * Reine Client-Hilfsfunktionen — es werden nur bereits geladene Daten exportiert.
 */

const SEP = ";";

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s === "") return "";
  // Werte mit Trennzeichen, Anführungszeichen oder Umbruch müssen gequotet werden.
  if (/[";,\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: (string | null | undefined)[][]): string {
  const lines = [headers.map(escapeCell).join(SEP)];
  for (const r of rows) lines.push(r.map(escapeCell).join(SEP));
  // BOM sorgt dafür, dass Excel UTF-8 (Umlaute) korrekt erkennt.
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Kontaktdaten-Export: feste Spalten, keine Status- oder Auftragsdaten. */
export const CONTACT_HEADERS = [
  "Vorname", "Nachname", "E-Mail", "Telefon", "Straße", "PLZ", "Ort", "Land", "Mandant",
];

export type ContactRow = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
  tenant?: string | null;
};

const clean = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s === "—" ? "" : s;
};

export function contactRowsToCsv(rows: ContactRow[]): string {
  return toCsv(
    CONTACT_HEADERS,
    rows.map(r => [
      clean(r.firstName), clean(r.lastName), clean(r.email), clean(r.phone),
      clean(r.street), clean(r.zip), clean(r.city), clean(r.country), clean(r.tenant),
    ]),
  );
}


/** Zerlegt einen vollständigen Namen in Vor- und Nachname. */
export function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  const s = clean(full);
  if (!s) return { firstName: "", lastName: "" };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

export function dateStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Für Dateinamen: "Zusage erteilt" → "zusage-erteilt" */
export function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Generischer Spalten-Export (bestehende Nutzung, z. B. Transaktionen). */
export function exportToCsv<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns: { key: keyof T & string; label: string }[],
) {
  const csv = toCsv(
    columns.map(c => c.label),
    rows.map(r => columns.map(c => (r[c.key] === null || r[c.key] === undefined ? "" : String(r[c.key])))),
  );
  downloadCsv(filename, csv);
}
