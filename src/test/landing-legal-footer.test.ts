// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

// Die Fußzeilen-Logik wird direkt aus der Runtime des Landing-Servers
// (landing-server/server.js) extrahiert und getestet — so prüfen wir genau den
// Code, der live läuft, nicht nur eine Kopie.
const serverSrc = readFileSync(join(__dirname, "..", "..", "landing-server", "server.js"), "utf8");
const stripStart = serverSrc.indexOf("// Entfernt doppelte Impressum-/Datenschutz-Links");
const footerStart = serverSrc.indexOf("// Themes, die im eigenen Footer bereits Impressum");
const footerEnd = serverSrc.indexOf("function cleanEmptyMeta(html, branding, domain)");
expect(stripStart).toBeGreaterThan(0);
expect(footerStart).toBeGreaterThan(stripStart);
expect(footerEnd).toBeGreaterThan(footerStart);
const code = serverSrc.slice(stripStart, footerEnd);
const sandbox: Record<string, unknown> = {};
vm.runInNewContext(code + "\nglobalThis.__out = { injectTrustFooter, themeFooterHasLegalLinks, stripThemeLegalLinks };", sandbox);
const { injectTrustFooter } = sandbox.__out as { injectTrustFooter: (html: string, b: Record<string, string>) => string };

const dir = join(__dirname, "..", "landing-themes");
const themes = readdirSync(dir).filter((d) => !d.startsWith("_"));

describe("Landing-Footer: kein doppelter blauer Footer", () => {
  it("Server-Logik ist vorhanden", () => {
    expect(typeof injectTrustFooter).toBe("function");
  });

  for (const t of themes) {
    it(`${t}: kein blauer Zweit-Footer, Rechtslinks bleiben erhalten`, () => {
      const html = readFileSync(join(dir, t, "template.html"), "utf8");
      const out = injectTrustFooter(html, { firmenname: "Test GmbH", strasse: "Weg 1", plz: "12345", stadt: "Stadt" });
      // Der große blaue Standard-Footer darf nie mehr erscheinen.
      expect(out.includes("lv-trust-footer")).toBe(false);
      if (/<footer[\s\S]*?<\/footer>/i.test(html) && /Impressum/i.test(html.match(/<footer[\s\S]*?<\/footer>/i)![0]) && /Datenschutz/i.test(html.match(/<footer[\s\S]*?<\/footer>/i)![0])) {
        // Theme-Footer hat eigene Rechtslinks → unverändert lassen.
        expect(out).toBe(html);
      } else {
        // Sonst schmale Rechtsleiste mit funktionierenden Links.
        expect(out.includes("lv-legal-bar")).toBe(true);
        expect(out.includes("Impressum")).toBe(true);
        expect(out.includes("Datenschutzerklärung")).toBe(true);
      }
    });
  }

  it("Seite ohne Footer bekommt die schmale Rechtsleiste", () => {
    const out = injectTrustFooter("<html><body><h1>Hallo</h1></body></html>", { firmenname: "Test GmbH" });
    expect(out.includes("lv-trust-footer")).toBe(false);
    expect(out.includes("lv-legal-bar")).toBe(true);
    expect(out.includes("/impressum.html")).toBe(true);
  });

  it("Vorhandene Rechtsleiste wird nicht verdoppelt", () => {
    const html = '<html><body><div class="lv-legal-block">x</div></body></html>';
    expect(injectTrustFooter(html, {})).toBe(html);
  });

  it("Footer ohne Rechtslinks wird nicht geleert, aber ergänzt", () => {
    const html = '<html><body><footer><div>Nav</div><a href="/x">Impressum</a></footer></body></html>';
    const out = injectTrustFooter(html, { firmenname: "Test GmbH" });
    expect(out.includes("lv-legal-bar")).toBe(true);
    expect(out.includes("Datenschutzerklärung")).toBe(true);
  });
});
