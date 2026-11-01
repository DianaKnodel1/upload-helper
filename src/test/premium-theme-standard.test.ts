// @vitest-environment node
// Prüft den Premium-Theme-Standard (docs/PREMIUM-THEMES.md) für alle
// extern entwickelten Themes site-16, site-17, …
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { THEMES, ACTIVE_THEME_IDS, getTheme, SLOT_TYPES, stripUnresolvedPlaceholders } from "@/lib/landing-themes";
import { renderSitePage } from "@/lib/landing-site";
import { THEME_ASSETS } from "@/lib/theme-assets.generated";

const dir = join(__dirname, "..", "landing-themes");
const external = readdirSync(dir).filter((d) => /^site-\d+$/.test(d) && Number(d.slice(5)) > 15);

// Werte, die das System selbst liefert (Branding/Firmendaten/Seiten).
const BUILTIN = new Set([
  "page_content", "seo_title", "seo_description", "seo_image", "primary_color", "secondary_color",
  "firmenname", "brand_name", "logo_text", "contact_address", "contact_email", "contact_phone",
  "address", "email", "telefon", "strasse", "plz", "stadt", "landing_domain", "page_title",
  "impressum_url", "datenschutz_url", "logo_image", "favicon_image",
]);

describe("Premium-Theme-Standard", () => {
  it("Test-Theme site-16 ist vorhanden", () => expect(external).toContain("site-16"));

  for (const id of external) {
    const base = join(dir, id);
    const meta = JSON.parse(readFileSync(join(base, "meta.json"), "utf8"));
    const html = readFileSync(join(base, "template.html"), "utf8");
    const css = readFileSync(join(base, "style.css"), "utf8");

    describe(id, () => {
      it("ist registriert, aktiv und als Website-Theme erkannt", () => {
        expect(meta.id).toBe(id);
        const t = getTheme(id);
        expect(t?.kind).toBe("site");
        expect(ACTIVE_THEME_IDS.has(id)).toBe(true);
        expect(THEMES.filter((x) => x.id === id)).toHaveLength(1);
      });

      it("alle Slots haben einen erlaubten Feldtyp", () => {
        for (const s of meta.slots) expect(SLOT_TYPES).toContain(s.type);
        expect(getTheme(id)!.slots.length).toBe(meta.slots.length);
      });

      it("jeder Platzhalter hat einen Slot oder ist ein System-Wert", () => {
        const keys = new Set(meta.slots.map((s: any) => s.key));
        const used = [...`${html}\n${css}`.matchAll(/\{\{([a-z0-9_]+)\}\}/g)].map((m) => m[1]);
        const missing = [...new Set(used)].filter((k) => !keys.has(k) && !BUILTIN.has(k));
        expect(missing).toEqual([]);
      });

      it("alle referenzierten Assets existieren und sind eingebettet", () => {
        const refs = [
          ...`${html}\n${css}`.matchAll(/assets\/((?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.[a-z0-9]+)/g),
          ...meta.slots.map((s: any) => /^assets\/(.+)$/.exec(String(s.default))).filter(Boolean),
        ].map((m: any) => m[1]);
        for (const r of new Set(refs)) {
          expect(existsSync(join(base, "assets", r)), r).toBe(true);
          expect(THEME_ASSETS[id]?.[r], r).toBeTruthy();
        }
      });

      it("hat Startseite, Bewerbungs-CTA, Rechtslinks und keine festen Firmen-/API-Daten", () => {
        expect(html).toMatch(/<!--\s*lv-page:home\s*-->/);
        expect(html).toContain('href="#bewerbung-form"');
        expect(html).toContain('href="/impressum.html"');
        expect(html).toContain('href="/datenschutz.html"');
        expect(html).not.toMatch(/<form\b/i);
        expect(`${html}${css}`).not.toMatch(/supabase|tenant_id|api_endpoint|\/functions\/v1/i);
      });

      it("rendert jede Seite ohne offene Platzhalter, mit Formular-Modal", () => {
        const theme = getTheme(id)!;
        const slots: Record<string, string> = {};
        for (const s of theme.slots) slots[s.key] = s.default;
        for (const p of theme.pages ?? []) {
          const r = renderSitePage(theme, { pages: theme.pages, slug: p.slug, slots: { ...slots, primary_color: "#123456" } });
          expect(r.status).toBe(200);
          const out = stripUnresolvedPlaceholders(r.html);
          expect(out).not.toMatch(/\{\{[a-z0-9_]+\}\}/);
          expect(out).toContain("lov-apply-modal");
          expect(out).toContain("application-form");
        }
        expect(theme.css).toContain("lov-apply-modal");
      });
    });
  }

  it("Slot-Werte (kurz, lang, Bild) landen im gerenderten HTML", () => {
    const theme = getTheme("site-16")!;
    const r = renderSitePage(theme, {
      pages: theme.pages,
      slug: "",
      slots: {
        hero_title: "Neue Überschrift",
        hero_description: "Ein längerer Absatz\nmit zwei Zeilen.",
        hero_image: "https://cdn.example.com/neu.jpg",
        logo_image: "https://cdn.example.com/logo.png",
      },
    });
    expect(r.html).toContain("Neue Überschrift");
    expect(r.html).toContain("Ein längerer Absatz");
    expect(r.html).toContain('src="https://cdn.example.com/neu.jpg"');
    expect(r.html).toContain('src="https://cdn.example.com/logo.png"');
  });

  it("entfernt nicht definierte Platzhalter", () => {
    expect(stripUnresolvedPlaceholders("<h1>{{gibt_es_nicht}}Hallo</h1>")).toBe("<h1>Hallo</h1>");
  });

  it("bestehende Themes site-1 bis site-15 bleiben registriert", () => {
    for (let i = 1; i <= 15; i++) expect(getTheme(`site-${i}`)?.kind).toBe("site");
  });
});
