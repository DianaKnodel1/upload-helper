// Rendert mehrseitige Website-Themes (kind: "site") im Admin-Preview.
// Der Landing-Server (landing-server/server.js) hat eine JS-Spiegel derselben
// Logik — Änderungen unbedingt in beiden Dateien nachziehen!
import type { ThemeFiles, SitePageDef } from "./landing-themes";

export type SitePageRow = SitePageDef & { fragment?: string };

export type SiteRenderResult = {
  html: string;
  status: number;
  page: SitePageRow | null;
};

/** Template nach lv-page-Markern splitten: Shell + Fragmente. */
export function parseSiteTheme(html: string): { shell: string; fragments: Record<string, string> } {
  const fragments: Record<string, string> = {};
  const re = /<!--\s*lv-page:([a-z0-9_-]+)\s*-->([\s\S]*?)<!--\s*\/lv-page\s*-->/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    fragments[m[1].toLowerCase()] = m[2];
  }
  const shell = html.replace(re, "");
  return { shell, fragments };
}

/** Nav-Blöcke deaktivierter Seiten aus der Shell entfernen. */
function stripDisabledNav(shell: string, pages: SitePageRow[]): string {
  let out = shell;
  for (const p of pages) {
    if (p.enabled === false) {
      const navRe = new RegExp(`<!--\\s*lv-nav:${p.id}\\s*-->[\\s\\S]*?<!--\\s*\\/lv-nav\\s*-->`, "gi");
      out = out.replace(navRe, "");
    }
  }
  return out;
}

function pickPage(pages: SitePageRow[], slug: string | undefined): SitePageRow | null {
  const enabled = pages.filter((p) => p.enabled !== false);
  if (!enabled.length) return null;
  const key = String(slug ?? "")
    .replace(/\.html?$/i, "")
    .replace(/^\//, "")
    .toLowerCase();
  if (!key || key === "index") return enabled[0];
  return enabled.find((p) => String(p.slug || "").toLowerCase() === key) ?? null;
}

export function renderSitePage(
  theme: ThemeFiles,
  opts: {
    pages?: SitePageRow[];
    slug?: string;
    slots?: Record<string, unknown>;
    mode?: "view" | "apply";
  }
): SiteRenderResult {
  const { shell, fragments } = parseSiteTheme(theme.html);
  const pages = Array.isArray(opts.pages) ? opts.pages : [];
  const page = pickPage(pages, opts.slug);

  let nav = stripDisabledNav(shell, pages);
  let fragment: string;
  let status = 200;
  if (!page) {
    // Themed 404
    fragment = fragments["404"] ?? '<section class="s1-section"><div class="s1-container"><h1>Seite nicht gefunden</h1></div></section>';
    status = 404;
  } else {
    fragment = page.fragment || fragments[String(page.id).toLowerCase()] || "";
  }

  // SEO pro Seite: leere Werte über Slots/Branding bedienen — die globale
  // SEO-Beschreibung/Titel kommen als {{seo_title}}/{{seo_description}} mit.
  const slots: Record<string, unknown> = { ...(opts.slots ?? {}) };
  const branding = (slots.branding as Record<string, unknown>) ?? {};
  if (page) {
    slots.page_title = page.title ?? "";
    slots.seo_title = page.seo_title || (page.title && branding.firmenname ? `${page.title} – ${branding.firmenname}` : slots.seo_title);
    slots.seo_description = page.seo_description || slots.seo_description || "";
  }

  let html = nav.replace("{{page_content}}", fragment);
  // Platzhalter 3 Runden auflösen (Slots können themselves Platzhalter enthalten)
  for (let round = 0; round < 3; round++) {
    let changed = false;
    for (const [k, v] of Object.entries(slots)) {
      const token = `{{${k}}}`;
      if (html.includes(token)) {
        html = html.split(token).join(String(v ?? ""));
        changed = true;
      }
    }
    if (!changed) break;
  }

  return { html, status, page };
}
