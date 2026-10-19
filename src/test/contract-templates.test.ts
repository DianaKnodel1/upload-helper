import { describe, expect, it } from "vitest";
import { getStandardContractTemplate } from "@/lib/contract-templates";
import { generateFallbackContract, resolveContractPlaceholders } from "@/lib/contract-utils";

const data = {
  firstName: "Erika", lastName: "Mustermann", address: "Testweg 7, 10115 Berlin", city: "Berlin",
  companyName: "Testfirma GmbH", companyAddress: "Firmenweg 1, 20095 Hamburg",
  companyCeoName: "Alex Muster", startDate: "01.11.2026",
};
const contract = (employmentType: string) => generateFallbackContract({ ...data, employmentType });

describe("Standardverträge vom Oktober 2026", () => {
  for (const type of ["minijob", "teilzeit", "vollzeit"]) {
    it(`${type}: setzt die konkrete Firma und den Mitarbeiter ohne offene Platzhalter ein`, () => {
      const rendered = contract(type);
      expect(rendered).toContain(data.companyName);
      expect(rendered).toContain(data.companyAddress);
      expect(rendered).toContain(`Arbeitgeber: ${data.companyCeoName}`);
      expect(rendered).toContain(`Arbeitnehmer: ${data.firstName} ${data.lastName}`);
      expect(rendered.match(/Testweg 7, 10115 Berlin/g)).toHaveLength(1);
      expect(rendered).not.toMatch(/BV Agentur|Benjamin Vymyslicky|\{\{/);
    });
    it(`${type}: verwendet das vereinbarte Startdatum, nicht das heutige Unterschriftsdatum`, () => {
      expect(contract(type)).toMatch(/Arbeitsverhältnis beginnt am 01\.11\.2026/);
    });
  }
  it("Minijob: drei Monate Probezeit", () => {
    expect(contract("minijob")).toMatch(/ersten drei Monate gelten als Probezeit/);
  });
  it("Minijob: 13,90 Euro Mindestlohn und 603 Euro Grenze Stand 2026", () => {
    expect(contract("minijob")).toMatch(/Mindestlohn 13,90 €, Verdienstgrenze 603,00 €/);
  });
  it("Minijob: circa 10 Wochenstunden und 43 Monatsstunden", () => {
    expect(contract("minijob")).toMatch(/ca\. 10 Stunden pro Woche \(ca\. 43 Stunden pro Monat\)/);
  });
  it("Minijob: 20 Urlaubstage bei fünf Arbeitstagen", () => {
    expect(contract("minijob")).toMatch(/5 Arbeitstage pro Woche Anspruch auf 20 Arbeitstage/);
  });
  it("Minijob: verbietet persönliche Konten, Ausweise und Zahlungsmittel", () => {
    expect(contract("minijob")).toMatch(/Verwendung eigener oder fremder personenbezogener Konten, Ausweisdokumente oder Zahlungsmittel.*nicht gestattet/);
  });
  it("Teilzeit: drei Monate Probezeit", () => {
    expect(contract("teilzeit")).toMatch(/ersten 3 Monate gelten als Probezeit/);
  });
  it("Teilzeit: 25 Wochenstunden und 108 Monatsstunden", () => {
    expect(contract("teilzeit")).toMatch(/25 Stunden pro Woche \(im Monatsdurchschnitt ca\. 108 Stunden\)/);
  });
  it("Teilzeit: monatliche Grundvergütung 2.042 Euro brutto", () => {
    expect(contract("teilzeit")).toMatch(/monatliche Bruttovergütung in Höhe von 2\.042,00 €/);
  });
  it("Teilzeit: 28 Urlaubstage mit anteiliger Umrechnung", () => {
    expect(contract("teilzeit")).toMatch(/Urlaubsanspruch = 28 × vereinbarte Arbeitstage pro Woche ÷ 5/);
  });
  it("Teilzeit: eigene Registrierungsdaten erlaubt, fremde Daten verboten", () => {
    expect(contract("teilzeit")).toMatch(/unter Verwendung eigener personenbezogener Daten.*zu registrieren/);
    expect(contract("teilzeit")).toMatch(/Daten Dritter, fremder Konten oder Zahlungsmittel ist ausdrücklich untersagt/);
  });
  for (const type of ["teilzeit", "vollzeit"]) {
    it(`${type}: zusätzliche Auftragsvergütung zwischen 7 und 60 Euro brutto`, () => {
      expect(contract(type)).toMatch(/7,00 € (?:bis|und) 60,00 € brutto/);
    });
  }
  it("Vollzeit: sechs Monate Probezeit", () => {
    expect(contract("vollzeit")).toMatch(/ersten sechs Monate gelten als Probezeit/);
  });
  it("Vollzeit: 40 Wochenstunden", () => {
    expect(contract("vollzeit")).toMatch(/wöchentliche Arbeitszeit beträgt 40 Stunden/);
  });
  it("Vollzeit: Montag bis Freitag von 08 bis 20 Uhr", () => {
    expect(contract("vollzeit")).toMatch(/Montag bis Freitag zwischen 08:00 und 20:00 Uhr/);
  });
  it("Vollzeit: 3.051 Euro brutto Grundvergütung", () => {
    expect(contract("vollzeit")).toMatch(/monatliche Grundvergütung in Höhe von 3\.051,00 € brutto/);
  });
  it("Vollzeit: 30 Urlaubstage bei fünf Arbeitstagen", () => {
    expect(contract("vollzeit")).toMatch(/5-Tage-Woche Anspruch auf 30 Arbeitstage/);
  });
  it("Vollzeit: 13. Monatsgehalt", () => {
    expect(contract("vollzeit")).toMatch(/erhält ein 13\. Monatsgehalt/);
  });
  it("Vollzeit: Firmenlaptop und Firmen-Smartphone", () => {
    expect(contract("vollzeit")).toMatch(/einen Firmenlaptop sowie ein Firmen-Smartphone/);
  });
  it("Vollzeit: 50 Euro pro Quartal, maximal 200 jährlich", () => {
    expect(contract("vollzeit")).toMatch(/50,00 € pro Quartal \(max\. 200,00 € pro Kalenderjahr\)/);
  });
  it("Vollzeit: keine persönlichen Konten oder Zahlungsmittel für Tests", () => {
    expect(contract("vollzeit")).toMatch(/Verwendung eigener oder fremder personenbezogener Konten oder Zahlungsmittel.*nicht gestattet/);
  });
  it("Individuelle Vollzeitstunden und Grundvergütung bleiben möglich", () => {
    const rendered = resolveContractPlaceholders(getStandardContractTemplate("vollzeit"), {
      ...data, employmentType: "vollzeit", weeklyHours: "38", monthlySalary: "3.200,00 €",
    });
    expect(rendered).toMatch(/wöchentliche Arbeitszeit beträgt 38 Stunden/);
    expect(rendered).toMatch(/Grundvergütung in Höhe von 3\.200,00 € brutto/);
  });
});