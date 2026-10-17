// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..", "landing-themes");
const sites = readdirSync(dir).filter((d) => /^site-\d+$/.test(d));

describe("Website-Themes sind Fast-Track", () => {
  it("hat 15 Themes", () => expect(sites.length).toBe(15));
  for (const s of sites) {
    it(`${s}: kein Vermittlungs-Text in den Standardtexten`, () => {
      const meta = JSON.parse(readFileSync(join(dir, s, "meta.json"), "utf8"));
      const bad = meta.slots.filter((x: any) => /vermittl|personalberat/i.test(String(x.default ?? "")));
      expect(bad.map((x: any) => x.key)).toEqual([]);
    });
  }
});
