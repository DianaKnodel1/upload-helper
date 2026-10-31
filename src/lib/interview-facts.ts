// Aktuelle Fakten für das KI-Bewerbungsgespräch. Wird bei JEDEM Gespräch
// frisch erzeugt, damit das Modell nicht mit veraltetem Trainingswissen
// (z. B. Datum 2024, Minijob 538 €) antwortet.

/** Gesetzlicher Mindestlohn (€/h) und Minijob-Grenze (€/Monat) je Jahr. */
const STATUTORY_BY_YEAR: Record<number, { minWage: number; minijobLimit: number }> = {
  2024: { minWage: 12.41, minijobLimit: 538 },
  2025: { minWage: 12.82, minijobLimit: 556 },
  2026: { minWage: 13.9, minijobLimit: 603 },
  2027: { minWage: 14.6, minijobLimit: 633 },
};

export function statutoryFor(year: number) {
  const known = Object.keys(STATUTORY_BY_YEAR).map(Number).sort((a, b) => a - b);
  const pick = known.filter((y) => y <= year).pop() ?? known[0];
  return STATUTORY_BY_YEAR[pick];
}

const euro = (n: number) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €";

export function buildInterviewFactsBlock(now: Date = new Date()): string {
  const dateStr = now.toLocaleDateString("de-DE", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Berlin",
  });
  const year = Number(now.toLocaleDateString("de-DE", { year: "numeric", timeZone: "Europe/Berlin" }));
  const s = statutoryFor(year);
  return `\n\nAKTUELLE FAKTEN (verbindlich, gehen jedem anderen Wissen und dem obigen Text vor):
- Heute ist ${dateStr}. Das aktuelle Jahr ist ${year}. Nenne niemals ein anderes Jahr als aktuell.
- Minijob: bis ${euro(s.minijobLimit)} im Monat (gesetzliche Minijob-Grenze ${year}).
- Gesetzlicher Mindestlohn ${year}: ${euro(s.minWage)} pro Stunde.
- Nenne nur Beträge, Daten und Konditionen aus diesem Prompt. Wenn du etwas nicht sicher weißt, sage ehrlich, dass das Team die Frage im Portal beantwortet — erfinde nichts.`;
}
