// Master-Vorlagen für den Landing-Generator.
// Jede Vorlage ist ein fertig durchdachtes, conversion-optimiertes Seitengerüst:
// feste Reihenfolge der Abschnitte + passende Farb-/Schriftwelt.
// Die KI füllt nur die Texte; der Aufbau und das Bewerbungsformular bleiben stabil.

import type { LandingStyle } from "@/lib/landing-sections";

export type LandingBlueprint = {
  id: string;
  label: string;
  description: string;
  /** Reihenfolge der Abschnitte; "form" wird immer automatisch ans Ende gesetzt. */
  sectionTypes: string[];
  /** Ausgangsdesign — die KI darf Farben im Rahmen anpassen. */
  style: Partial<LandingStyle>;
  /** Zusatzanweisung an die KI für Tonalität und Argumentation. */
  aiHint: string;
};

export const LANDING_BLUEPRINTS: LandingBlueprint[] = [
  {
    id: "corporate",
    label: "Seriöser Dienstleister",
    description:
      "Ruhig, vertrauenswürdig, klare Struktur. Gut für Büro, Verwaltung, Kundenservice und ältere Zielgruppen.",
    sectionTypes: ["hero", "stelle", "textbild", "ablauf", "kontakt", "faq"],
    style: {
      mode: "light",
      primary: "#1d4ed8",
      accent: "#0f172a",
      bg: "#ffffff",
      surface: "#f1f5f9",
      ink: "#0f172a",
      muted: "#475569",
      fontPair: "inter-plus",
      radius: 10,
      density: "normal",
      buttonShape: "rund",
    },
    aiHint:
      "Sachlicher, vertrauensbildender Ton. Betone Sicherheit, feste Ansprechpartner, klare Abläufe und Verlässlichkeit.",
  },
  {
    id: "modern-tech",
    label: "Moderne Digital-Agentur",
    description:
      "Dunkel, klar und modern. Gut für Homeoffice, Tech, App-Testing, Datenerfassung und junge Zielgruppen.",
    sectionTypes: ["hero", "textbild", "stelle", "ablauf", "faq", "kontakt"],
    style: {
      mode: "dark",
      primary: "#4f46e5",
      accent: "#020617",
      bg: "#0b1120",
      surface: "#131f38",
      ink: "#f8fafc",
      muted: "#94a3b8",
      fontPair: "bold",
      radius: 18,
      density: "luftig",
      buttonShape: "pill",
    },
    aiHint:
      "Moderner, direkter Ton. Betone Flexibilität, Arbeiten von zuhause, freie Zeiteinteilung und schnellen digitalen Einstieg.",
  },
  {
    id: "express",
    label: "Kompakter Schnelleinstieg",
    description:
      "Sehr kurz, maximal auf Bewerbungen optimiert. Gut für Nebenjob, Minijob und Anzeigen mit hohem Werbedruck.",
    sectionTypes: ["hero", "stelle", "ablauf", "faq"],
    style: {
      mode: "light",
      primary: "#be123c",
      accent: "#1f2937",
      bg: "#ffffff",
      surface: "#fff1f2",
      ink: "#111827",
      muted: "#4b5563",
      fontPair: "bold",
      radius: 6,
      density: "kompakt",
      buttonShape: "eckig",
    },
    aiHint:
      "Knapper, motivierender Ton. Sehr kurze Sätze, sofortiger Einstieg, kein Lebenslauf nötig, Bewerbung in wenigen Minuten.",
  },
  {
    id: "warm",
    label: "Warm & persönlich",
    description:
      "Freundlich und nahbar. Gut für Pflege, Gastronomie, Betreuung, Eltern und Quereinsteiger.",
    sectionTypes: ["hero", "textbild", "stelle", "ablauf", "kontakt", "faq"],
    style: {
      mode: "light",
      primary: "#b45309",
      accent: "#1c1917",
      bg: "#fffbf5",
      surface: "#fef3c7",
      ink: "#1c1917",
      muted: "#57534e",
      fontPair: "dm",
      radius: 20,
      density: "luftig",
      buttonShape: "pill",
    },
    aiHint:
      "Herzlicher, persönlicher Ton. Betone Wertschätzung, echtes Team, Rücksicht auf Familie und einen respektvollen Umgang.",
  },
];

export function findBlueprint(id: string | undefined | null): LandingBlueprint | null {
  if (!id) return null;
  return LANDING_BLUEPRINTS.find((b) => b.id === id) ?? null;
}
