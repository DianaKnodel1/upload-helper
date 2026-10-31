import { describe, it, expect } from "vitest";
import { buildInterviewFactsBlock, statutoryFor } from "@/lib/interview-facts";

describe("interview facts", () => {
  it("nennt das aktuelle Jahr statt 2024", () => {
    const block = buildInterviewFactsBlock(new Date("2026-10-31T12:00:00Z"));
    expect(block).toContain("Das aktuelle Jahr ist 2026");
    expect(block).not.toContain("2024");
  });
  it("Minijob-Grenze 2026 ist 603 €, nicht 538 €", () => {
    const block = buildInterviewFactsBlock(new Date("2026-10-31T12:00:00Z"));
    expect(block).toContain("603 €");
    expect(block).not.toContain("538");
  });
  it("Mindestlohn 2026 ist 13,90 €", () => {
    expect(statutoryFor(2026).minWage).toBe(13.9);
  });
});

import { buildTeamNotesBlock } from "@/lib/interview-facts";
describe("team notes", () => {
  it("ignoriert die alte Versicherungs-Vorbelegung", () => {
    expect(buildTeamNotesBlock("Du bist ein professioneller HR-Interviewer und führst …")).toBe("");
  });
  it("übernimmt eigene Anweisungen", () => {
    expect(buildTeamNotesBlock("Start ab 01.12. möglich")).toContain("Start ab 01.12. möglich");
  });
});
