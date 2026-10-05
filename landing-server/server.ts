/**
 * Landing-Renderer (Server 1)
 * --------------------------------------------------------------------------
 * - Hört auf 127.0.0.1:PORT (default 3001), Caddy macht TLS + Reverse-Proxy.
 * - Liest Landing per Host-Header aus `public.landing_pages` (anon-Key + RLS).
 * - Rendert Theme (HTML/CSS/JS aus ./themes/) mit Branding + Slots.
 * - Caching im Memory mit 60s TTL.
 *
 * Endpunkte:
 *   GET /_health              → "ok"
 *   GET /_internal/ask?domain → 200 wenn Domain bekannt+published (für Caddy
 *                               on_demand_tls), sonst 404 (Cert-Spam-Schutz)
 *   GET /style.css            → CSS des Themes
 *   GET /script.js            → JS des Themes
 *   GET /assets/logo.*        → Redirect auf logo_url aus DB
 *   GET /assets/favicon.*     → Redirect auf favicon_url aus DB
 *   GET /                     → gerendertes HTML
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLegalPage, isPlaceholderValue, renderDatenschutz, renderImpressum } from "./legal-content.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const PORTAL_API_ENDPOINT = process.env.PORTAL_API_ENDPOINT ?? "";
const PORT = Number(process.env.PORT ?? 3001);
const CACHE_TTL_MS = 60_000;
const NEGATIVE_CACHE_TTL_MS = 15_000;
const ASSET_VERSION = process.env.LANDING_ASSET_VERSION || process.env.RELEASE_VERSION || String(Date.now());

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error("[landing-server] SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY müssen gesetzt sein.");
  process.exit(1);
}

const LANDING_SELECT = "id,slug,domain,tenant_id,theme_id,branding,slots,sections,logo_url,favicon_url,flow_type,source_slug,is_published,linked_fasttrack_landing_id,linked_fasttrack:landing_pages!linked_fasttrack_landing_id(domain)";

// ── Themes von Disk laden (einmal beim Start) ────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
type Theme = { id: string; html: string; css: string; js: string };
const THEMES: Record<string, Theme> = {};
const themesDir = join(__dirname, "themes");
for (const id of existsSync(themesDir) ? readdirSync(themesDir) : []) {
  const dir = join(themesDir, id);
  try {
    THEMES[id] = {
      id,
      html: readFileSync(join(dir, "template.html"), "utf8"),
      css: readFileSync(join(dir, "style.css"), "utf8"),
      js: readFileSync(join(dir, "script.js"), "utf8"),
    };
  } catch (e) {
    console.warn(`[themes] Skip ${id}: ${(e as Error).message}`);
  }
}
console.log(`[landing-server] ${Object.keys(THEMES).length} Themes geladen: ${Object.keys(THEMES).join(", ")}`);

// ── Cache ────────────────────────────────────────────────────────────────
type LandingRow = {
  id: string;
  slug: string;
  domain: string;
  tenant_id: string | null;
  theme_id: string;
  branding: Record<string, any>;
  slots: Record<string, string>;
  logo_url: string | null;
  favicon_url: string | null;
  flow_type: "classic" | "fast" | "broker";
  source_slug: string | null;
  is_published: boolean;
};
const cache = new Map<string, { row: LandingRow | null; expiresAt: number; stale?: boolean }>();
const inFlight = new Map<string, Promise<{ row: LandingRow | null; degraded: boolean }>>();

async function fetchLandingOnce(key: string): Promise<{ ok: boolean; row?: LandingRow | null; error?: string }> {
  const apiUrl = new URL("/rest/v1/landing_pages", SUPABASE_URL);
  apiUrl.searchParams.set("select", LANDING_SELECT);
  apiUrl.searchParams.set("domain", `eq.${key}`);
  apiUrl.searchParams.set("is_published", "eq.true");
  apiUrl.searchParams.set("limit", "1");
  try {
    const res = await fetch(apiUrl, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY!,
        authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${(await res.text()).slice(0, 300)}` };
    const rows = (await res.json()) as LandingRow[];
    if (!Array.isArray(rows)) return { ok: false, error: "unexpected response shape" };
    return { ok: true, row: rows[0] ?? null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function refreshLanding(key: string): Promise<{ row: LandingRow | null; degraded: boolean }> {
  let result = await fetchLandingOnce(key);
  if (!result.ok) {
    await new Promise((r) => setTimeout(r, 300));
    result = await fetchLandingOnce(key);
  }
  if (!result.ok) {
    console.error(`[landing-server] DB-Error für ${key}: ${result.error}`);
    const prev = cache.get(key);
    if (prev?.row) {
      // Backend gestört → letzten bekannten Stand weiterliefern statt 404.
      prev.expiresAt = Date.now() + CACHE_TTL_MS;
      prev.stale = true;
      return { row: prev.row, degraded: true };
    }
    // Fehler NIE als "Domain unbekannt" cachen.
    return { row: null, degraded: true };
  }
  const row = result.row ?? null;
  cache.set(key, { row, stale: false, expiresAt: Date.now() + (row ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS) });
  return { row, degraded: false };
}

async function loadLandingState(domain: string): Promise<{ row: LandingRow | null; degraded: boolean }> {
  // www.example.com und example.com auf denselben Datensatz mappen —
  // Caddy on_demand_tls fragt sonst für www.* nach und bekommt 404.
  const key = domain.toLowerCase().replace(/^www\./, "");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { row: cached.row, degraded: false };

  if (cached?.row) {
    // Abgelaufen, aber bekannt: sofort ausliefern, im Hintergrund erneuern.
    cached.expiresAt = Date.now() + CACHE_TTL_MS;
    if (!inFlight.has(key)) {
      const p = refreshLanding(key).finally(() => inFlight.delete(key));
      inFlight.set(key, p);
      p.catch(() => {});
    }
    return { row: cached.row, degraded: false };
  }

  let pending = inFlight.get(key);
  if (!pending) {
    pending = refreshLanding(key).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

async function loadLanding(domain: string): Promise<LandingRow | null> {
  return (await loadLandingState(domain)).row;
}

// ── Template-Rendering (Platzhalter ersetzen) ────────────────────────────
function applyPlaceholders(src: string, branding: Record<string, any>, slots: Record<string, string>): string {
  const b = { ...(branding || {}) };
  const addrParts = [b.strasse, [b.plz, b.stadt].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const aliases = {
    logo_text: b.firmenname || "",
    firmenname: b.firmenname || "",
    seo_title: b.seo_title || "",
    seo_description: b.seo_description || "",
    landing_domain: b.landing_domain || "",
    address: b.address || addrParts,
    contact_address: b.contact_address || addrParts,
    contact_email: b.contact_email || b.email || "",
    contact_phone: b.contact_phone || b.telefon || "",
    footer_address: b.footer_address || b.address || addrParts,
    footer_email: b.footer_email || b.email || "",
    footer_phone: b.footer_phone || b.telefon || "",
    sitz_stadt: b.sitz_stadt || b.stadt || "",
    sitz_stadt_upper: b.sitz_stadt_upper || (b.stadt ? String(b.stadt).toUpperCase() : ""),
    hrb_nummer: b.hrb_nummer || b.hrb || "",
  };
  // Muster-/Demo-Werte aus Theme-Defaults nie ausspielen.
  const cleanSlots: Record<string, string> = {};
  for (const [k, v] of Object.entries(slots || {})) {
    if (k in aliases && isPlaceholderValue(v)) continue;
    cleanSlots[k] = v;
  }
  const merged = { ...cleanSlots, ...aliases, ...b };
  let out = src;
  for (let i = 0; i < 3; i++) {
    let changed = false;
    for (const [k, v] of Object.entries(merged)) {
      const token = `{{${k}}}`;
      if (out.includes(token)) {
        out = out.split(token).join(String(v ?? ""));
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

// ── Meta-/Facebook-Pixel (optional pro Landing, mit Einwilligung) ─────────
function buildPixelBlock(row, mode, leadFired?: boolean) {
  const branding = row.branding || {};
  const custom = String(branding.meta_pixel_code || "").trim();
  const id = String(branding.meta_pixel_id || "").trim();
  if (!custom && !/^[0-9]{8,20}$/.test(id)) return "";
  // Lead auf /danke nur feuern, wenn es nicht schon beim Absenden gesendet wurde (lead=1).
  const lead = mode === "thanks" && !leadFired ? "true" : "false";
  // Eigener Code: unveraendert einbetten, aber "</" maskieren, damit das
  // umschliessende <script>-Tag nicht vorzeitig endet.
  const customJson = custom ? JSON.stringify(custom).replace(/<\//g, "<\\/") : "null";
  return `<script>
(function(){
  var PIXEL_ID=${JSON.stringify(id)};var CUSTOM=${customJson};var FIRE_LEAD=${lead};var KEY='lv_ads_consent';
  function loadPixel(){
    if(window.__lvPixelLoaded)return;window.__lvPixelLoaded=true;
    if(CUSTOM){
      // Kompletten Pixel-Code (Admin-gepflegt) erst nach Einwilligung einfuegen.
      var host=document.createElement('div');host.innerHTML=CUSTOM;
      var nodes=Array.prototype.slice.call(host.childNodes);
      for(var i=0;i<nodes.length;i++){var n=nodes[i];
        if(n.tagName==='SCRIPT'){
          var s=document.createElement('script');
          for(var j=0;j<n.attributes.length;j++){var a=n.attributes[j];s.setAttribute(a.name,a.value);}
          s.text=n.text||n.textContent||'';
          document.head.appendChild(s);
        }else if(n.tagName==='NOSCRIPT'){
          var img=n.querySelector?n.querySelector('img'):null;
          if(img){var im=document.createElement('img');im.src=img.getAttribute('src');im.width=1;im.height=1;im.style.display='none';document.body.appendChild(im);}
        }
      }
      if(FIRE_LEAD){try{fbq('track','Lead');}catch(_){}}
      return;
    }
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    try{fbq('init',PIXEL_ID);fbq('track','PageView');if(FIRE_LEAD)fbq('track','Lead');}catch(_){}
  }
  function stored(){try{return localStorage.getItem(KEY);}catch(_){return null;}}
  function save(v){try{localStorage.setItem(KEY,v);}catch(_){}}
  window.lvAdsConsent={grant:function(){save('granted');loadPixel();},deny:function(){save('denied');}};
  function banner(){
    if(document.getElementById('lv-consent-bar'))return;
    function build(){
      var bar=document.createElement('div');bar.id='lv-consent-bar';
      bar.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#0f172a;color:#e2e8f0;padding:16px 18px;font:14px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 -8px 30px rgba(0,0,0,.25);';
      var inner=document.createElement('div');
      inner.style.cssText='max-width:1100px;margin:0 auto;display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:space-between;';
      var txt=document.createElement('div');txt.style.cssText='flex:1 1 320px;min-width:260px;';
      txt.innerHTML='Wir messen mit dem Meta-Pixel, wie unsere Anzeigen genutzt werden. Das ist freiwillig und jederzeit widerrufbar. Mehr dazu in der <a href="/datenschutz.html" style="color:#93c5fd;">Datenschutzerkl\\u00e4rung</a>.';
      var btns=document.createElement('div');btns.style.cssText='display:flex;gap:10px;flex-wrap:wrap;';
      function mk(label,bg,fg){var b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='padding:10px 18px;border-radius:999px;border:1px solid rgba(226,232,240,.35);background:'+bg+';color:'+fg+';font-size:14px;font-weight:600;cursor:pointer;';return b;}
      var no=mk('Ablehnen','transparent','#e2e8f0');
      var yes=mk('Einverstanden','#e2e8f0','#0f172a');
      no.onclick=function(){window.lvAdsConsent.deny();bar.remove();};
      yes.onclick=function(){window.lvAdsConsent.grant();bar.remove();};
      btns.appendChild(no);btns.appendChild(yes);
      inner.appendChild(txt);inner.appendChild(btns);bar.appendChild(inner);
      document.body.appendChild(bar);
    }
    if(document.body)build();else document.addEventListener('DOMContentLoaded',build);
  }
  var s=stored();
  if(s==='granted'){loadPixel();return;}
  if(s==='denied')return;
  var opts={};
  try{if(window.AbortSignal&&AbortSignal.timeout)opts.signal=AbortSignal.timeout(2500);}catch(_){}
  fetch('/cdn-cgi/trace',opts)
    .then(function(r){return r.ok?r.text():'';})
    .then(function(t){
      var m=/loc=([A-Z0-9]{2})/.exec(t||'');
      var loc=m?m[1]:'';
      var CONSENT='AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH XX T1'.split(' ');
      if(loc&&CONSENT.indexOf(loc)===-1){loadPixel();return;}
      banner();
    })
    .catch(function(){banner();});
})();
<\/script>`;
}

// Auf /bewerben das Bewerbungsformular direkt \u00f6ffnen.
function buildApplyModeBlock(mode) {
  if (mode === "thanks") return "";
  if (mode !== "apply") {
    // Alte Anzeigen-Links mit #bewerbung auf die eigene Seite /bewerben leiten.
    return `<script>
(function(){try{if(/^#bewerbung(-form)?$/.test(location.hash||''))location.replace('/bewerben');}catch(_){}})();
<\/script>`;
  }
  return `<script>
(function(){
  function open(){var m=document.getElementById('lov-apply-modal');if(m){m.classList.add('is-open');document.body.classList.add('lov-apply-open');return true;}return false;}
  function boot(){
    if(open())return;
    var f=document.getElementById('bewerbung')||document.getElementById('bewerbung-form')||document.getElementById('application-form');
    if(f&&f.scrollIntoView)f.scrollIntoView({block:'start'});
  }
  if(document.readyState!=='loading')boot();else document.addEventListener('DOMContentLoaded',boot);
  document.addEventListener('click',function(e){
    var t=e.target;if(!t)return;
    var isClose=(t.id==='lov-apply-modal')||(t.classList&&t.classList.contains('lov-apply-close'));
    if(isClose){e.preventDefault();e.stopImmediatePropagation();location.assign('/');}
  },true);
})();
<\/script>`;
}

// Auf /bewerben: Formular als normalen Seitenabschnitt statt Einblend-Fenster.
function extractModalForm(html) {
  const startRe = /<div[^>]*id=["']lov-apply-modal["'][^>]*>/i;
  const m = startRe.exec(html);
  if (!m) return null;
  const start = m.index;
  const tagRe = /<div\b[^>]*>|<\/div>/gi;
  tagRe.lastIndex = start + m[0].length;
  let depth = 1;
  let end = -1;
  let t;
  while ((t = tagRe.exec(html))) {
    depth += t[0][1] === "/" ? -1 : 1;
    if (depth === 0) { end = tagRe.lastIndex; break; }
  }
  if (end < 0) return null;
  const block = html.slice(start, end);
  const bodyRe = /<div[^>]*class=["'][^"']*lov-apply-body[^"']*["'][^>]*>/i;
  const bm = bodyRe.exec(block);
  if (!bm) return null;
  const bodyStart = bm.index + bm[0].length;
  const innerRe = /<div\b[^>]*>|<\/div>/gi;
  innerRe.lastIndex = bodyStart;
  let d = 1;
  let bodyEnd = -1;
  let t2;
  while ((t2 = innerRe.exec(block))) {
    d += t2[0][1] === "/" ? -1 : 1;
    if (d === 0) { bodyEnd = t2.index; break; }
  }
  if (bodyEnd < 0) return null;
  return { form: block.slice(bodyStart, bodyEnd), rest: html.slice(0, start) + html.slice(end) };
}

function unwrapApplyModal(html) {
  const r = extractModalForm(String(html));
  if (!r || !/application-form/i.test(r.form)) return html;
  const section = `\n<div id="lov-apply-inline">${r.form}</div>\n`;
  const rest = r.rest;
  const footerIdx = rest.search(/<footer\b/i);
  if (footerIdx >= 0) return rest.slice(0, footerIdx) + section + rest.slice(footerIdx);
  return /<\/body>/i.test(rest) ? rest.replace(/<\/body>/i, `${section}</body>`) : rest + section;
}

// "Jetzt bewerben"-CTAs auf die eigene Unterseite /bewerben umbiegen.
function rewriteApplyLinks(html) {
  return String(html)
    .replace(/href=(["'])(?:\.?\/)?#bewerbung-form\1/gi, 'href="/bewerben"')
    .replace(/href=(["'])(?:\.?\/)?#bewerbung\1/gi, 'href="/bewerben"');
}

function injectLandingConfig(html: string, row: LandingRow, mode?: string, leadFired?: boolean): string {
  const esc = (s: string) => String(s ?? "").replace(/[<>"']/g, (c) => ({ "<": "\\u003c", ">": "\\u003e", '"': '\\"', "'": "\\'" }[c]!));
  const rawApi = row.branding?.api_endpoint || PORTAL_API_ENDPOINT;
  const apiEndpoint = String(rawApi ?? "").trim().replace(/[.,;\s]+$/g, "");
  if (!/^https?:\/\//i.test(apiEndpoint)) {
    console.error("[landing] PORTAL_API_ENDPOINT fehlt – Bewerbungsformular kann nicht senden:", row.domain || row.slug);
  }
  const portalUrl = row.branding?.portal_url || "";
  const wa = row.branding?.whatsapp_enabled ? String(row.branding?.whatsapp_number ?? "").replace(/[^0-9]/g, "") : "";
  const cleanHtml = html.replace(/<script>\s*window\.PORTAL_API\s*=\s*[\s\S]*?<\/script>\s*/gi, "");
  const block = `<script>
window.PORTAL_API = "${esc(apiEndpoint)}";
window.PORTAL_URL = "${esc(portalUrl)}";
window.TENANT_ID = "${esc(row.tenant_id ?? "")}";
window.FLOW_TYPE = "${esc(row.flow_type)}";
window.SOURCE_SLUG = "${esc(row.source_slug ?? row.slug)}";
window.LANDING_ID = "${esc(row.id ?? "")}";
window.WHATSAPP_NUMBER = "${esc(wa)}";
window.LANDING_PAGE_MODE = "${esc(mode || "home")}";

(function(){
  // Fasttrack-Empfang: ?ref=<broker_landing_id> aus URL nach window.SOURCE_LANDING_ID übernehmen
  // und in jeden POST an PORTAL_API (Bewerbungs-Endpoint) source_landing_id + target_landing_id injizieren.
  try {
    var u = new URL(location.href);
    var ref = u.searchParams.get("ref");
    if (ref && /^[0-9a-f-]{36}$/i.test(ref)) {
      window.SOURCE_LANDING_ID = ref;
      try { sessionStorage.setItem("vermittlung_ref", ref); } catch(_){}
    } else {
      try { var s = sessionStorage.getItem("vermittlung_ref"); if (s) window.SOURCE_LANDING_ID = s; } catch(_){}
    }
  } catch(_){}
  var origFetch = window.fetch;
  if (typeof origFetch !== "function") return;
  window.fetch = function(input, init){
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var api = window.PORTAL_API || "";
      if (api && url && url.indexOf(api) === 0 && init && init.body && typeof init.body === "string") {
        var b = JSON.parse(init.body);
        if (typeof b === "object" && b !== null) {
          if (window.SOURCE_LANDING_ID && !b.source_landing_id) b.source_landing_id = window.SOURCE_LANDING_ID;
          if (window.LANDING_ID && !b.target_landing_id) b.target_landing_id = window.LANDING_ID;
          init = Object.assign({}, init, { body: JSON.stringify(b) });
        }
      }
    } catch(_){}
    return origFetch.call(this, input, init);
  };
})();
</script>`;
  const extra = buildPixelBlock(row, mode, leadFired) + buildApplyModeBlock(mode);
  const all = block + extra;
  return /<\/head>/i.test(cleanHtml) ? cleanHtml.replace(/<\/head>/i, all + "</head>") : all + cleanHtml;
}

function cleanEmptyMeta(html: string, branding: Record<string, any>, domain: string): string {
  let out = html;
  if (!branding?.seo_image) {
    out = out.replace(/\s*<meta[^>]*property=["']og:image["'][^>]*content=["']["'][^>]*>\s*/gi, "\n");
    out = out.replace(/\s*<meta[^>]*name=["']twitter:image["'][^>]*content=["']["'][^>]*>\s*/gi, "\n");
  }
  // Domain immer da → wir setzen sie nach
  out = out.replace(/\{\{landing_domain\}\}/g, domain);
  return out;
}

// Rechtstexte zentral aus ./legal-content.js (Mirror von src/lib/legal-content.ts).
// Neu erzeugen mit: bun scripts/build-legal-content-js.mjs

function versionThemeAssets(html: string): string {
  const v = encodeURIComponent(ASSET_VERSION);
  return html
    .replace(/\bhref=["'](?:\.\/|\/)?style\.css["']/gi, `href="/style.css?v=${v}"`)
    .replace(/\bsrc=["'](?:\.\/|\/)?script\.js["']/gi, `src="/script.js?v=${v}"`);
}

// Baukasten-Renderer (Abschnitte statt festem Theme) — Mirror-Datei
// sections-renderer.js liegt neben dieser Datei (autogeneriert).
let sectionsRendererMod: any = null;
async function getSectionsRenderer(): Promise<any> {
  if (sectionsRendererMod) return sectionsRendererMod;
  try {
    sectionsRendererMod = await import("./sections-renderer.js");
  } catch (e) {
    console.warn("[landing-server] sections-renderer.js nicht ladbar:", (e as Error)?.message);
    sectionsRendererMod = { renderSectionsLanding: null };
  }
  return sectionsRendererMod;
}

async function renderHtml(row: LandingRow, host: string, mode?: string): Promise<{ body: string; status: number }> {
  // Baukasten-Landings (sections gesetzt) haben Vorrang vor dem Theme.
  if (Array.isArray((row as any).sections) && (row as any).sections.length) {
    const mod = await getSectionsRenderer();
    if (typeof mod.renderSectionsLanding === "function") {
      let shtml = mod.renderSectionsLanding({
        sections: (row as any).sections,
        branding: row.branding || {},
        host,
        logoUrl: row.logo_url,
        faviconUrl: row.favicon_url,
      });
      shtml = injectLandingConfig(shtml, row, mode);
      return { body: shtml, status: 200 };
    }
  }
  const theme = THEMES[row.theme_id];
  if (!theme) return { body: `Theme nicht gefunden: ${row.theme_id}`, status: 500 };
  const slots = { ...(row.slots || {}) };
  slots.impressum_url = "impressum.html";
  slots.datenschutz_url = "datenschutz.html";
  if (row.logo_url && !slots.logo_image) slots.logo_image = "/assets/logo";
  if (row.favicon_url && !slots.favicon_image) slots.favicon_image = "/assets/favicon";
  let html = applyPlaceholders(theme.html, row.branding, slots);
  html = html.replace(/<section[^>]*id=["'](?:impressum|datenschutz)["'][\s\S]*?<\/section>\s*/gi, "");
  html = cleanEmptyMeta(html, row.branding, host);
  if (mode === "apply") html = unwrapApplyModal(html);
  html = rewriteApplyLinks(html);
  html = injectLandingConfig(html, row, mode);
  html = versionThemeAssets(html);
  // Logo/Favicon-Pfade auf /assets/* zeigen lassen (wir redirecten auf Storage)
  if (row.logo_url) html = html.replace(/assets\/logo\.[a-z]+/gi, "/assets/logo");
  if (row.favicon_url) html = html.replace(/assets\/favicon\.[a-z]+/gi, "/assets/favicon");
  return { body: html, status: 200 };
}

// ── Danke-Seite (/danke): echte Unterseite nach erfolgreicher Bewerbung ──
function renderThanks(row: LandingRow, params: URLSearchParams): string {
  const branding = row.branding || {};
  const primary = /^#[0-9a-fA-F]{6}$/.test(branding.primary_color || "") ? branding.primary_color : "#1d4ed8";
  const firm = esc(branding.firmenname || "");
  const token = String(params.get("token") || "").slice(0, 200);
  const next = String(params.get("next") || "");
  const safeNext = /^https?:\/\//i.test(next) ? next : "";
  const mail = String(params.get("mail") || "").slice(0, 60);
  const mailReason = String(params.get("mailreason") || "").slice(0, 200);
  const partner = String(params.get("partner") || "").slice(0, 160);
  const logo = row.logo_url ? `<img src="/assets/logo" alt="${firm}" style="max-height:44px;width:auto;">` : `<span style="font-weight:800;font-size:19px;color:#0f172a;">${firm}</span>`;
  const bookingHtml = token
    ? `<div id="booking-inline-host" data-token="${esc(token)}" data-mail="${esc(mail)}" data-mail-reason="${esc(mailReason)}" style="margin-top:28px;"></div>
       ${safeNext ? `<noscript><a class="lv-thanks-btn" href="${esc(safeNext)}">Jetzt Termin vereinbaren \u2192</a></noscript>
       <div id="booking-fallback" style="margin-top:18px;display:none;"><a class="lv-thanks-btn" href="${esc(safeNext)}">Jetzt Termin vereinbaren \u2192</a></div>
       <script>setTimeout(function(){var h=document.getElementById('booking-inline-host');var f=document.getElementById('booking-fallback');if(f&&h&&!h.children.length)f.style.display='block';},2500);<\/script>` : ""}`
    : (safeNext ? `<a class="lv-thanks-btn" href="${esc(safeNext)}" target="_blank" rel="noopener">Jetzt Termin vereinbaren \u2192</a>
       <p style="margin:12px 0 0;font-size:13px;color:#94a3b8;">Es \u00f6ffnet sich ein neues Fenster zur Terminauswahl.</p>` : "");
  const partnerLine = partner ? `<p style="color:#475569;">Ihre Bewerbung wurde an <strong>${esc(partner)}</strong> weitergeleitet.</p>` : "";
  const head = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vielen Dank f\u00fcr Ihre Bewerbung${firm ? " \u2014 " + firm : ""}</title>
<meta name="robots" content="noindex">
${row.favicon_url ? '<link rel="icon" href="/assets/favicon">' : ""}
<link rel="stylesheet" href="/style.css">
<style>
 body{margin:0;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;}
 .lv-thanks-head{background:#fff;border-bottom:1px solid #e2e8f0;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
 .lv-thanks-wrap{max-width:820px;margin:0 auto;padding:48px 20px 72px;}
 .lv-thanks-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:36px 28px;box-shadow:0 18px 50px rgba(15,23,42,.06);}
 .lv-thanks-card h1{font-size:30px;line-height:1.2;margin:0 0 12px;}
 .lv-thanks-card p{font-size:16px;line-height:1.7;color:#475569;margin:0 0 12px;}
 .lv-thanks-btn{display:inline-block;margin-top:18px;background:${primary};color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px;}
 .lv-thanks-foot{text-align:center;padding:26px 20px 40px;font-size:13px;color:#64748b;}
 .lv-thanks-foot a{color:#475569;}
</style></head><body>`;
  const body = `<header class="lv-thanks-head">${logo}<a href="/" style="color:#475569;text-decoration:none;font-size:14px;">Zur\u00fcck zur Startseite</a></header>
<main class="lv-thanks-wrap"><div class="lv-thanks-card">
  <div style="width:56px;height:56px;border-radius:50%;background:#dcfce7;color:#16a34a;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;margin-bottom:18px;">\u2713</div>
  <h1>Vielen Dank f\u00fcr Ihre Bewerbung!</h1>
  <p>Ihre Angaben sind bei uns eingegangen. Sie erhalten in K\u00fcrze eine Best\u00e4tigung per E-Mail \u2014 bitte pr\u00fcfen Sie auch Ihren Spam-Ordner.</p>
  ${partnerLine}
  ${token || safeNext ? `<p><strong>Letzter Schritt:</strong> W\u00e4hlen Sie jetzt Ihren Wunschtermin f\u00fcr das Kennenlerngespr\u00e4ch.</p>` : ""}
  ${bookingHtml}
</div></main>
<div class="lv-thanks-foot">${firm ? esc(firm) + " \u00b7 " : ""}<a href="/impressum.html">Impressum</a> \u00b7 <a href="/datenschutz.html">Datenschutz</a></div>
<script src="/script.js"><\/script></body></html>`;
  return versionThemeAssets(injectLandingConfig(head + body, row, "thanks", params.get("lead") === "1"));
}

function renderLegal(row: LandingRow, type: "impressum" | "datenschutz"): string {
  const branding = row.branding || {};
  const body = type === "datenschutz" ? renderDatenschutz(branding) : renderImpressum(branding);
  return buildLegalPage(type === "datenschutz" ? "Datenschutz" : "Impressum", body, branding, {
    homeHref: "/",
    impressumHref: "/impressum.html",
    datenschutzHref: "/datenschutz.html",
    logoUrl: row.logo_url ? "/assets/logo" : undefined,
  });
}

// ── Blog-Beitragsseiten (/blog/1..3) ─────────────────────────────────────
const BLOG_IMAGES: Record<number, string> = { 1: "/assets/blog5.jpg", 2: "/assets/blog4.jpg", 3: "/assets/blog6.jpg" };

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }) as Record<string,string>)[c]);
}

function renderBlogPost(row: LandingRow, n: number): string | null {
  const slots: Record<string, any> = row.slots || {};
  const branding: Record<string, any> = row.branding || {};
  const title = slots[`blog_post_${n}_title`];
  if (!title) return null;
  const date = slots[`blog_post_${n}_date`] || "";
  const excerpt = slots[`blog_post_${n}_excerpt`] || "";
  const bodyText = slots[`blog_post_${n}_body`] || excerpt;
  const firm = esc(branding.firmenname || "");
  const primary = /^#[0-9a-fA-F]{6}$/.test(branding.primary_color || "") ? branding.primary_color : "#1d4ed8";
  const paragraphs = String(bodyText)
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
  const brand = row.logo_url
    ? `<img src="/assets/logo" alt="${firm}" class="bp-logo" />`
    : `<span class="bp-wordmark">${firm}</span>`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} – ${firm}</title>
<meta name="description" content="${esc(excerpt)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(excerpt)}" />
<meta property="og:type" content="article" />
<style>
  :root { --bp-accent:${primary}; --bp-ink:#111827; --bp-muted:#5b6472; --bp-line:#e4e7ec; }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff;color:var(--bp-ink);
    font-family:"Plus Jakarta Sans","Manrope",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
    font-size:16px;line-height:1.72;-webkit-font-smoothing:antialiased}
  a{color:var(--bp-accent);text-decoration:none}
  a:hover{text-decoration:underline}
  .bp-header{border-bottom:1px solid var(--bp-line)}
  .bp-header-inner{max-width:920px;margin:0 auto;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:24px}
  .bp-logo{height:34px;width:auto;display:block}
  .bp-wordmark{font-size:17px;font-weight:700;letter-spacing:-.01em;color:var(--bp-ink)}
  .bp-back{font-size:14px;color:var(--bp-muted);white-space:nowrap}
  .bp-main{max-width:920px;margin:0 auto;padding:48px 24px 80px}
  .bp-date{display:inline-block;background:var(--bp-accent);color:#fff;font-size:13px;font-weight:600;padding:4px 12px;border-radius:4px}
  h1{font-size:38px;line-height:1.18;letter-spacing:-.02em;margin:16px 0 12px}
  .bp-lead{color:var(--bp-muted);font-size:17px;margin:0 0 28px;max-width:64ch}
  .bp-cover{width:100%;height:auto;border-radius:10px;margin:0 0 32px;display:block}
  .bp-body p{margin:0 0 16px;max-width:70ch}
  .bp-cta{margin-top:40px;padding-top:28px;border-top:1px solid var(--bp-line);display:flex;gap:16px;flex-wrap:wrap;align-items:center}
  .bp-btn{background:var(--bp-accent);color:#fff;padding:12px 24px;border-radius:999px;font-weight:600}
  .bp-btn:hover{text-decoration:none;opacity:.9}
  .bp-footer{border-top:1px solid var(--bp-line);padding:24px;text-align:center;font-size:13px;color:var(--bp-muted)}
  @media(max-width:640px){h1{font-size:28px}}
</style>
</head>
<body>
<header class="bp-header"><div class="bp-header-inner"><a href="/">${brand}</a><a class="bp-back" href="/#blog">← Zurück zum Blog</a></div></header>
<main class="bp-main">
  <article>
    ${date ? `<span class="bp-date">${esc(date)}</span>` : ""}
    <h1>${esc(title)}</h1>
    ${excerpt ? `<p class="bp-lead">${esc(excerpt)}</p>` : ""}
    <img class="bp-cover" src="${BLOG_IMAGES[n]}" alt="${esc(title)}" />
    <div class="bp-body">${paragraphs}</div>
    <div class="bp-cta">
      <a class="bp-btn" href="/#bewerbung-form">Jetzt bewerben</a>
      <a href="/#blog">Weitere Beiträge</a>
    </div>
  </article>
</main>
<footer class="bp-footer">© ${new Date().getFullYear()} ${firm} · <a href="/impressum.html">Impressum</a> · <a href="/datenschutz.html">Datenschutz</a></footer>
</body>
</html>`;
}

const APPLY_MODAL_CSS = `
/* Bewerbungsfenster: wird vom Landing-Server auf /bewerben geöffnet. */
#lov-apply-modal{position:fixed;inset:0;z-index:9999;display:none;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto;background:rgba(8,12,24,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#lov-apply-modal.is-open{display:flex}
#lov-apply-modal .lov-apply-dialog{position:relative;width:100%;max-width:880px;background:#fff;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.35);overflow:hidden;animation:lovApplyIn .25s ease}
@keyframes lovApplyIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
#lov-apply-modal .lov-apply-close{position:absolute;top:14px;right:14px;z-index:2;width:38px;height:38px;border-radius:50%;border:0;background:rgba(15,23,42,.85);color:#fff;font-size:22px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
#lov-apply-modal .lov-apply-body{max-height:calc(100vh - 80px);overflow-y:auto}
#lov-apply-modal .lov-apply-body>section{padding-top:32px;padding-bottom:32px}
body.lov-apply-open{overflow:hidden}
@media(max-width:640px){#lov-apply-modal{padding:12px 8px}#lov-apply-modal .lov-apply-body{max-height:calc(100vh - 24px)}}
/* Auf /bewerben wird das Formular als normaler Seitenabschnitt ausgeliefert. */
#lov-apply-inline{display:block;width:100%}
#lov-apply-inline>section{padding-top:48px;padding-bottom:48px}
`;

function renderCss(row: LandingRow): string {
  const t = THEMES[row.theme_id];
  return t ? `${applyPlaceholders(t.css, row.branding, row.slots)}\n${APPLY_MODAL_CSS}` : "/* theme missing */";
}
function renderJs(row: LandingRow): string {
  const t = THEMES[row.theme_id];
  return t ? applyPlaceholders(t.js, row.branding, row.slots) : "// theme missing";
}

function statusPage(title: string, text: string): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
  :root{color-scheme:light}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#f6f7f9;color:#1c2430;
       font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  main{max-width:32rem;padding:2.5rem 1.5rem;text-align:center}
  h1{font-size:1.4rem;margin:0 0 .75rem;font-weight:650}
  p{margin:0;color:#5b6674}
</style></head>
<body><main><h1>${title}</h1><p>${text}</p></main></body></html>`;
}

// ── HTTP-Handler ─────────────────────────────────────────────────────────
const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/_health") return new Response("ok");

    // Caddy on_demand_tls ask endpoint
    if (path === "/_internal/ask") {
      const domain = (url.searchParams.get("domain") || "").toLowerCase();
      if (!domain) return new Response("missing domain", { status: 400 });
      const { row } = await loadLandingState(domain);
      return row ? new Response("ok") : new Response("not found", { status: 404 });
    }

    const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
    if (!host) return new Response("no host", { status: 400 });
    const { row, degraded } = await loadLandingState(host);
    if (!row) {
      console.warn(`[landing-server] keine Landing für ${host} (${degraded ? "Backend-Störung" : "kein Datensatz"})`);
      return degraded
        ? new Response(
            statusPage("Die Seite ist gerade nicht erreichbar", "Wir haben ein kurzes technisches Problem. Bitte lade die Seite in einem Moment neu."),
            { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "30" } },
          )
        : new Response(
            statusPage("Diese Seite ist nicht verfügbar", "Unter dieser Adresse ist derzeit keine Seite hinterlegt."),
            { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
          );
    }

    if (path === "/style.css") {
      return new Response(renderCss(row), { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public,max-age=300" } });
    }
    if (path === "/script.js") {
      return new Response(renderJs(row), { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public,max-age=300" } });
    }
    if (path.startsWith("/assets/logo")) {
      if (row.logo_url) return Response.redirect(row.logo_url, 302);
      return new Response("no logo", { status: 404 });
    }
    if (path.startsWith("/assets/favicon")) {
      if (row.favicon_url) return Response.redirect(row.favicon_url, 302);
      return new Response("no favicon", { status: 404 });
    }
    // Statische Theme-Assets (Hero-Bilder, Service-Bilder etc.) direkt von Disk
    // ausliefern — liegen unter themes/<theme_id>/assets/<file>.
    if (path.startsWith("/assets/")) {
      const rel = path.slice("/assets/".length);
      // Sicherheit: keine Path-Traversal, kein Unterordner
      if (!rel || rel.includes("..") || rel.includes("/") || rel.includes("\\")) {
        return new Response("bad path", { status: 400 });
      }
      const file = Bun.file(join(themesDir, row.theme_id, "assets", rel));
      if (await file.exists()) {
        return new Response(file, {
          headers: {
            "content-type": file.type || "application/octet-stream",
            "cache-control": "public,max-age=86400,immutable",
          },
        });
      }
      return new Response("asset not found", { status: 404 });
    }
    if (path === "/" || path === "/index.html") {
      const { body, status } = await renderHtml(row, host);
      return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
    }
    if (path === "/bewerben" || path === "/bewerben.html") {
      const { body, status } = await renderHtml(row, host, "apply");
      return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
    }
    if (path === "/danke" || path === "/danke.html") {
      return new Response(renderThanks(row, url.searchParams), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
    }
    if (path === "/impressum" || path === "/impressum.html") {
      return new Response(renderLegal(row, "impressum"), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
    }
    if (path === "/datenschutz" || path === "/datenschutz.html") {
      return new Response(renderLegal(row, "datenschutz"), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
    }
    const blogMatch = /^\/blog\/([1-9][0-9]?)(?:\.html)?$/.exec(path);
    if (blogMatch) {
      const blogHtml = renderBlogPost(row, Number(blogMatch[1]));
      if (blogHtml) return new Response(blogHtml, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
      return new Response("", { status: 302, headers: { location: "/#blog" } });
    }
    if (path === "/blog" || path === "/blog/") return new Response("", { status: 302, headers: { location: "/#blog" } });
    return new Response("not found", { status: 404 });
  },
});

console.log(`[landing-server] listening on http://127.0.0.1:${server.port}`);
