import { describe, it, expect } from "vitest";
import { parseLeadCsv, renderLeadTemplate, allowedToSendNow, isUnsubscribeReply } from "@/lib/lead-mailing";

describe("parseLeadCsv", () => {
  it("entfernt Dubletten und ungültige Adressen", () => {
    const csv = "Name;E-Mail\nAnna Muster;anna@test.de\nAnna Muster;ANNA@test.de\nBob;keine-mail\n";
    const r = parseLeadCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.duplicates).toBe(1);
    expect(r.invalid).toBe(1);
    expect(r.rows[0]).toMatchObject({ firstName: "Anna", lastName: "Muster", email: "anna@test.de" });
  });
});

describe("renderLeadTemplate", () => {
  it("setzt Vor- und Nachname ein", () => {
    expect(renderLeadTemplate("Guten Tag {Vorname} {Nachname},", { Vorname: "Anna", Nachname: "Muster" })).toBe("Guten Tag Anna Muster,");
  });
});

describe("allowedToSendNow", () => {
  it("sendet nachts nichts", () => {
    expect(allowedToSendNow(500, 0, new Date("2026-11-02T02:00:00Z"))).toBe(0);
  });
  it("überschreitet nie das Tageslimit", () => {
    expect(allowedToSendNow(50, 50, new Date("2026-11-02T18:00:00Z"))).toBe(0);
    expect(allowedToSendNow(50, 0, new Date("2026-11-02T18:59:00Z"))).toBeLessThanOrEqual(50);
  });
  it("verteilt über den Tag: mittags etwa die Hälfte", () => {
    // 14:00 Berlin (Winterzeit = 13:00 UTC)
    const n = allowedToSendNow(500, 0, new Date("2026-11-02T13:00:00Z"));
    expect(n).toBeGreaterThan(230);
    expect(n).toBeLessThan(270);
  });
});

describe("isUnsubscribeReply", () => {
  it("erkennt Abmeldung", () => {
    expect(isUnsubscribeReply("Re: Bewerbung", "Bitte abmelden")).toBe(true);
    expect(isUnsubscribeReply("Re: Bewerbung", "Wann ist das Interview?")).toBe(false);
  });
});
