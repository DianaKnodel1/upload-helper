import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateLandingZip } from "@/lib/landing-generator.functions";
import { listLandingTemplates } from "@/lib/landing-templates.functions";
import { renderSectionsPreview } from "@/lib/landing-builder.functions";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listLandingPages,
  getLandingPage,
  saveLandingPage,
  deleteLandingPage,
  checkLandingPageDeletable,
  toggleLandingPublished,
} from "@/lib/landing-pages.functions";
import { listPartnerCompanies } from "@/lib/partner-companies.functions";
import { adminListSchedules } from "@/lib/appointments.functions";
import { THEME_LIST, THEMES, ACTIVE_THEME_LIST, ARCHIVE_THEME_LIST, isActiveTheme } from "@/lib/landing-themes";
import { THEME_ASSETS } from "@/lib/theme-assets.generated";
import { PORTAL_THEMES, type PortalThemeId } from "@/lib/portal-themes";
import { setTenantPortalTheme } from "@/lib/portal-theme.functions";
import PortalThemePreview from "@/components/admin/PortalThemePreview";


const ASSET_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  gif: "image/gif", svg: "image/svg+xml", ico: "image/x-icon", avif: "image/avif",
};
function assetToDataUrl(filename: string, b64: string): string {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const mime = ASSET_MIME[ext] || "application/octet-stream";
  if (mime === "image/svg+xml") {
    try { return `data:image/svg+xml;utf8,${encodeURIComponent(atob(b64))}`; } catch { /* fallthrough */ }
  }
  return `data:${mime};base64,${b64}`;
}
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Download, Globe, Loader2, CheckCircle2, Eye, ExternalLink, Save, Trash2, Power, Pencil, Plus, Copy, ExternalLink as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyFlowCopy } from "@/lib/flow-copy";

export const Route = createFileRoute("/admin/landing-generator")({
  head: () => ({
    meta: [
      { title: "Landing-Page-Generator — MB Portal" },
      { name: "description", content: "Landingpages erstellen, kopieren und veröffentlichen." },
      { property: "og:title", content: "Landing-Page-Generator — MB Portal" },
      { property: "og:description", content: "Landingpages erstellen, kopieren und veröffentlichen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandingGeneratorPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center space-y-4">
      <h2 className="text-xl font-bold text-destructive">Generator konnte nicht geladen werden</h2>
      <p className="text-muted-foreground">Dies deutet oft auf ein unvollständiges Datenbank-Schema hin.</p>
      <Button onClick={() => window.location.reload()}>Erneut versuchen</Button>
    </div>
  ),
});

type Branding = {
  firmenname: string;
  primary_color: string;
  secondary_color: string;
  whatsapp_number: string;
  whatsapp_enabled: boolean;
  email: string;
  telefon: string;
  telefon_2: string;
  strasse: string;
  plz: string;
  stadt: string;
  hrb: string;
  registergericht: string;
  ust_id: string;
  steuernummer: string;
  geschaeftsfuehrer: string;
  impressum: string;
  landing_domain: string;
  api_endpoint: string;
  portal_url: string;
  meta_pixel_id: string;
  meta_pixel_code: string;
  portal_theme: PortalThemeId;

  supabase_url: string;
  supabase_anon_key: string;
  tenant_id: string;
  flow_type: "classic" | "fast" | "broker";
  source_slug: string;
  calendly_url: string;
  intermediate_company_name: string;
  redirect_delay_ms: number;
  partner_company_id: string;
  seo_title: string;
  seo_description: string;
  seo_image: string;
  interview_mode: "chat" | "voice" | "both";
  interview_voice_id: string;
  interview_system_prompt: string;
  linked_fasttrack_landing_id: string;
  recruiter_name: string;
  recruiter_avatar_url: string;
  recruiter_avatar_data_url: string;
  booking_mode: "calendly" | "internal" | "off";
  event_description: string;
  booking_window_days: number;
};

const EMPTY: Branding = {
  firmenname: "",
  primary_color: "#2563eb",
  secondary_color: "#1e40af",
  whatsapp_number: "",
  whatsapp_enabled: false,
  email: "",
  telefon: "",
  telefon_2: "",
  strasse: "",
  plz: "",
  stadt: "",
  hrb: "",
  registergericht: "",
  ust_id: "",
  steuernummer: "",
  geschaeftsfuehrer: "",
  impressum: "",
  landing_domain: "",
  api_endpoint: "",
  portal_url: "",
  meta_pixel_id: "",
  meta_pixel_code: "",
  portal_theme: "clean",

  supabase_url: "",
  supabase_anon_key: "",
  tenant_id: "",
  flow_type: "fast",
  source_slug: "",
  calendly_url: "",
  intermediate_company_name: "",
  redirect_delay_ms: 2500,
  partner_company_id: "",
  seo_title: "",
  seo_description: "",
  seo_image: "",
  interview_mode: "chat",
  interview_voice_id: "XrExE9yKIg1WjnnlVkGX",
  interview_system_prompt: "",
  linked_fasttrack_landing_id: "",
  recruiter_name: "Martin Schneider",
  recruiter_avatar_url: "",
  recruiter_avatar_data_url: "",
  booking_mode: "calendly",
  event_description: "",
  booking_window_days: 30,
};

const BRANDING_DRIVEN_SLOT_KEYS = new Set([
  "logo_text",
  "firmenname",
  "seo_title",
  "seo_description",
  "landing_domain",
  "address",
  "contact_address",
  "contact_email",
  "contact_phone",
  "sitz_stadt",
  "sitz_stadt_upper",
  "hrb_nummer",
  "footer_address",
  "footer_email",
  "footer_phone",
]);

const GENERATED_PAGE_SLOT_VALUES: Record<string, string> = {
  impressum_url: "impressum.html",
  datenschutz_url: "datenschutz.html",
};

function formatBrandingAddress(b: Branding, separator = ", ") {
  return [b.strasse, [b.plz, b.stadt].filter(Boolean).join(" ")].filter(Boolean).join(separator);
}

function brandingSlotValue(key: string, b: Branding): string | undefined {
  if (key === "logo_text" || key === "firmenname") return b.firmenname || undefined;
  if (key === "seo_title") return b.seo_title || undefined;
  if (key === "seo_description") return b.seo_description || undefined;
  if (key === "landing_domain") return b.landing_domain || undefined;
  if (key === "address" || key === "contact_address") return formatBrandingAddress(b) || undefined;
  if (key === "sitz_stadt") return b.stadt || undefined;
  if (key === "sitz_stadt_upper") return b.stadt ? b.stadt.toUpperCase() : undefined;
  if (key === "hrb_nummer") return b.hrb || undefined;
  if (key === "footer_address") return formatBrandingAddress(b, "\n") || undefined;
  if (key === "contact_email" || key === "footer_email") return b.email || undefined;
  if (key === "contact_phone" || key === "footer_phone") return b.telefon || undefined;
  return undefined;
}

function themeSlotDefaults(id: string): Record<string, string> {
  const theme = THEME_LIST.find((t) => t.id === id);
  const defaults: Record<string, string> = {};
  for (const s of theme?.slots ?? []) defaults[s.key] = s.default;
  return defaults;
}

function normalizeSlotsForTheme(
  id: string,
  values: Record<string, string> = {},
  brandingValue?: Branding,
): Record<string, string> {
  const theme = THEME_LIST.find((t) => t.id === id);
  const slots = theme?.slots ?? [];
  const allowed = new Set(slots.map((s) => s.key));
  const normalized = themeSlotDefaults(id);
  for (const [key, value] of Object.entries(values)) {
    if (allowed.has(key)) normalized[key] = value;
  }
  if (brandingValue) {
    for (const key of BRANDING_DRIVEN_SLOT_KEYS) {
      if (!allowed.has(key)) continue;
      const synced = brandingSlotValue(key, brandingValue);
      if (synced !== undefined) normalized[key] = synced;
    }
  }
  for (const [key, value] of Object.entries(GENERATED_PAGE_SLOT_VALUES)) {
    if (allowed.has(key)) normalized[key] = value;
  }
  return normalized;
}

function withSeoDefaults(b: Branding): Branding {
  return {
    ...b,
    seo_title: b.seo_title || (b.firmenname ? `${b.firmenname} — Karriere & Beratung` : ""),
    seo_description:
      b.seo_description ||
      (b.firmenname
        ? `${b.firmenname} — Jetzt bewerben und Teil unseres Teams werden. Strategische Beratung mit messbaren Ergebnissen.`
        : ""),
  };
}

function LandingGeneratorPage() {
  const { toast } = useToast();
  const generate = useServerFn(generateLandingZip);

  const [themeId, setThemeId] = useState<string>(THEME_LIST[0]?.id ?? "");
  const [branding, setBranding] = useState<Branding>(EMPTY);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [faviconDataUrl, setFaviconDataUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastFile, setLastFile] = useState<string | null>(null);
  // Editor-State: welche Landing wird gerade bearbeitet (id) + slug
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string>("");
  const saveFn = useServerFn(saveLandingPage);
  const listFn = useServerFn(listLandingPages);
  const getFn = useServerFn(getLandingPage);
  const delFn = useServerFn(deleteLandingPage);
  const checkDelFn = useServerFn(checkLandingPageDeletable);
  const [deleteTarget, setDeleteTarget] = useState<
    { id: string; domain: string; schedules: number; appointments: number } | null
  >(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toggleFn = useServerFn(toggleLandingPublished);
  const setPortalThemeFn = useServerFn(setTenantPortalTheme);
  const [landings, setLandings] = useState<any[]>([]);
  const [landingsLoading, setLandingsLoading] = useState(true);
  const listPartnersFn = useServerFn(listPartnerCompanies);
  const [partners, setPartners] = useState<Array<{ id: string; name: string; calendly_url: string; logo_url: string | null }>>([]);
  useEffect(() => {
    listPartnersFn({} as any).then((r: any) => setPartners(r?.rows ?? [])).catch((err) => {
      console.error("Partners load error:", err);
      setPartners([]);
    });
  }, [listPartnersFn]);

  // Terminzeiten (Verfügbarkeiten) je Landing — für den Setup-Check in der Liste.
  const listSchedulesFn = useServerFn(adminListSchedules);
  const [scheduleLandingIds, setScheduleLandingIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    listSchedulesFn({} as any)
      .then((r: any) =>
        setScheduleLandingIds(
          new Set(
            ((r?.rows ?? []) as any[])
              .filter((s) => s.active && s.landing_page_id)
              .map((s) => String(s.landing_page_id)),
          ),
        ),
      )
      .catch((err) => {
        console.error("Schedules load error:", err);
        setScheduleLandingIds(new Set());
      });
  }, [listSchedulesFn]);

  const reloadLandings = useCallback(async () => {
    setLandingsLoading(true);
    try {
      const r = await listFn({} as any);
      if (!r) throw new Error("Keine Daten vom Server erhalten");
      setLandings((r as any)?.rows ?? []);
    } catch (e: any) {
      console.error("Landings load error:", e);
      toast({ 
        title: "Generator-Daten unvollständig", 
        description: "Das Backend ist möglicherweise nicht auf dem neuesten Stand oder die Tabelle 'landing_pages' fehlt.", 
        variant: "destructive" 
      });
      setLandings([]);
    } finally {
      setLandingsLoading(false);
    }
  }, [listFn, toast]);

  useEffect(() => { reloadLandings(); }, [reloadLandings]);
  const listTemplatesFn = useServerFn(listLandingTemplates);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  useEffect(() => {
    listTemplatesFn().then((r: any) => setSavedTemplates(r?.rows ?? [])).catch(() => setSavedTemplates([]));
  }, [listTemplatesFn]);
  // Eigene Baukasten-Vorlage als Grundlage (statt festem Theme)
  const [templateId, setTemplateId] = useState<string | null>(null);
  // Gespeicherte Baukasten-Seite als Vorlage im Generator (Original bleibt unverändert)
  const [pageTemplate, setPageTemplate] = useState<any | null>(null);
  const selectedTemplate =
    savedTemplates.find((t) => t.id === templateId) ??
    (pageTemplate && pageTemplate.id === templateId ? pageTemplate : null);
  const selectTemplate = (template: any) => {
    const style = template?.style && typeof template.style === "object" ? template.style : {};
    setPageTemplate(null);
    setTemplateId(template.id);
    setEditingId(null);
    setSlug("");
    setBranding((current) => ({
      ...current,
      primary_color: typeof style.primary === "string" ? style.primary : current.primary_color,
      secondary_color: typeof style.accent === "string" ? style.accent : current.secondary_color,
    }));
    setLogoDataUrl(null);
    setFaviconDataUrl(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const usePageAsTemplate = (landing: any) => {
    const template = {
      id: `page-${landing.id}`,
      name: landing.branding?.firmenname?.trim?.() || landing.slug,
      sections: Array.isArray(landing.sections) ? landing.sections : [],
      style: landing.branding?.style || {},
    };
    setPageTemplate(template);
    const style = template.style && typeof template.style === "object" ? template.style : {};
    setTemplateId(template.id);
    setEditingId(null);
    setSlug("");
    setBranding((current) => ({
      ...current,
      primary_color: typeof style.primary === "string" ? style.primary : current.primary_color,
      secondary_color: typeof style.accent === "string" ? style.accent : current.secondary_color,
    }));
    setLogoDataUrl(null);
    setFaviconDataUrl(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const sectionsPreviewFn = useServerFn(renderSectionsPreview);
  const [templatePreviewHtml, setTemplatePreviewHtml] = useState("");
  useEffect(() => {
    if (!selectedTemplate) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res: any = await sectionsPreviewFn({
          data: {
            sections: Array.isArray(selectedTemplate.sections) ? selectedTemplate.sections : [],
            branding: {
              firmenname: branding.firmenname, primary_color: branding.primary_color,
              secondary_color: branding.secondary_color, kontakt_email: branding.email,
              email: branding.email, telefon: branding.telefon,
              whatsapp_number: branding.whatsapp_number, whatsapp_enabled: branding.whatsapp_enabled,
              impressum: branding.impressum, seo_title: branding.seo_title,
              seo_description: branding.seo_description,
              style: {
                ...(selectedTemplate.style || {}),
                primary: branding.primary_color,
                accent: branding.secondary_color,
              },
            },
            logo_url: logoDataUrl && logoDataUrl.length < 500 ? logoDataUrl : null,
          },
        });
        if (!cancelled) setTemplatePreviewHtml(res?.html ?? "");
      } catch {
        if (!cancelled) setTemplatePreviewHtml("");
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate, branding, logoDataUrl]);

  // Slot-Werte pro Theme — bei Theme-Wechsel mit Defaults vorbelegen.
  const [slotValues, setSlotValues] = useState<Record<string, string>>(() => {
    try {
      return themeSlotDefaults(THEME_LIST[0]?.id ?? "");
    } catch (e) {
      console.error("Default slots error:", e);
      return {};
    }
  });
  const currentTheme = THEME_LIST.find((t) => t.id === themeId);
  const currentSlots = currentTheme?.slots ?? [];
  const slotsForOutput = normalizeSlotsForTheme(themeId, slotValues, withSeoDefaults(branding));


  // Pflichtangaben nach § 5 DDG — fehlen sie, ist das Impressum unvollständig.
  const impressumMissing = (
    [
      ["Firmenname", branding.firmenname],
      ["Straße & Hausnummer", branding.strasse],
      ["PLZ", branding.plz],
      ["Stadt", branding.stadt],
      ["Kontakt-E-Mail", branding.email],
      ["Vertretungsberechtigte(r) / Geschäftsführer", branding.geschaeftsfuehrer],
    ] as const
  )
    .filter(([, value]) => !String(value ?? "").trim())
    .map(([label]) => label);

  const selectTheme = (id: string) => {
    setTemplateId(null);
    setPageTemplate(null);
    setThemeId(id);
    setSlotValues(normalizeSlotsForTheme(id, {}, withSeoDefaults(branding)));
  };
  const setSlot = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSlotValues((v) => ({ ...v, [key]: e.target.value }));

  // Standard-Textwelt je Modus (Vermittlung vs. Fast-Track) in die Hero-Slots setzen.
  const applyModeCopy = (flow: string, onlyDefaults = true) => {
    setSlotValues((v) => applyFlowCopy(themeId, flow, v, themeSlotDefaults(themeId), onlyDefaults));
  };

  const set = (key: keyof Branding) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setBranding((b) => ({ ...b, [key]: e.target.value }));

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) { setLogoDataUrl(null); return; }
    if (f.size > 8 * 1024 * 1024) {
      toast({ title: "Logo zu groß", description: "Max. 8 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  };

  const onFavicon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) { setFaviconDataUrl(null); return; }
    if (f.size > 200 * 1024) {
      toast({ title: "Favicon zu groß", description: "Max. 200 KB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFaviconDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  };

  // Live-Preview: Theme-HTML/CSS clientseitig mit Platzhaltern füllen und
  // als single-doc <iframe srcdoc> rendern (Logo als data-URL inline).
  const previewSrcDoc = (() => {
    const theme = THEMES.find((t) => t.id === themeId);
    if (!theme) return "";
    const replace = (src: string) => {
      let out = src;
      // Auto-Defaults für SEO, damit Preview den Tab-Titel anzeigt
      const seoTitle = branding.seo_title || (branding.firmenname ? `${branding.firmenname} — Karriere & Beratung` : "Landing-Page");
      const seoDesc = branding.seo_description || (branding.firmenname ? `${branding.firmenname} — Jetzt bewerben.` : "");
      const previewBranding = { ...branding, seo_title: seoTitle, seo_description: seoDesc };
      // Hochgeladenes Logo/Favicon in {{logo_image}}/{{favicon_image}} spiegeln.
      const previewSlots: Record<string, string> = { ...slotsForOutput };
      if (logoDataUrl && !previewSlots.logo_image) previewSlots.logo_image = logoDataUrl;
      if (faviconDataUrl && !previewSlots.favicon_image) previewSlots.favicon_image = faviconDataUrl;
      // Computed Aliase: address/contact_email/contact_phone aus Firmendaten.
      const addrParts = [previewBranding.strasse, [previewBranding.plz, previewBranding.stadt].filter(Boolean).join(" ")]
        .filter(Boolean).join(", ");
      const aliases: Record<string, string> = {
        address: addrParts,
        contact_address: addrParts,
        contact_email: previewBranding.email || "",
        contact_phone: previewBranding.telefon || "",
        sitz_stadt: previewBranding.stadt || "",
        sitz_stadt_upper: previewBranding.stadt ? previewBranding.stadt.toUpperCase() : "",
        hrb_nummer: previewBranding.hrb || "",
      };
      const merged: Record<string, unknown> = { ...aliases, ...previewBranding, ...previewSlots };
      for (let i = 0; i < 3; i++) {
        let changed = false;
        for (const [k, v] of Object.entries(merged)) {
          const token = `{{${k}}}`;
          if (out.includes(token)) { out = out.split(token).join(String(v ?? "")); changed = true; }
        }
        if (!changed) break;
      }
      return out;
    };
    let html = replace(theme.html);
    const css = replace(theme.css);
    // Leere/kaputte Meta-Tags auch im Preview entfernen
    if (!branding.seo_image) {
      html = html.replace(/\s*<meta[^>]*property=["']og:image["'][^>]*content=["']["'][^>]*>\s*/gi, "\n");
    }
    if (!branding.landing_domain) {
      html = html.replace(/\s*<link[^>]*rel=["']canonical["'][^>]*href=["']https?:\/\/\/[^"']*["'][^>]*>\s*/gi, "\n");
      html = html.replace(/\s*<meta[^>]*property=["']og:url["'][^>]*content=["']https?:\/\/\/[^"']*["'][^>]*>\s*/gi, "\n");
    }
    // Live-Renderer und ZIP liefern Impressum/Datenschutz als eigene Seiten.
    // Preview ebenfalls ohne Inline-Rechtstexte rendern, sonst wirkt die Landing
    // unnötig lang und alte #impressum/#datenschutz-Sektionen bleiben sichtbar.
    html = html.replace(/<section[^>]*id=["'](?:impressum|datenschutz)["'][\s\S]*?<\/section>\s*/gi, "");
    // <link rel="stylesheet" href="style.css"> durch inline <style> ersetzen
    // + Override für Scroll-Animationen (data-animate ist im Theme initial opacity:0,
    //   wird normal per IntersectionObserver in script.js eingeblendet – im Preview
    //   ohne JS bleibt sonst alles unsichtbar).
    html = html.replace(
      /<link[^>]+href=["']style\.css["'][^>]*>/i,
      `<style>${css}\n[data-animate]{opacity:1!important;transform:none!important}</style>`,
    );
    // Logo durch data-URL ersetzen, sonst Platzhalter-Pixel
    const logoSrc = logoDataUrl ?? "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40'><rect width='100%' height='100%' fill='%23e2e8f0'/><text x='50%' y='55%' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%2364748b'>Logo</text></svg>";
    html = html.replace(/assets\/logo\.[a-z]+/gi, logoSrc);
    // Alle übrigen Theme-Assets (Bilder, SVGs) ebenfalls als data-URL inlinen,
    // sonst zeigt der Blob-/srcdoc-Preview „kaputtes Bild" – im ZIP funktioniert es,
    // weil dort die assets/ neben der index.html landen.
    const bundle = THEME_ASSETS[themeId] ?? {};
    for (const [fname, b64] of Object.entries(bundle)) {
      if (/^logo\./i.test(fname)) continue;
      const dataUrl = assetToDataUrl(fname, b64);
      // sowohl in src="assets/x" als auch in url('assets/x') / url("assets/x") ersetzen
      const escaped = fname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp(`assets\\/${escaped}`, "gi"), dataUrl);
    }
    // script.js entfernen (Preview ohne Submit) + Mini-Smooth-Scroll injizieren,
    // damit Hash-Links (#angebot etc.) im srcdoc-iframe nicht das Doc neuladen
    // → andernfalls bleibt der iframe in "Laden..." hängen.
    html = html.replace(/<script[^>]*src=["']script\.js["'][^>]*><\/script>/i, "");
    const previewScript = `<script>
var LEGAL_IDS = ["impressum","datenschutz","agb"];
function syncLegal(){
  var h = (location.hash||"").replace("#","");
  document.querySelectorAll(".legal").forEach(function(el){ el.classList.remove("is-open"); });
  if (LEGAL_IDS.indexOf(h) >= 0){
    var el = document.getElementById(h);
    if (el){ el.classList.add("is-open"); el.scrollIntoView({behavior:"smooth",block:"start"}); }
  }
}
window.addEventListener("hashchange", syncLegal);
setTimeout(syncLegal, 50);
document.addEventListener('click', function(e){
  var burger = e.target.closest && e.target.closest('#burger, .burger, [aria-label="Menü"], [aria-label="Menu"]');
  if(burger){
    e.preventDefault();
    var nav = document.getElementById('nav-links') || document.querySelector('.nav-links, nav');
    if(nav) nav.classList.toggle('open');
    return;
  }


  var a = e.target.closest && e.target.closest('a[href^="#"]');
  if(a){
    var id = a.getAttribute('href');
    if(id && id.length > 1){
      var target = id.slice(1);
      // Bewerbungs-Modal: CTA öffnet Modal statt zum versteckten Container zu scrollen
      if (target === 'bewerbung-form'){
        e.preventDefault();
        var m = document.getElementById('lov-apply-modal');
        if(m){ m.classList.add('is-open'); document.body.classList.add('lov-apply-open'); }
        return;
      }
      // Legal-Links: nativen Hash-Wechsel zulassen → :target + hashchange greifen
      if (LEGAL_IDS.indexOf(target) >= 0){
        e.preventDefault();
        if (location.hash === id){ syncLegal(); } else { location.hash = id; }
        return;
      }
      e.preventDefault();
      document.querySelectorAll('.legal').forEach(function(s){ s.classList.remove('is-open'); });
      if (location.hash){ try { history.replaceState(null, '', location.pathname + location.search); } catch(_){} }
      var el = document.querySelector(id);
      if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
    }
    return;
  }

  var b = e.target.closest && e.target.closest('.faq-q');
  if(b){ var item = b.closest('.faq-item'); if(item) item.classList.toggle('open'); }
}, true);
var __FLOW = ${JSON.stringify(branding.flow_type || "classic")};
var __WA = ${JSON.stringify(branding.whatsapp_enabled ? (branding.whatsapp_number || "").replace(/[^0-9]/g, "") : "")};
var __API = ${JSON.stringify(branding.api_endpoint || "")};
var __TENANT = ${JSON.stringify(branding.tenant_id || "")};
var __PORTAL = ${JSON.stringify(branding.portal_url || "")};
var __SLUG = ${JSON.stringify(branding.source_slug || branding.landing_domain || branding.firmenname || "preview")};
function __waFormatNumber(num){ var d=String(num||'').replace(/[^0-9]/g,''); if(!d) return ''; if(d.length>4) return '+'+d.slice(0,2)+' '+d.slice(2,5)+' '+d.slice(5); return '+'+d; }
function showApplicationModal(opts){
  opts = opts || {}; var isFast = !!opts.fast; var wa = String(opts.whatsapp||'').replace(/[^0-9]/g,'');
  var overlay = document.createElement('div');
  overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;backdrop-filter:blur(2px);';
  var box = document.createElement('div');
  box.style.cssText='background:#fff;color:#0f172a;max-width:460px;width:100%;border-radius:14px;padding:28px;box-shadow:0 20px 60px -10px rgba(0,0,0,.35);font-family:inherit;position:relative;';
  var close = document.createElement('button'); close.type='button'; close.innerHTML='&times;';
  close.style.cssText='position:absolute;top:10px;right:14px;background:none;border:0;font-size:24px;line-height:1;cursor:pointer;color:#64748b;';
  close.onclick=function(){ overlay.remove(); };
  var check = document.createElement('div');
  check.style.cssText='width:46px;height:46px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;margin-bottom:14px;';
  check.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  var h = document.createElement('h3'); h.textContent='Vielen Dank für Ihre Bewerbung';
  h.style.cssText='margin:0 0 8px;font-size:22px;font-weight:700;line-height:1.25;';
  var p = document.createElement('p'); p.style.cssText='margin:0 0 18px;color:#475569;font-size:15px;line-height:1.55;';
  box.appendChild(close); box.appendChild(check); box.appendChild(h); box.appendChild(p);
  if(isFast){
    p.textContent='Vielen Dank für Ihre Bewerbung. Im nächsten Schritt werden Sie zum Mitarbeiter-Portal für die Registrierung weitergeleitet.';
    var goNowPrev = document.createElement('button');
    goNowPrev.type='button'; goNowPrev.textContent='Jetzt zum Portal →';
    goNowPrev.style.cssText='display:block;width:100%;background:#0f172a;color:#fff;border:0;padding:12px 18px;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;margin-bottom:12px;';
    var hasRealRedir = opts.redirectUrl && /^https?:\\/\\//i.test(opts.redirectUrl);
    if(hasRealRedir){ goNowPrev.onclick = function(){ window.top ? window.top.location.href = opts.redirectUrl : window.location.href = opts.redirectUrl; }; }
    else { goNowPrev.onclick = function(){ alert('[Vorschau] Weiterleitung deaktiviert — kein Portal-URL gesetzt.'); }; }
    var redirInfo = document.createElement('p');
    redirInfo.style.cssText='margin:0 0 12px;font-size:13px;color:#64748b;';
    redirInfo.textContent = hasRealRedir ? 'Klick "Jetzt zum Portal", um Weiterleitung in neuem Tab zu testen.' : '[Vorschau] Keine echte Weiterleitung (kein Portal-URL gesetzt).';
    box.appendChild(goNowPrev); box.appendChild(redirInfo);
  } else if(wa){
    p.textContent='Vielen Dank für Ihre Bewerbung. Wir haben Ihre Bewerbung erhalten und melden uns binnen 10 Tagen zurück.';
    var card = document.createElement('div');
    card.style.cssText='background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px;';
    var label = document.createElement('div'); label.textContent='SCHNELLER KONTAKT';
    label.style.cssText='font-size:11px;font-weight:700;letter-spacing:.08em;color:#2563eb;margin-bottom:8px;';
    var info = document.createElement('p'); info.style.cssText='margin:0 0 12px;font-size:14px;color:#475569;line-height:1.5;';
    info.innerHTML='Melden Sie sich bei WhatsApp unter <strong>'+__waFormatNumber(wa)+'</strong>, um auf dem neusten Stand zu bleiben.';
    var btn = document.createElement('a');
    btn.href='https://wa.me/'+wa+'?text='+encodeURIComponent('Hallo, ich habe gerade meine Bewerbung abgeschickt.');
    btn.target='_blank'; btn.rel='noopener';
    btn.style.cssText='display:flex;align-items:center;justify-content:center;gap:8px;background:#22c55e;color:#fff;text-decoration:none;font-weight:600;padding:12px 16px;border-radius:8px;font-size:15px;';
    btn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24z"/></svg> WhatsApp-Chat starten';
    card.appendChild(label); card.appendChild(info); card.appendChild(btn);
    box.appendChild(card);
  } else {
    p.textContent='Wir haben Ihre Unterlagen erhalten und melden uns i.d.R. innerhalb von 10 Tagen per E-Mail bei Ihnen.';
  }
  var closeBtn = document.createElement('button'); closeBtn.type='button'; closeBtn.textContent='Schließen';
  closeBtn.style.cssText='background:#fff;border:1px solid #cbd5e1;color:#0f172a;padding:9px 18px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;';
  closeBtn.onclick=function(){ overlay.remove(); };
  box.appendChild(closeBtn); overlay.appendChild(box);
  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}
document.addEventListener('submit', function(e){
  var f = e.target && e.target.id === 'application-form' ? e.target : null;
  if(!f) return;
  e.preventDefault();
  var status = document.getElementById('form-status');
  var raw = Object.fromEntries(new FormData(f).entries());
  var first = (raw.first_name||'').toString().trim();
  var last = (raw.last_name||'').toString().trim();
  var street = (raw.street||'').toString().trim();
  var msg = (raw.message||'').toString().trim();
  var payload = {
    full_name: ((first + ' ' + last).trim()) || (raw.full_name||'').toString() || 'Vorschau-Test',
    email: (raw.email||'').toString().trim() || 'preview-test@example.com',
    phone: raw.phone || null,
    postal_code: raw.postal_code || null,
    city: raw.city || null,
    message: [street ? 'Adresse: ' + street : '', msg].filter(Boolean).join('\\n\\n') || null,
    tenant_id: __TENANT || null,
    portal_url: __PORTAL || null,
    flow_type: __FLOW,
    source_slug: __SLUG,
    is_test: true,
  };
  if(!__API){
    if(status){ status.className='status error'; status.textContent='⚠️ Kein API-Endpoint konfiguriert (Feld "API-Endpoint" leer).'; }
    return;
  }
  if(status){ status.className='status'; status.textContent='Test-Bewerbung wird gesendet …'; }
  fetch(__API, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(function(res){
      try { f.reset(); } catch(_){}
      if(status){ status.className='status success'; status.textContent='✅ Test-Bewerbung gespeichert (mit [TEST]-Markierung).'; }
      var redir = (res && res.redirect_url) ? res.redirect_url : '';
      showApplicationModal({ fast: __FLOW === 'fast', whatsapp: __WA, redirectUrl: redir });
    })
    .catch(function(err){
      if(status){ status.className='status error'; status.textContent='❌ Fehler: '+(err && err.message ? err.message : 'Senden fehlgeschlagen'); }
    });
}, true);
<\/script>`;

    html = html.replace(/<\/body>/i, previewScript + "</body>");

    return html;
  })();

  const handleGenerate = async () => {
    if (!branding.firmenname || !branding.email) {
      toast({ title: "Fehlende Felder", description: "Firmenname und E-Mail sind Pflicht.", variant: "destructive" });
      return;
    }
    if (branding.flow_type !== "broker" && !branding.api_endpoint) {
      toast({ title: "API-Endpoint fehlt", description: "Klassisch/Fast-Track brauchen den Portal-API-Endpoint.", variant: "destructive" });
      return;
    }
    if (!branding.landing_domain.trim()) {
      toast({ title: "Landing-Domain fehlt", description: "Trage die öffentliche Domain ein (z.B. easy-gmbh.de) — wird für Canonical/SEO benötigt.", variant: "destructive" });
      return;
    }
    if (branding.flow_type === "fast" && !branding.portal_url.trim()) {
      toast({ title: "Portal-URL fehlt", description: "Fast-Track braucht eine Portal-URL für die Weiterleitung. Trage z.B. https://portal.deine-firma.de ein.", variant: "destructive" });
      return;
    }
    if (!branding.tenant_id.trim()) {
      toast({ title: "Tenant-ID fehlt", description: "Ohne Tenant-ID landet die Bewerbung beim falschen Mandanten. Hol sie aus Admin → Tenants.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await generate({ data: { themeId, branding: withSeoDefaults(branding), logoDataUrl, faviconDataUrl, slots: slotsForOutput } });
      // Base64 → Blob → Download
      const bin = atob(res.zipBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLastFile(res.filename);
      toast({ title: "ZIP heruntergeladen", description: res.filename });
    } catch (err: any) {
      toast({ title: "Fehler", description: err?.message ?? "Generierung fehlgeschlagen", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Slug-Auto-Vorschlag aus Domain/Firmenname (nur wenn leer + nicht im Edit-Mode)
  const ensureSlug = () => {
    if (slug || editingId) return;
    const base = (branding.landing_domain || branding.firmenname || "").toLowerCase();
    const auto = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    if (auto) setSlug(auto);
  };

  const validateRequired = (): string | null => {
    if (!branding.firmenname || !branding.email) return "Firmenname und E-Mail sind Pflicht.";
    if (branding.flow_type !== "broker" && !branding.api_endpoint) return "API-Endpoint ist für Klassisch/Fast-Track Pflicht.";
    if (!branding.landing_domain.trim()) return "Landing-Domain fehlt.";
    if (branding.flow_type === "fast" && !branding.portal_url.trim()) return "Fast-Track braucht Portal-URL.";
    if (branding.flow_type === "fast" && !branding.calendly_url.trim()) return "Bitte den Calendly-Link dieser Firma hinterlegen — Bewerbung und Termin laufen auf derselben Seite.";
    if (branding.flow_type === "broker" && !branding.calendly_url.trim() && !branding.linked_fasttrack_landing_id.trim()) return "Vermittlung braucht einen Calendly-Link (oder eine Fast-Track-Firma mit Calendly-Link).";
    if (!branding.tenant_id.trim()) return "Tenant-ID fehlt.";
    return null;
  };


  const handleSaveLive = async () => {
    // Archivierte Themes sind für bestehende Seiten weiter bearbeitbar,
    // dürfen aber nicht versehentlich für eine neue Seite verwendet werden.
    if (!editingId && !selectedTemplate && themeId && !isActiveTheme(themeId)) {
      toast({
        title: "Archiv-Theme nicht wählbar",
        description: "Alte Vorlagen laufen nur für bestehende Seiten weiter. Bitte eine der 6 aktuellen Vorlagen auswählen.",
        variant: "destructive",
      });
      return;
    }
    const err = validateRequired();
    if (err) { toast({ title: "Pflichtfelder fehlen", description: err, variant: "destructive" }); return; }
    ensureSlug();
    const finalSlug = slug || (branding.landing_domain || branding.firmenname).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    if (!/^[a-z0-9-]+$/.test(finalSlug)) {
      toast({ title: "Ungültiger Slug", description: "Nur a-z, 0-9 und -", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const b = withSeoDefaults(branding);
      const row = await saveFn({ data: {
        id: editingId ?? undefined,
        slug: finalSlug,
        domain: branding.landing_domain,
        tenant_id: branding.tenant_id || null,
        theme_id: themeId,
        branding: {
          firmenname: b.firmenname, primary_color: b.primary_color, secondary_color: b.secondary_color,
          whatsapp_number: b.whatsapp_number, whatsapp_enabled: b.whatsapp_enabled, email: b.email,
          telefon: b.telefon, telefon_2: b.telefon_2, strasse: b.strasse, plz: b.plz, stadt: b.stadt,
          hrb: b.hrb, registergericht: b.registergericht, ust_id: b.ust_id, steuernummer: b.steuernummer,
          geschaeftsfuehrer: b.geschaeftsfuehrer, impressum: b.impressum,
          api_endpoint: b.api_endpoint, portal_url: b.portal_url, tenant_id: b.tenant_id,
          meta_pixel_id: (b.meta_pixel_id || "").trim(),
          meta_pixel_code: (b.meta_pixel_code || "").trim(),
          portal_theme: b.portal_theme || "clean",

          seo_title: b.seo_title, seo_description: b.seo_description, seo_image: b.seo_image,
          recruiter_name: b.recruiter_name || "Martin Schneider",
          recruiter_avatar_url: b.recruiter_avatar_url || null,
          ...(selectedTemplate
            ? {
                style: {
                  ...(selectedTemplate.style || {}),
                  primary: b.primary_color,
                  accent: b.secondary_color,
                },
              }
            : {}),
        },
        slots: slotsForOutput,
        ...(selectedTemplate
          ? {
              sections: (Array.isArray(selectedTemplate.sections) ? selectedTemplate.sections : []).map((s: any) => ({
                ...s,
                data: { ...s.data },
                id: `sec_${Math.random().toString(36).slice(2, 10)}`,
              })),
            }
          : {}),
        flow_type: branding.flow_type,
        source_slug: branding.source_slug || "",
        is_published: true,
        calendly_url: branding.calendly_url || "",
        intermediate_company_name: branding.intermediate_company_name || "",
        intermediate_logo_url: "",
        redirect_delay_ms: Number(branding.redirect_delay_ms ?? 2500),
        partner_company_id: branding.partner_company_id || null,
        interview_mode: branding.interview_mode || "chat",
        interview_voice_id: branding.interview_voice_id || null,
        interview_system_prompt: branding.interview_system_prompt || null,
        linked_fasttrack_landing_id: branding.linked_fasttrack_landing_id || null,
        recruiter_name: branding.recruiter_name || null,
        recruiter_avatar_url: branding.recruiter_avatar_url || null,
        recruiter_avatar_data_url: branding.recruiter_avatar_data_url || null,
        logo_data_url: logoDataUrl,
        favicon_data_url: faviconDataUrl,
        booking_mode: "calendly",
        event_description: branding.event_description || null,
        booking_window_days: Number(branding.booking_window_days ?? 30),
      } as any });
      setEditingId((row as any).id);
      setSlug((row as any).slug);

      // Warnung: Vermittlung ohne Fast-Track-Verknüpfung → Bewerber-Mails
      // können keinen Portal-Link (Bewerbung/Termin/Registrierung) bilden.
      if (branding.flow_type === "broker" && !branding.linked_fasttrack_landing_id) {
        toast({
          title: "⚠️ Keine Fast-Track-Verknüpfung",
          description:
            "Diese Vermittlungsseite hat keine verknüpfte Fast-Track-Seite. Bewerber-Mails (Eingangsbestätigung, Terminbestätigung, Interview-Link) können dann keinen Portal-Link erzeugen und werden übersprungen.",
          variant: "destructive",
        });
      }

      // Portal-Design auf den Tenant übertragen (nur Fast-Track hat ein Portal).
      if (branding.flow_type === "fast" && branding.tenant_id) {
        try {
          await setPortalThemeFn({ data: { tenant_id: branding.tenant_id, portal_theme: branding.portal_theme || "clean" } });
        } catch (e: any) {
          toast({
            title: "Portal-Design nicht übernommen",
            description: e?.message ?? String(e),
            variant: "destructive",
          });
        }
      }

      const r: any = row;

      const dnsLabel = r.dnsStatus === "auto" ? "DNS automatisch gesetzt" : r.dnsStatus === "manual" ? "DNS-Hinweis (kein Fehler)" : r.dnsStatus === "skipped" ? "Kein Server im Pool" : "DNS-Fehler";
      const serverLabel = r.assignedServer ? `Server: ${r.assignedServer.name}` : "Kein Server zugewiesen";
      const isHardError = r.dnsStatus === "error";
      toast({
        title: `Landing gespeichert — ${dnsLabel}`,
        description: `${serverLabel}. ${r.dnsMessage ?? ""} ${r.dnsStatus === "manual" ? "Die Landing ist online, sobald der A-Record beim Registrar gesetzt ist." : ""}`.trim(),
        variant: isHardError ? "destructive" : "default",
      });
      reloadLandings();

    } catch (e: any) {
      toast({ title: "Speichern fehlgeschlagen", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEditLanding = async (id: string) => {
    try {
      const row: any = await getFn({ data: { id } } as any);
      setEditingId(row.id);
      setSlug(row.slug);
      setTemplateId(null);
      setPageTemplate(null);
      setLogoDataUrl(null); setFaviconDataUrl(null);
      const loadedBranding = {
        ...EMPTY,
        ...(row.branding ?? {}),
        landing_domain: row.domain,
        source_slug: row.source_slug ?? "",
        flow_type: row.flow_type,
        tenant_id: row.tenant_id ?? row.branding?.tenant_id ?? "",
        calendly_url: row.calendly_url ?? "",
        intermediate_company_name: row.intermediate_company_name ?? "",
        redirect_delay_ms: row.redirect_delay_ms ?? 2500,
        partner_company_id: row.partner_company_id ?? "",
        interview_mode: row.interview_mode ?? "chat",
        interview_voice_id: row.interview_voice_id ?? "XrExE9yKIg1WjnnlVkGX",
        interview_system_prompt: row.interview_system_prompt ?? "",
        linked_fasttrack_landing_id: row.linked_fasttrack_landing_id ?? "",
        recruiter_name: row.recruiter_name ?? row.branding?.recruiter_name ?? "Martin Schneider",
        recruiter_avatar_url: row.recruiter_avatar_url ?? row.branding?.recruiter_avatar_url ?? "",
        recruiter_avatar_data_url: "",
        booking_mode: "calendly",
        event_description: row.event_description ?? "",
        booking_window_days: row.booking_window_days ?? 30,
      } as Branding;
      setThemeId(row.theme_id);
      setSlotValues(normalizeSlotsForTheme(row.theme_id, row.slots ?? {}, withSeoDefaults(loadedBranding)));
      setBranding(loadedBranding);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast({ title: "Landing geladen", description: row.domain });
    } catch (e: any) {
      toast({ title: "Laden fehlgeschlagen", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const handleNewLanding = () => {
    const nextThemeId = THEME_LIST[0]?.id ?? "";
    setEditingId(null); setSlug(""); setBranding(EMPTY);
    setTemplateId(null); setPageTemplate(null);
    setLogoDataUrl(null); setFaviconDataUrl(null); setSlotValues({});
    setThemeId(nextThemeId);
    setSlotValues(themeSlotDefaults(nextThemeId));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string, domain: string) => {
    try {
      const res: any = await checkDelFn({ data: { id } } as any);
      setDeleteTarget({
        id, domain,
        schedules: res?.schedules ?? 0,
        appointments: res?.appointments ?? 0,
      });
    } catch (e: any) {
      toast({ title: "Prüfung fehlgeschlagen", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await delFn({ data: { id: deleteTarget.id } } as any);
      if (editingId === deleteTarget.id) handleNewLanding();
      toast({ title: "Gelöscht", description: deleteTarget.domain });
      setDeleteTarget(null);
      reloadLandings();
    } catch (e: any) {
      toast({ title: "Löschen fehlgeschlagen", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setDeleteBusy(false);
    }
  };

  const deactivateFromDialog = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await toggleFn({ data: { id: deleteTarget.id, is_published: false } } as any);
      toast({ title: "Deaktiviert", description: `${deleteTarget.domain} ist offline.` });
      setDeleteTarget(null);
      reloadLandings();
    } catch (e: any) {
      toast({ title: "Fehler", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setDeleteBusy(false);
    }
  };


  const handleTogglePublished = async (id: string, next: boolean) => {
    try {
      await toggleFn({ data: { id, is_published: next } } as any);
      reloadLandings();
    } catch (e: any) {
      toast({ title: "Fehler", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const apiPlaceholder = "https://portal.mb-portal.com/api/public/applications";

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
            <Globe className="h-5 w-5" /> Landing-Page-Generator
            {editingId && <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded">Bearbeiten: {slug}</span>}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <strong>Speichern & live schalten</strong> → Landing wird zentral auf Server 1 gehostet (kein FTP, automatisches SSL).
            Kunde setzt DNS A-Record auf die Server-1-IP, fertig. ZIP-Download bleibt als Backup verfügbar.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/landing-baukasten">
            <Button variant="outline" size="sm" className="gap-2">
              <Pencil className="h-4 w-4" /> Zum Baukasten (Abschnitte frei anordnen)
            </Button>
          </Link>
          {editingId && (
            <Button variant="outline" size="sm" onClick={handleNewLanding} className="gap-2">
              <Plus className="h-4 w-4" /> Neue Landing
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((s) => !s)}
            className="gap-2 lg:hidden"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? "Vorschau aus" : "Vorschau ein"}
          </Button>
        </div>
      </div>

      {/* Liste aller gespeicherten Landings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Gespeicherte Landings ({landings.length})</span>
            <Button size="sm" variant="ghost" onClick={reloadLandings} className="h-7 text-xs">↻ Aktualisieren</Button>
          </CardTitle>
          <CardDescription>Alle laufen auf Server 1. Klick „Bearbeiten" um eine zu laden.</CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const missing = landings.filter((l) => !l.branding?.firmenname?.trim?.());
            if (missing.length === 0) return null;
            return (
              <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
                <div className="font-semibold text-destructive mb-1">⚠️ Firmenname fehlt bei {missing.length} Landing{missing.length === 1 ? "" : "s"}</div>
                <p className="text-muted-foreground mb-2">
                  Ohne Firmennamen stellt sich der KI-Recruiter mit „unserem Unternehmen" vor — unpersönlich. Bitte pflegen:
                </p>
                <ul className="space-y-1">
                  {missing.map((l) => (
                    <li key={l.id}>
                      <button className="underline hover:text-destructive" onClick={() => handleEditLanding(l.id)}>
                        {l.domain} / {l.slug}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
          {landingsLoading ? (
            <p className="text-xs text-muted-foreground">Lade …</p>
          ) : landings.length === 0 ? (
            <p className="text-xs text-muted-foreground">Noch keine Landing gespeichert. Fülle das Formular unten aus und klick „Speichern & live schalten".</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-1.5 px-2 font-medium">Domain</th>
                    <th className="text-left py-1.5 px-2 font-medium">Slug</th>
                    <th className="text-left py-1.5 px-2 font-medium">Theme</th>
                    <th className="text-left py-1.5 px-2 font-medium">Flow</th>
                    <th className="text-left py-1.5 px-2 font-medium">Verknüpfung</th>
                    <th className="text-left py-1.5 px-2 font-medium">Setup</th>
                    <th className="text-left py-1.5 px-2 font-medium">Status</th>
                    <th className="text-right py-1.5 px-2 font-medium">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {landings.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-1.5 px-2 font-mono">
                        <a href={`https://${l.domain}`} target="_blank" rel="noopener" className="hover:underline inline-flex items-center gap-1">
                          {l.domain} <LinkIcon className="h-3 w-3 opacity-50" />
                        </a>
                      </td>
                      <td className="py-1.5 px-2 font-mono text-muted-foreground">{l.slug}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{l.theme_id}</td>
                      <td className="py-1.5 px-2">{l.flow_type === "broker" ? "🤝 Vermittlung (alt)" : "✅ Direkt"}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">
                        {(() => {
                          const nameOf = (x: any) => x?.branding?.firmenname?.trim?.() || x?.slug || "?";
                          const target = l.linked_fasttrack_landing_id
                            ? landings.find((x) => x.id === l.linked_fasttrack_landing_id)
                            : null;
                          if (target) return <span title="Weiterleitung + geteilte Terminzeiten">{nameOf(l)} → {nameOf(target)}</span>;
                          const source = landings.find((x) => x.linked_fasttrack_landing_id === l.id);
                          if (source) return <span title="Wird von dieser Vermittlung beliefert – geteilte Terminzeiten">← {nameOf(source)}</span>;
                          return <span className="opacity-40">–</span>;
                        })()}
                      </td>
                      <td className="py-1.5 px-2">
                        {(() => {
                          // Was eine Landing braucht, damit der Ablauf durchläuft:
                          // 1) Vermittlung → Ziel (Fast-Track / Partner / Calendly)
                          // 2) Eigenes Buchungssystem → aktive Terminzeiten
                          const problems: string[] = [];
                          if (
                            l.flow_type === "broker" &&
                            !l.linked_fasttrack_landing_id &&
                            !l.partner_company_id &&
                            !String(l.calendly_url ?? "").trim()
                          ) {
                            problems.push("Vermittlungsziel fehlt");
                          }
                          // Bewerber-Mails brauchen zwingend die Fast-Track-Verknüpfung
                          // (Portal-Link). Partner/Calendly reichen dafür nicht.
                          if (l.flow_type === "broker" && !l.linked_fasttrack_landing_id) {
                            problems.push("Fast-Track-Verknüpfung fehlt (keine Portal-Links in Mails)");
                          }
                          const bookingMode = l.booking_mode ?? "calendly";
                          if (bookingMode === "internal") {
                            const targetId = l.linked_fasttrack_landing_id as string | null;
                            const hasSchedule =
                              scheduleLandingIds.has(String(l.id)) ||
                              (targetId ? scheduleLandingIds.has(String(targetId)) : false);
                            if (!hasSchedule) problems.push("Terminzeiten fehlen");
                          }
                          if (problems.length === 0) {
                            return <span className="text-emerald-600" title="Vermittlung und Terminzeiten sind gesetzt">✓ bereit</span>;
                          }
                          return (
                            <a
                              href="/admin/verfuegbarkeit"
                              className="text-amber-600 hover:underline"
                              title="Ohne diese Angaben kann kein Termin gebucht werden"
                            >
                              ⚠ {problems.join(" · ")}
                            </a>
                          );
                        })()}
                      </td>
                      <td className="py-1.5 px-2">
                        {l.is_published ? <span className="text-emerald-600">● live</span> : <span className="text-muted-foreground">○ pausiert</span>}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleEditLanding(l.id)} title="Bearbeiten">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {Array.isArray(l.sections) && l.sections.length > 0 && (
                            <Button size="sm" variant="ghost" className="h-7 px-2" title="Als Vorlage für neue Seite verwenden" onClick={() => usePageAsTemplate(l)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleTogglePublished(l.id, !l.is_published)} title={l.is_published ? "Pausieren" : "Aktivieren"}>
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => handleDelete(l.id, l.domain)} title="Löschen">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>





      <div className="grid lg:grid-cols-[1fr_640px] gap-6 items-start">
        {/* LEFT: Form */}
        <div className="space-y-6 min-w-0">
          {/* Step 1: Theme */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">1. Theme wählen</CardTitle>
              <CardDescription>
                Sechs aktuelle Premium-Vorlagen — alle führen direkt zur Bewerbung.
                Frühere Vorlagen liegen im Archiv und laufen nur für bestehende Seiten weiter.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2">
                {ACTIVE_THEME_LIST.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTheme(t.id)}
                    className={cn(
                      "text-left rounded-lg border-2 p-3 transition-all",
                      themeId === t.id && !templateId
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm truncate">{t.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground/70 font-mono">{t.id}</span>
                        {themeId === t.id && !templateId && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                  </button>
                ))}
                {savedTemplates.map((t) => (
                  <button
                    key={`tpl-${t.id}`}
                    type="button"
                    onClick={() => selectTemplate(t)}
                    className={cn(
                      "text-left rounded-lg border-2 p-3 transition-all",
                      templateId === t.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm truncate">{t.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] rounded px-1.5 py-0.5 font-medium bg-muted text-muted-foreground">
                          Eigene Vorlage
                        </span>
                        {templateId === t.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {t.description || `${Array.isArray(t.sections) ? t.sections.length : 0} Abschnitte aus dem Baukasten`}
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-4 border-t pt-3 space-y-2">
                <div className="text-sm font-semibold">Gespeicherte Baukasten-Seiten verwenden</div>
                <p className="text-xs text-muted-foreground">
                  Erstellt eine neue, unveröffentlichte Kopie. Die bestehende Seite bleibt unverändert.
                </p>
                {landingsLoading ? (
                  <p className="text-xs text-muted-foreground">Seiten werden geladen …</p>
                ) : landings.filter((landing) => Array.isArray(landing.sections) && landing.sections.length > 0).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Noch keine Seite aus dem Baukasten gespeichert.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {landings
                      .filter((landing) => Array.isArray(landing.sections) && landing.sections.length > 0)
                      .map((landing) => (
                        <button
                          key={landing.id}
                          type="button"
                          onClick={() => usePageAsTemplate(landing)}
                          className={cn(
                            "text-left rounded-lg border-2 p-3 transition-all block w-full",
                            templateId === `page-${landing.id}` ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm truncate">
                              {landing.branding?.firmenname?.trim?.() || landing.slug}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-primary shrink-0">
                              {templateId === `page-${landing.id}` ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Als Vorlage verwenden
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{landing.domain || landing.slug}</p>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Archiv: frühere Themes — nur ansehen, keine Auswahl für neue Seiten */}
              <div className="mt-4 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30">
                <details className="px-3 py-2.5">
                  <summary className="cursor-pointer select-none flex items-center justify-between gap-2 text-sm font-semibold">
                    <span>Archiv — frühere Vorlagen</span>
                    <span className="text-[11px] font-normal text-muted-foreground">nur ansehen · keine neue Auswahl</span>
                  </summary>
                  <p className="text-xs text-muted-foreground mt-2 mb-3">
                    Alte Themes laufen für bestehende Landingpages unverändert weiter. Neue Seiten bitte mit einer der 6 aktuellen Vorlagen erstellen.
                  </p>
                  <div className="grid grid-cols-1 gap-2 pb-1">
                    {ARCHIVE_THEME_LIST.map((t) => (
                      <div
                        key={`arch-${t.id}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/60 p-3 opacity-90"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{t.name}</span>
                            <span className="text-[10px] rounded px-1.5 py-0.5 font-medium bg-muted text-muted-foreground shrink-0">
                              Archiv
                            </span>
                            {themeId === t.id && !templateId && (
                              <span className="text-[10px] text-muted-foreground shrink-0">wird angezeigt</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 shrink-0"
                          title="Theme nur in der Vorschau ansehen"
                          onClick={() => selectTheme(t.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </details>
              </div>

            </CardContent>
          </Card>

          {/* Step 2: Branding */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">2. Branding & Inhalte</CardTitle>
              <CardDescription>Änderungen erscheinen sofort in der Live-Vorschau rechts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Setup-Vorlage / Pflichtfeld-Hilfe */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
                <div className="font-semibold text-primary">📋 Setup-Vorlage — was MUSS rein, damit es funktioniert</div>
                <ul className="space-y-1.5 text-muted-foreground">
                  <li><strong className="text-foreground">Firmenname *</strong> — z.B. <code>UWK Consulting GmbH</code></li>
                  <li><strong className="text-foreground">Kontakt-E-Mail *</strong> — Reply-Adresse, z.B. <code>info@uwk-consulting.de</code></li>
                  <li><strong className="text-foreground">Landing-Domain *</strong> — Domain der Landing (ohne <code>https://</code>), z.B. <code>uwk-consulting.de</code></li>
                  <li>
                    <strong className="text-foreground">API-Endpoint *</strong> — IMMER dein zentrales Portal-Backend:<br/>
                    <code>https://portal.mb-portal.com/api/public/applications</code> (für alle Kunden gleich)
                  </li>
                  <li>
                    <strong className="text-foreground">Tenant-ID *</strong> — UUID aus Admin → Tenants → Spalte „ID" kopieren.<br/>
                    Ohne Tenant-ID kommen Bewerbungen NICHT beim richtigen Kunden an (Reminder/Accept-Mail nutzen falschen SMTP).
                  </li>
                  <li>
                    <strong className="text-foreground">Mitarbeiter-Portal URL *</strong> (bei Fast-Track Pflicht) — Portal des Tenants,<br/>
                    z.B. <code>https://portal.uwk-consulting.de</code>. Nach Bewerbung Auto-Redirect zur Registrierung.
                  </li>
                  <li><strong className="text-foreground">WhatsApp-Nummer</strong> (optional) — international ohne <code>+</code>, z.B. <code>491701234567</code>. Aktiviert Floating-Button + Kontakt-Card.</li>
                  <li><strong className="text-foreground">Logo / Favicon / Farben</strong> — empfohlen, aber nicht Pflicht.</li>
                </ul>
                <div className="pt-1 text-[11px] text-muted-foreground">
                  Felder unten ohne <span className="text-primary">*</span> sind optional (Impressum-Daten, SEO-Bild, Telefon-2, etc.).
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Firmenname *"><Input value={branding.firmenname} onChange={set("firmenname")} placeholder="Mustermann GmbH" /></Field>
                <Field label="Logo (PNG/JPG/SVG, max 8 MB)">
                  <div className="space-y-2">
                    <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onLogo} />
                    {logoDataUrl && (
                      <div className="rounded border bg-muted/30 p-2 flex items-center justify-center h-16">
                        <img src={logoDataUrl} alt="Logo Preview" className="max-h-12 object-contain" />
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">Empfohlen: ≥200×60 px, transparenter Hintergrund.</p>
                  </div>
                </Field>
                <Field label="Favicon (ICO/PNG/SVG, max 200 KB)">
                  <div className="space-y-2">
                    <Input type="file" accept="image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml" onChange={onFavicon} />
                    {faviconDataUrl && (
                      <div className="rounded border bg-muted/30 p-2 flex items-center justify-center h-12">
                        <img src={faviconDataUrl} alt="Favicon Preview" className="max-h-8 object-contain" />
                      </div>
                    )}
                  </div>
                </Field>
                <Field label="Primärfarbe">
                  <div className="flex gap-2">
                    <Input type="color" value={branding.primary_color} onChange={set("primary_color")} className="w-16 p-1 h-10" />
                    <Input value={branding.primary_color} onChange={set("primary_color")} />
                  </div>
                </Field>
                <Field label="Sekundärfarbe">
                  <div className="flex gap-2">
                    <Input type="color" value={branding.secondary_color} onChange={set("secondary_color")} className="w-16 p-1 h-10" />
                    <Input value={branding.secondary_color} onChange={set("secondary_color")} />
                  </div>
                </Field>
                <Field label="WhatsApp-Nummer (international, ohne +)"><Input value={branding.whatsapp_number} onChange={set("whatsapp_number")} placeholder="491234567890" /></Field>
                <Field label="WhatsApp im Erfolgs-Popup & als Floating-Button anzeigen">
                  <label className="flex items-center gap-2 h-10 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={branding.whatsapp_enabled}
                      onChange={(e) => setBranding((b) => ({ ...b, whatsapp_enabled: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    <span className="text-muted-foreground">
                      Aktiviert „Jetzt bei WhatsApp kontaktieren" nach erfolgreicher Bewerbung (Link auf wa.me/{branding.whatsapp_number || "…"}).
                    </span>
                  </label>
                </Field>
                <Field label="Kontakt-E-Mail *"><Input type="email" value={branding.email} onChange={set("email")} /></Field>
                <Field label="Telefon"><Input value={branding.telefon} onChange={set("telefon")} /></Field>
                <Field label="Straße & Hausnummer"><Input value={branding.strasse} onChange={set("strasse")} /></Field>
                <Field label="PLZ"><Input value={branding.plz} onChange={set("plz")} maxLength={20} /></Field>
                <Field label="Stadt"><Input value={branding.stadt} onChange={set("stadt")} /></Field>
                <Field label="HRB-Nummer"><Input value={branding.hrb} onChange={set("hrb")} /></Field>
                <Field label="Registergericht"><Input value={branding.registergericht} onChange={set("registergericht")} placeholder="Amtsgericht Berlin" /></Field>
                <Field label="USt-IdNr."><Input value={branding.ust_id} onChange={set("ust_id")} placeholder="DE123456789" /></Field>
                <Field label="Steuernummer"><Input value={branding.steuernummer} onChange={set("steuernummer")} /></Field>
                <Field label="Geschäftsführer"><Input value={branding.geschaeftsfuehrer} onChange={set("geschaeftsfuehrer")} /></Field>
                <Field label="Telefon 2 (optional)"><Input value={branding.telefon_2} onChange={set("telefon_2")} /></Field>
                <Field label="Landing-Domain * (für SEO/Canonical & OG-URL)"><Input value={branding.landing_domain} onChange={set("landing_domain")} placeholder="easy-gmbh.de" /></Field>
                <Field label="Tracking-Slug (Funnel-Statistik)">
                  <Input
                    value={branding.source_slug}
                    onChange={set("source_slug")}
                    placeholder={branding.landing_domain || "z.B. kw24-fast-de"}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Wird mit jeder Bewerbung gespeichert (<code>source_slug</code>). So siehst du im Funnel-Panel: <em>1000 Bewerbungen → 650 registriert → 210 abgeschlossen</em>. Leer = Domain wird automatisch genutzt.
                  </p>
                </Field>
                <Field label="Meta-/Facebook-Pixel-ID (optional)">
                  <Input value={branding.meta_pixel_id} onChange={set("meta_pixel_id")} placeholder="z.B. 1234567890123456" />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Leer = kein Pixel, kein Cookie-Hinweis. Gefüllt: Das Pixel lädt auf allen Seiten der Landing Page und meldet auf <code>/danke</code> das Ereignis <code>Lead</code>.
                    In Europa erscheint vorher ein schlanker Einwilligungs-Hinweis; erst nach „Einverstanden“ lädt das Pixel.
                  </p>
                </Field>
                <Field label="Eigener Meta-Pixel-Code (komplett, optional)">
                  <Textarea
                    rows={6}
                    value={branding.meta_pixel_code}
                    onChange={set("meta_pixel_code")}
                    placeholder="<!-- Meta Pixel Code --> … kompletten Code vom Werbeberater hier reinkopieren …"
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Gefüllt: Dieser Code wird 1:1 eingebunden und <strong>überschreibt die Pixel-ID oben</strong>. Das Ereignis <code>Lead</code> auf <code>/danke</code> und der Einwilligungs-Hinweis bleiben automatisch erhalten. Leer = es gilt die Pixel-ID.
                  </p>
                </Field>
                <Field label="API-Endpoint für Bewerbungen *">
                  <Input value={branding.api_endpoint} onChange={set("api_endpoint")} placeholder={apiPlaceholder} />
                  <p className="text-[10px] text-muted-foreground mt-1">Immer das zentrale Portal-Backend: <code>https://portal.mb-portal.com/api/public/applications</code></p>
                </Field>
                {branding.flow_type === "fast" && (
                  <Field label="Mitarbeiter-Portal URL * (Redirect nach Fast-Track-Bewerbung)">
                    <Input value={branding.portal_url} onChange={set("portal_url")} placeholder="https://portal.uwk-consulting.de" />
                    <p className="text-[10px] text-muted-foreground mt-1">Tenant-eigenes Portal. Bei Fast-Track wird der Bewerber hierhin zu <code>/register</code> weitergeleitet.</p>
                  </Field>
                )}
                {branding.flow_type === "fast" && (
                  <div className="sm:col-span-2 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                    <Label className="text-xs font-semibold">Portal-Design (Login & Registrierung)</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Gilt für das Mitarbeiter-Portal dieses Tenants: Login, Registrierung und Passwort-vergessen. Wird beim Speichern auf den Tenant übertragen.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {PORTAL_THEMES.map((pt) => (
                        <button
                          key={pt.id}
                          type="button"
                          onClick={() => setBranding((b) => ({ ...b, portal_theme: pt.id }))}
                          className={cn(
                            "text-left rounded-md border-2 p-3 transition-all text-xs",
                            branding.portal_theme === pt.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">{pt.name}</span>
                            {branding.portal_theme === pt.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </div>
                          <PortalThemePreview id={pt.id} />
                          <p className="text-muted-foreground text-[11px] mt-2">{pt.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Field label="Supabase URL (optional — nur bei Direkt-Insert)">
                  <Input value={branding.supabase_url} onChange={set("supabase_url")} placeholder="leer lassen" />
                </Field>
                <Field label="Supabase Anon Key (optional)">
                  <Input value={branding.supabase_anon_key} onChange={set("supabase_anon_key")} placeholder="leer lassen" />
                </Field>
                <Field label="Tenant-ID * (UUID aus Admin → Tenants)">
                  <Input value={branding.tenant_id} onChange={set("tenant_id")} placeholder="z.B. 6b9c1f2a-4d3e-…" />
                  <p className="text-[10px] text-muted-foreground mt-1">Pflicht! Ohne Tenant-ID landet die Bewerbung beim falschen Mandanten.</p>
                </Field>

              </div>
              <Field label="Impressum-Text">
                <Textarea rows={4} value={branding.impressum} onChange={set("impressum")} />
              </Field>

              {/* Flow-Typ — neue Seiten sind immer einheitlich (Fast-Track):
                  Bewerbung, Termin und Portal laufen auf derselben Domain.
                  "Vermittlung" bleibt nur sichtbar, wenn eine Bestandsseite
                  noch auf broker steht (Bearbeitung von Altseiten). */}
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <Label className="text-xs font-semibold">Bewerbungs-Weg</Label>
                {branding.flow_type === "broker" ? (
                  <p className="text-[11px] text-muted-foreground">
                    🤝 <strong>Bestandsseite „Vermittlung“</strong> — leitet weiter zur verknüpften Firma. Für neue Seiten gibt es diesen Weg nicht mehr; bestehende Seiten laufen unverändert weiter.
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    ✅ <strong>Direkte Bewerbung</strong> — Bewerbung, Termin und Portal laufen auf derselben Seite, ohne Weiterleitung zu einer anderen Firma. Calendly-Link und Portal-URL dieser Firma hinterlegen.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => applyModeCopy(branding.flow_type, false)}
                  className="text-[11px] underline text-muted-foreground hover:text-foreground"
                >
                  Standard-Texte einsetzen (überschreibt Hero-Texte)
                </button>
              </div>

              {/* KI-Bewerbungsgespräch — nur Fast-Track + Klassisch. Bei Vermittlung erbt der Lead die Einstellung der verknüpften Fast-Track-Landing. */}
              {branding.flow_type === "broker" ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">
                  🤖 <span className="font-semibold">KI-Bewerbungsgespräch:</span> Wird von der verknüpften Fast-Track-Landing gesteuert (Vermittlungen leiten nur weiter und buchen Calendly — das Interview findet beim Fast-Track-Partner statt).
                </div>
              ) : (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <Label className="text-xs font-semibold">🤖 KI-Bewerbungsgespräch</Label>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Nach dem Absenden der Bewerbung führt die KI das Erstgespräch. Du wählst pro Landing, ob schriftlich oder per Sprache. Verlauf, KI-Zusammenfassung und Empfehlung erscheinen im Admin unter der Bewerbung.
                  </p>
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  {([
                    { id: "chat", title: "💬 KI-Chat", desc: "Schriftlich. Niedrige Hürde, hohe Abschlussrate, günstig (~0,05 € / Gespräch)." },
                    { id: "voice", title: "🎙️ KI-Telefon", desc: "Wie ein echtes Telefonat (ElevenLabs). Wow-Effekt, qualifiziert besser, braucht Mikro & ruhige Umgebung." },
                    { id: "both", title: "🔀 Beides", desc: "Bewerber wählt selbst. Gut zum A/B-Testen." },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBranding((b) => ({ ...b, interview_mode: opt.id }))}
                      className={cn(
                        "text-left rounded-md border-2 p-3 transition-all text-xs",
                        branding.interview_mode === opt.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <div className="font-semibold mb-1">{opt.title}</div>
                      <p className="text-muted-foreground text-[11px]">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                {(branding.interview_mode === "voice" || branding.interview_mode === "both") && (
                  <Field label="Stimme (ElevenLabs)">
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={branding.interview_voice_id}
                      onChange={(e) => setBranding((b) => ({ ...b, interview_voice_id: e.target.value }))}
                    >
                      <option value="XrExE9yKIg1WjnnlVkGX">Matilda — weiblich, warm (deutsch)</option>
                      <option value="IKne3meq5aSn9XLyUdCD">Charlie — männlich, freundlich</option>
                      <option value="JBFqnCBsd6RMkjVDRZzb">George — männlich, seriös</option>
                      <option value="FGY2WhTYpPnrIDTdsKH5">Laura — weiblich, professionell</option>
                      <option value="EXAVITQu4vr4xnSDxMaL">Sarah — weiblich, ruhig</option>
                    </select>
                  </Field>
                )}

                <div className="grid sm:grid-cols-[120px_1fr] gap-3 items-start pt-2 border-t border-border/50">
                  <div className="space-y-2">
                    <Label className="text-xs">Profilbild</Label>
                    <label className="block cursor-pointer">
                      <div
                        className="w-[120px] h-[120px] rounded-full border-2 border-dashed border-border bg-muted/40 overflow-hidden flex items-center justify-center text-xs text-muted-foreground hover:border-primary/50 transition"
                        style={
                          (branding.recruiter_avatar_data_url || branding.recruiter_avatar_url)
                            ? { backgroundImage: `url(${branding.recruiter_avatar_data_url || branding.recruiter_avatar_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                            : undefined
                        }
                      >
                        {!branding.recruiter_avatar_data_url && !branding.recruiter_avatar_url && <span>+ Upload</span>}
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (f.size > 5_000_000) { toast({ title: "Bild zu groß (max 5 MB)", variant: "destructive" }); return; }
                          const reader = new FileReader();
                          reader.onload = () => setBranding((b) => ({ ...b, recruiter_avatar_data_url: String(reader.result || "") }));
                          reader.readAsDataURL(f);
                        }}
                      />
                    </label>
                    {(branding.recruiter_avatar_url || branding.recruiter_avatar_data_url) && (
                      <button
                        type="button"
                        className="text-[10px] text-destructive hover:underline"
                        onClick={() => setBranding((b) => ({ ...b, recruiter_avatar_url: "", recruiter_avatar_data_url: "" }))}
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Field label="Name der Recruiter:in">
                      <Input
                        value={branding.recruiter_name}
                        onChange={(e) => setBranding((b) => ({ ...b, recruiter_name: e.target.value }))}
                        placeholder="z. B. Martin Schneider"
                      />
                    </Field>
                    <p className="text-[11px] text-muted-foreground">
                      Dieser Name + Bild wird Bewerbern im Gespräch angezeigt. Quadratisches Bild empfohlen (min. 256×256, max. 5 MB).
                    </p>
                  </div>
                </div>

                <details className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                    Erweitert: Eigener System-Prompt (optional)
                  </summary>
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      ⚠️ <strong>Sobald hier Text steht, wird der globale Default aus <a href="/admin/ai-settings" className="underline">AI-Settings</a> für diese Landing komplett ignoriert.</strong> Leer lassen = globaler Default greift.
                    </p>
                    <Textarea
                      rows={6}
                      placeholder="Leer = globaler Default aus AI-Settings (empfohlen). Nur ausfüllen, wenn diese Landing einen abweichenden Fragenkatalog/Ton braucht."
                      value={branding.interview_system_prompt}
                      onChange={set("interview_system_prompt")}
                    />
                    {branding.interview_system_prompt?.trim() && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-500">
                        Aktiv: Diese Landing nutzt den eigenen Prompt, nicht den AI-Settings-Default.
                      </p>
                    )}
                  </div>
                </details>

              </div>
              )}




              {/* Vermittlung: Fast-Track-Firma wählen */}
              {branding.flow_type === "broker" && (
                <div className="space-y-3 rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
                  <div>
                    <Label className="text-xs font-semibold">🤝 Vermittlungs-Konfiguration</Label>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Verknüpft diese Landing mit einer <strong>Fast-Track-Firma</strong> (separate Verwaltung unter <a href="/admin/partner-companies" className="underline">Vermittlung → Fast-Track-Firmen</a>). Daraus werden automatisch Firmenname, Logo, Calendly-Link und Portal-Register-URL für den Erfolgsblock („Wir verbinden Sie mit …") gezogen. Die Felder unten überschreiben die Fast-Track-Werte falls gesetzt.
                    </p>
                  </div>
                  <Field label="Fast-Track-Firma">
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={branding.partner_company_id}
                      onChange={(e) => {
                        const id = e.target.value;
                        const p = partners.find((x) => x.id === id);
                        setBranding((b) => ({
                          ...b,
                          partner_company_id: id,
                          calendly_url: p?.calendly_url ?? b.calendly_url,
                          intermediate_company_name: p?.name ?? b.intermediate_company_name,
                        }));
                      }}
                    >
                      <option value="">— keine, manuell unten ausfüllen —</option>
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="→ Weiterleitung nach CTA-Klick auf Fasttrack-Landing">
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={branding.linked_fasttrack_landing_id}
                      onChange={(e) => setBranding((b) => ({ ...b, linked_fasttrack_landing_id: e.target.value }))}
                    >
                      <option value="">— keine Weiterleitung —</option>
                      {landings
                        .filter((l) => l.flow_type === "fast" && l.id !== editingId)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.branding?.firmenname || l.slug} · {l.domain}
                          </option>
                        ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Bewerber wird beim CTA-Klick auf die gewählte Fasttrack-Page weitergeleitet (mit <code>?ref=&lt;diese-landing-id&gt;</code>). Die Bewerbung wird dort erzeugt; Tracking läuft über <code>source_landing_id</code> → <code>target_landing_id</code>.
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      🔗 Die <strong>Terminzeiten beider Seiten werden automatisch synchron gehalten</strong> — beim Speichern eines Kalenders unter „Verfügbarkeiten" wird der Plan auf die verknüpfte Seite gespiegelt.
                    </p>
                    {!branding.linked_fasttrack_landing_id && (
                      <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
                        ⚠️ <strong>Pflicht für Bewerber-Mails:</strong> Ohne verknüpfte Fast-Track-Seite kann kein Portal-Link
                        (<code>portal.…/bewerbung</code>, Terminbuchung, Registrierung) gebildet werden. Eingangsbestätigung,
                        Terminbestätigung und Interview-Erinnerung werden dann übersprungen statt einen 404-Link zu senden.
                      </div>
                    )}
                  </Field>
                </div>
              )}

              {/* Terminbuchung — jede Seite bucht mit ihrem eigenen Calendly-Link,
                  damit Bewerbung und Gespräch zur selben Marke gehören. */}
              {false ? (
                <div />
              ) : (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <Label className="text-xs font-semibold">📅 Terminbuchung</Label>
                <p className="text-[10px] text-muted-foreground">
                  Terminbuchung läuft <strong>immer über Calendly</strong> — kein internes Buchungssystem, keine Verfügbarkeiten, kein Fallback.
                </p>
                {true && (
                  <>
                    <Field label="Calendly-Buchungslink">
                      <Input
                        value={branding.calendly_url}
                        onChange={set("calendly_url")}
                        placeholder="https://calendly.com/sabine-schneider/bewerbung"
                      />
                    </Field>
                    <Field label="Firmenname auf Erfolgsblock">
                      <Input
                        value={branding.intermediate_company_name}
                        onChange={set("intermediate_company_name")}
                        placeholder={branding.firmenname || "z.B. Equal Experts Germany GmbH"}
                      />
                    </Field>
                  </>
                )}

                {false && (
                  <>
                    <Field label="Buchungsfenster (Tage im Voraus)">
                      <Input
                        type="number"
                        min={1}
                        max={180}
                        value={branding.booking_window_days}
                        onChange={(e) => setBranding((b) => ({ ...b, booking_window_days: Number(e.target.value) || 30 }))}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Default 30 Tage.</p>
                    </Field>
                    <Field label="Event-Beschreibung (im Slot-Picker angezeigt)">
                      <textarea
                        className="w-full min-h-[140px] px-3 py-2 rounded border border-input bg-background text-sm"
                        value={branding.event_description}
                        onChange={(e) => setBranding((b) => ({ ...b, event_description: e.target.value }))}
                        placeholder={"Für das Bewerbungsgespräch zu Ihrem neuen Minijob.\n\nDas Bewerbungsgespräch findet unter folgendem Link statt, bitte stellen Sie sicher, dass Sie 5 Minuten vorher anwesend sind.\n\nhttps://portal…/bewerbung"}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Wird nur im Slot-Picker angezeigt (nicht in der Bestätigungsmail). HR-Foto und Partner-Logo kommen automatisch aus dem Branding oben.
                      </p>
                    </Field>
                  </>
                )}
              </div>
              )}


            </CardContent>
          </Card>

          {/* Step 2c: SEO / Browser-Tab */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">2c. SEO & Browser-Tab</CardTitle>
              <CardDescription>
                Browser-Tab-Titel, Google-Beschreibung und Social-Sharing-Vorschau (WhatsApp, LinkedIn, Facebook). Leer lassen = Auto-Werte aus Firmenname.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Seitentitel (Browser-Tab, max. 60 Zeichen)">
                <Input
                  value={branding.seo_title}
                  onChange={set("seo_title")}
                  placeholder={branding.firmenname ? `${branding.firmenname} — Beratung & Karriere` : "z.B. Mustermann GmbH — Beratung"}
                  maxLength={160}
                />
                <p className="text-[10px] text-muted-foreground mt-1">{branding.seo_title.length}/60 empfohlen · erscheint im Browser-Tab und bei Google</p>
              </Field>
              <Field label="Meta-Beschreibung (Google-Suchergebnis, max. 160 Zeichen)">
                <Textarea
                  rows={2}
                  value={branding.seo_description}
                  onChange={set("seo_description")}
                  placeholder="1–2 Sätze, die Besucher zum Klicken bewegen. Wird in Google angezeigt."
                  maxLength={320}
                />
                <p className="text-[10px] text-muted-foreground mt-1">{branding.seo_description.length}/160 empfohlen</p>
              </Field>
              <Field label="OG-Bild URL (optional, Vorschaubild für WhatsApp/LinkedIn/Facebook)">
                <Input
                  value={branding.seo_image}
                  onChange={set("seo_image")}
                  placeholder="https://kunde-x.de/og-image.jpg (1200×630 px)"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Leer = kein Vorschaubild. Empfohlen 1200×630 px.</p>
              </Field>
            </CardContent>
          </Card>

          {/* Step 2b: Theme-spezifische Inhalte (Slots) */}
          {currentSlots.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">2b. Theme-Inhalte ({currentTheme?.name})</CardTitle>
                <CardDescription>Texte, Bilder und Farben dieses Themes individuell anpassen.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentSlots.map((slot) => (
                  <Field key={slot.key} label={slot.label}>
                    {slot.type === "longtext" || slot.type === "textarea" ? (
                      <Textarea rows={3} value={slotsForOutput[slot.key] ?? slot.default} onChange={setSlot(slot.key)} className="font-mono text-xs" />

                    ) : slot.type === "color" ? (
                      <div className="flex gap-2">
                        <Input type="color" value={slotsForOutput[slot.key] ?? slot.default} onChange={setSlot(slot.key)} className="w-16 p-1 h-10" />
                        <Input value={slotsForOutput[slot.key] ?? slot.default} onChange={setSlot(slot.key)} />
                      </div>
                    ) : slot.type === "image" ? (
                      <Input value={slotsForOutput[slot.key] ?? slot.default} onChange={setSlot(slot.key)} placeholder="https://… oder /assets/foo.jpg" />
                    ) : (
                      <Input value={slotsForOutput[slot.key] ?? slot.default} onChange={setSlot(slot.key)} />
                    )}
                  </Field>
                ))}
              </CardContent>
            </Card>
          )}


          {/* Step 3: Deploy */}
          <Card className="border-primary/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">3. Speichern & live schalten</CardTitle>
              <CardDescription>
                Landing wird zentral auf Server 1 gehostet. Caddy holt SSL automatisch, sobald die Domain auf den Server zeigt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {impressumMissing.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Impressum unvollständig — rechtlich erforderliche Angaben fehlen:
                  </p>
                  <p className="mt-1 text-muted-foreground">{impressumMissing.join(" · ")}</p>
                  <p className="mt-1 text-muted-foreground">
                    Bitte in Schritt „Firmendaten" ergänzen. Fehlende Felder werden im Impressum weggelassen.
                  </p>
                </div>
              )}

              <Field label="Interner Slug (a-z, 0-9, -) — leer = aus Domain generieren">
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder={branding.landing_domain ? branding.landing_domain.replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "z.B. digital-dgi"}
                  disabled={!!editingId}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSaveLive} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Speichere…" : editingId ? "Änderungen speichern" : "Speichern & live schalten"}
                </Button>
                <Button variant="outline" onClick={handleGenerate} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  ZIP-Export (Backup)
                </Button>
              </div>
              {editingId && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Bearbeitung läuft — Änderungen sind nach „Speichern" sofort live (Renderer-Cache 60s).
                </p>
              )}
              {lastFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Letzter ZIP-Export: <span className="font-mono">{lastFile}</span>
                </p>
              )}
              <div className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2 leading-relaxed">
                <strong>DNS-Anleitung für den Kunden:</strong> A-Record <code>{branding.landing_domain || "kunde.de"}</code> → IP von Server 1.
                Optional <code>www</code> als CNAME auf die Apex-Domain.
                <br/>Bei Cloudflare: Proxy <strong>an</strong> („orange Wolke"). Voraussetzung: Caddy nutzt Cloudflare-DNS-Challenge.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Sticky Live-Preview (desktop) / collapsible (mobile) */}
        <div className={cn("lg:block", showPreview ? "block" : "hidden")}>
          <div className="lg:sticky lg:top-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Eye className="h-3.5 w-3.5" /> Live-Vorschau
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  const blob = new Blob([selectedTemplate ? templatePreviewHtml : previewSrcDoc], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank", "noopener,noreferrer");
                  setTimeout(() => URL.revokeObjectURL(url), 60_000);
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" /> In neuem Tab öffnen
              </Button>
            </div>
            <div className="rounded-lg border-2 border-border overflow-hidden bg-background shadow-sm">
              <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-2 border-b">
                <div className="flex gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 text-center text-[10px] text-muted-foreground font-mono truncate">
                  {branding.landing_domain || "preview.localhost"}
                </div>
              </div>
              <iframe
                title="Landing Preview"
                srcDoc={selectedTemplate ? templatePreviewHtml : previewSrcDoc}
                sandbox="allow-same-origin allow-scripts"
                className="w-full h-[calc(100vh-180px)] min-h-[600px] border-0 bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Landing „{deleteTarget?.domain}" löschen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {deleteTarget && deleteTarget.appointments > 0 ? (
                  <p>
                    Diese Landing hat einen Buchungskalender mit <strong>{deleteTarget.appointments} gebuchten Terminen</strong>.
                    Die Termine <strong>bleiben erhalten</strong> und weiterhin unter „Mitarbeiter-Termine" sichtbar –
                    der Kalender wird nur von der Landing gelöst und deaktiviert.
                  </p>
                ) : (
                  <p>Es hängen keine gebuchten Termine an dieser Landing.</p>
                )}
                <p>
                  Nach dem Löschen ist die Domain nicht mehr erreichbar (404). Bewerbungen bleiben erhalten,
                  verlieren aber den Herkunfts-Verweis. Theme, Slots und Branding dieser Landing sind
                  <strong> nicht wiederherstellbar</strong>. Der DNS-Eintrag bleibt bestehen.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Abbrechen</AlertDialogCancel>
            <Button variant="outline" disabled={deleteBusy} onClick={deactivateFromDialog}>
              Nur deaktivieren
            </Button>
            <AlertDialogAction
              disabled={deleteBusy}
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBusy ? "Lösche…" : "Löschen (Termine behalten)"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
