import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listLandingPages,
  getLandingPage,
  saveLandingPage,
} from "@/lib/landing-pages.functions";
import { renderSectionsPreview, generateLandingDraft, generateLandingImage } from "@/lib/landing-builder.functions";
import { listLandingTemplates, saveLandingTemplate, deleteLandingTemplate } from "@/lib/landing-templates.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  SECTION_CATALOG,
  SECTION_TEMPLATES,
  sectionsFromTemplate,
  defaultSections,
  createSection,
  FONT_PAIRS,
  normalizeStyle,
  defaultStyle,
  type LandingSection,
  type SectionField,
  type LandingStyle,
} from "@/lib/landing-sections";
import { LANDING_BLUEPRINTS } from "@/lib/landing-blueprints";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Save, ArrowUp, ArrowDown, Trash2, Plus, Layers, ExternalLink,
  Monitor, Smartphone, Undo2, Settings2, GripVertical, X, Upload,
  Sparkles, Shuffle, Palette, BookmarkPlus, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/landing-baukasten")({
  validateSearch: (s: Record<string, unknown>): { vorlage?: string; kopie?: string } => ({
    ...(typeof s.vorlage === "string" && s.vorlage ? { vorlage: s.vorlage } : {}),
    ...(typeof s.kopie === "string" && s.kopie ? { kopie: s.kopie } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Landing-Baukasten — MB Portal" },
      { name: "description", content: "Landingpages aus Abschnitten erstellen und bearbeiten." },
      { property: "og:title", content: "Landing-Baukasten — MB Portal" },
      { property: "og:description", content: "Landingpages aus Abschnitten erstellen und bearbeiten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandingBaukastenPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center space-y-4">
      <h2 className="text-xl font-bold text-destructive">Baukasten konnte nicht geladen werden</h2>
      <p className="text-muted-foreground">{String((error as Error)?.message || error)}</p>
      <Button onClick={() => window.location.reload()}>Erneut versuchen</Button>
    </div>
  ),
});

type LandingRow = {
  id: string;
  slug: string;
  domain?: string | null;
  tenant_id?: string | null;
  theme_id: string;
  flow_type?: string;
  source_slug?: string;
  is_published?: boolean;
  booking_mode?: string;
  calendly_url?: string | null;
  branding?: Record<string, unknown> | null;
  slots?: Record<string, string> | null;
  sections?: LandingSection[] | null;
  logo_url?: string | null;
};

type LandingListItem = {
  id: string;
  slug: string;
  domain?: string | null;
  branding?: unknown;
  is_published?: boolean;
};

const EMPTY_BRANDING = {
  firmenname: "", primary_color: "#2563eb", secondary_color: "#1e40af",
  kontakt_email: "", telefon: "", seo_title: "", seo_description: "",
  style: defaultStyle(),
};

type TemplateRow = {
  id: string;
  name: string;
  description: string;
  sections: LandingSection[];
  style: Record<string, unknown>;
};

function LandingBaukastenPage() {
  const { toast } = useToast();
  const listFn = useServerFn(listLandingPages);
  const getFn = useServerFn(getLandingPage);
  const saveFn = useServerFn(saveLandingPage);
  const previewFn = useServerFn(renderSectionsPreview);
  const aiFn = useServerFn(generateLandingDraft);
  const tplListFn = useServerFn(listLandingTemplates);
  const tplSaveFn = useServerFn(saveLandingTemplate);
  const tplDelFn = useServerFn(deleteLandingTemplate);

  const [landings, setLandings] = useState<LandingListItem[]>([]);
  const [current, setCurrent] = useState<LandingRow | null>(null);
  const [sections, setSections] = useState<LandingSection[]>([]);
  const [branding, setBranding] = useState<Record<string, any>>({ ...EMPTY_BRANDING });
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [dirty, setDirty] = useState(false);
  const [addAt, setAddAt] = useState<number | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const savedSnapshot = useRef<string>("");

  const selected = useMemo(
    () => sections.find((s) => s.id === selectedId) || null,
    [sections, selectedId]
  );

  const snapshot = useCallback(
    () => JSON.stringify({ sections, branding, slug, calendlyUrl }),
    [sections, branding, slug, calendlyUrl]
  );

  // ── Liste laden ──────────────────────────────────────────────────────────
  const refreshList = useCallback(async () => {
    const res = (await listFn()) as unknown as { rows: LandingListItem[] };
    setLandings(res.rows || []);
  }, [listFn]);

  useEffect(() => {
    (async () => {
      // Vorlagen unabhängig von der Seitenliste laden, damit ein Fehler dort
      // die Vorlagen nicht verschwinden lässt.
      void refreshTemplates();
      try {
        await refreshList();
      } catch (e) {
        toast({ title: "Fehler", description: String((e as Error).message), variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Beim Öffnen von „Neue Seite“ die Vorlagen frisch laden.
  useEffect(() => {
    if (showNewDialog) void refreshTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNewDialog]);

  // ── Ungespeicherte Änderungen ────────────────────────────────────────────
  useEffect(() => {
    setDirty(savedSnapshot.current !== "" && savedSnapshot.current !== snapshot());
  }, [snapshot]);

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const confirmLeave = () =>
    !dirty || window.confirm("Es gibt ungespeicherte Änderungen. Trotzdem fortfahren?");

  // ── Laden / Neu ──────────────────────────────────────────────────────────
  const applyState = (lp: LandingRow | null, secs: LandingSection[]) => {
    setCurrent(lp);
    setSlug(lp?.slug || "");
    setDomain(lp?.domain && !lp.domain.endsWith(".entwurf.invalid") ? lp.domain : "");
    setCalendlyUrl(lp?.calendly_url || "");
    const b = lp ? { telefon: "", kontakt_email: "", ...(lp.branding || {}) } : { ...EMPTY_BRANDING };
    setBranding(b);
    setSections(secs);
    setSelectedId(secs[0]?.id || null);
    savedSnapshot.current = JSON.stringify({
      sections: secs, branding: b, slug: lp?.slug || "", calendlyUrl: lp?.calendly_url || "",
    });
    setDirty(false);
  };

  const loadLanding = useCallback(async (id: string) => {
    try {
      const lp = (await getFn({ data: { id } })) as unknown as LandingRow;
      applyState(
        lp,
        Array.isArray(lp.sections) && lp.sections.length ? (lp.sections as LandingSection[]) : defaultSections()
      );
    } catch (e) {
      toast({ title: "Laden fehlgeschlagen", description: String((e as Error).message), variant: "destructive" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFn, toast]);

  const startNewPage = (templateId: string) => {
    applyState(null, sectionsFromTemplate(templateId));
    setShowNewDialog(false);
    setShowSettings(true);
  };

  // ── Eigene Vorlagen ──────────────────────────────────────────────────────
  const refreshTemplates = useCallback(async () => {
    try {
      const res = (await tplListFn()) as unknown as { rows: TemplateRow[] };
      setTemplates(res.rows || []);
      setTemplatesError(null);
    } catch (e) {
      setTemplates([]); // Tabelle evtl. noch nicht eingespielt — Baukasten bleibt nutzbar
      setTemplatesError(String((e as Error)?.message || e));
    }
  }, [tplListFn]);

  const startFromTemplate = (t: TemplateRow) => {
    const secs = (Array.isArray(t.sections) ? t.sections : []).map((s) => ({
      ...s,
      id: `sec_${Math.random().toString(36).slice(2, 10)}`,
    }));
    applyState(null, secs.length ? secs : defaultSections());
    setBranding((b) => ({ ...b, style: normalizeStyle(t.style) }));
    setShowNewDialog(false);
    setShowSettings(true);
  };

  // Aus dem Landing Generator: ?vorlage=<id> öffnet direkt eine neue Seite mit dieser Vorlage.
  const { vorlage, kopie } = Route.useSearch();
  const vorlageApplied = useRef(false);
  useEffect(() => {
    if (!vorlage || vorlageApplied.current || loading) return;
    const t = templates.find((x) => x.id === vorlage);
    if (!t) return;
    vorlageApplied.current = true;
    startFromTemplate(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vorlage, templates, loading]);

  // Aus dem Landing Generator: Eine komplette Baukasten-Seite als neue,
  // unveröffentlichte Seite übernehmen. Original und Domain bleiben unberührt.
  const copyApplied = useRef(false);
  useEffect(() => {
    if (!kopie || copyApplied.current || loading) return;
    copyApplied.current = true;
    void (async () => {
      try {
        const source = (await getFn({ data: { id: kopie } })) as unknown as LandingRow;
        const copiedSections = (
          Array.isArray(source.sections) && source.sections.length ? source.sections : defaultSections()
        ).map((section) => ({
          ...section,
          data: { ...section.data },
          id: `sec_${Math.random().toString(36).slice(2, 10)}`,
        }));
        const base = (source.slug || "seite").replace(/-kopie(-\d+)?$/, "");
        let nextSlug = `${base}-kopie`;
        let number = 2;
        while (landings.some((landing) => landing.slug === nextSlug)) {
          nextSlug = `${base}-kopie-${number++}`;
        }
        applyState(
          { ...source, id: "", slug: nextSlug, domain: null, is_published: false },
          copiedSections,
        );
        savedSnapshot.current = "__unsaved_copy__";
        setDirty(true);
        setShowSettings(true);
        toast({
          title: "Seite kopiert",
          description: "Vergib einen neuen Firmennamen und eine neue Domain, bevor du die Kopie speicherst.",
        });
      } catch (error) {
        toast({
          title: "Seite konnte nicht kopiert werden",
          description: String((error as Error).message),
          variant: "destructive",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kopie, loading, landings]);

  const saveAsTemplate = async () => {
    const name = window.prompt("Name der Vorlage:", branding.firmenname ? `Vorlage ${branding.firmenname}` : "Meine Vorlage");
    if (!name?.trim()) return;
    try {
      await tplSaveFn({ data: { name: name.trim(), description: "", sections, style: normalizeStyle(branding.style) } as any });
      toast({ title: "Vorlage gespeichert", description: "Du findest sie unter „Neue Seite“." });
      await refreshTemplates();
    } catch (e) {
      toast({ title: "Vorlage nicht gespeichert", description: String((e as Error).message), variant: "destructive" });
    }
  };

  const removeTemplate = async (t: TemplateRow) => {
    if (!window.confirm(`Vorlage „${t.name}“ löschen?`)) return;
    try {
      await tplDelFn({ data: { id: t.id } });
      await refreshTemplates();
    } catch (e) {
      toast({ title: "Löschen fehlgeschlagen", description: String((e as Error).message), variant: "destructive" });
    }
  };

  // ── KI-Entwurf ───────────────────────────────────────────────────────────
  const runAi = async (params: Record<string, string>) => {
    setAiBusy(true);
    try {
      const res = (await aiFn({ data: { ...params, onlyStyle: false } as any })) as any;
      const secs: LandingSection[] = (res.sections || []).map((s: LandingSection) => ({
        ...s,
        id: `sec_${Math.random().toString(36).slice(2, 10)}`,
      }));
      setSections(secs);
      setSelectedId(secs[0]?.id || null);
      setBranding((b) => ({
        ...b,
        firmenname: b.firmenname || params.firmenname || "",
        style: normalizeStyle(res.style),
        primary_color: normalizeStyle(res.style).primary,
        secondary_color: normalizeStyle(res.style).accent,
        seo_title: res.seo?.title || b.seo_title,
        seo_description: res.seo?.description || b.seo_description,
      }));
      setShowAiDialog(false);
      setShowNewDialog(false);
      setShowSettings(true);
      toast({ title: "Entwurf erstellt", description: "Prüfe die Texte und passe sie an, bevor du speicherst." });
    } catch (e) {
      toast({ title: "KI-Entwurf fehlgeschlagen", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setAiBusy(false);
    }
  };

  const shuffleStyle = async () => {
    setAiBusy(true);
    try {
      const res = (await aiFn({ data: { onlyStyle: true } as any })) as any;
      const st = normalizeStyle(res.style);
      setBranding((b) => ({ ...b, style: st, primary_color: st.primary, secondary_color: st.accent }));
    } catch (e) {
      toast({ title: "Design nicht geändert", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setAiBusy(false);
    }
  };

  /** Aktuelle Seite als neue Seite weiterverwenden (1-Klick-Duplizieren). */
  const duplicateCurrent = () => {
    if (!sections.length) return;
    const copy = sections.map((s) => ({ ...s, data: { ...s.data }, id: `sec_${Math.random().toString(36).slice(2, 10)}` }));
    const base = (slug || "seite").replace(/-kopie(-\d+)?$/, "");
    let next = `${base}-kopie`;
    let n = 2;
    while (landings.some((l) => l.slug === next)) next = `${base}-kopie-${n++}`;
    setCurrent(null);
    setSections(copy);
    setSelectedId(copy[0]?.id || null);
    setSlug(next);
    setDomain("");
    savedSnapshot.current = "";
    setDirty(true);
    setShowSettings(true);
    toast({
      title: "Kopie angelegt",
      description: "Passe Firmenname, Farben und Kurznamen an und speichere sie als neue Seite.",
    });
  };

  const discard = async () => {
    if (!window.confirm("Alle Änderungen seit dem letzten Speichern verwerfen?")) return;
    if (current?.id) await loadLanding(current.id);
    else applyState(null, defaultSections());
  };

  // ── Abschnitte bearbeiten ────────────────────────────────────────────────
  const updateSection = (id: string, patch: Record<string, unknown>) =>
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, data: { ...s.data, ...patch } } : s)));

  const moveSection = (id: string, dir: -1 | 1) =>
    setSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const reorder = (from: number, to: number) =>
    setSections((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  const removeSection = (id: string) => {
    const def = SECTION_CATALOG.find((d) => d.type === sections.find((s) => s.id === id)?.type);
    if (!window.confirm(`Abschnitt „${def?.label || "Abschnitt"}" wirklich löschen?`)) return;
    setSections((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const insertSection = (type: string, at: number) => {
    const def = SECTION_CATALOG.find((d) => d.type === type);
    if (!def) return;
    if (def.unique && sections.some((s) => s.type === def.type)) {
      toast({ title: "Nur einmal möglich", description: `„${def.label}" kann nur einmal vorkommen.`, variant: "destructive" });
      return;
    }
    const sec = createSection(type);
    setSections((prev) => {
      const next = [...prev];
      next.splice(Math.max(0, Math.min(at, prev.length)), 0, sec);
      return next;
    });
    setSelectedId(sec.id);
    setAddAt(null);
  };

  // ── Vorschau (automatisch, entprellt) ────────────────────────────────────
  const brandingForPreview = useMemo(
    () => ({
      firmenname: branding.firmenname, primary_color: branding.primary_color,
      secondary_color: branding.secondary_color, kontakt_email: branding.kontakt_email,
      email: branding.kontakt_email || branding.email,
      telefon: branding.telefon, whatsapp_number: branding.whatsapp_number,
      whatsapp_enabled: branding.whatsapp_enabled,
      impressum: branding.impressum, datenschutz: branding.datenschutz,
      seo_title: branding.seo_title, seo_description: branding.seo_description,
      style: branding.style,
    }),
    [branding]
  );

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await previewFn({
          data: {
            sections,
            branding: brandingForPreview,
            logo_url: current?.logo_url || null,
            editor: true,
          },
        });
        if (!cancelled) setPreviewHtml(res.html);
      } catch (e) {
        if (!cancelled) {
          toast({ title: "Vorschau fehlgeschlagen", description: String((e as Error).message), variant: "destructive" });
        }
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, brandingForPreview, current?.logo_url, loading]);

  // ── Klicks aus der Vorschau entgegennehmen ───────────────────────────────
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const d = ev.data as { source?: string; action?: string; id?: string; index?: number };
      if (!d || d.source !== "lb-editor") return;
      switch (d.action) {
        case "select":
        case "edit":
          if (d.id) setSelectedId(d.id);
          break;
        case "up": if (d.id) moveSection(d.id, -1); break;
        case "down": if (d.id) moveSection(d.id, 1); break;
        case "delete": if (d.id) removeSection(d.id); break;
        case "add": setAddAt(typeof d.index === "number" ? d.index : sections.length); break;
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  // Auswahl in der Vorschau hervorheben
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const t = setTimeout(() => {
      win.postMessage({ source: "lb-parent", action: "highlight", id: selectedId }, "*");
    }, 120);
    return () => clearTimeout(t);
  }, [selectedId, previewHtml]);

  // ── Speichern ────────────────────────────────────────────────────────────
  const save = async () => {
    if (!slug.trim()) {
      toast({ title: "Kurzname fehlt", description: "Bitte unter Grundeinstellungen einen Kurznamen (Slug) vergeben.", variant: "destructive" });
      setShowSettings(true);
      return;
    }
    if (!String(branding.firmenname || "").trim()) {
      toast({ title: "Firmenname fehlt", description: "Bitte unter Grundeinstellungen einen Firmennamen eintragen.", variant: "destructive" });
      setShowSettings(true);
      return;
    }
    if (!current?.id && landings.some((l) => l.slug === slug.trim())) {
      toast({ title: "Kurzname schon vergeben", description: "Es gibt bereits eine Seite mit diesem Kurznamen.", variant: "destructive" });
      setShowSettings(true);
      return;
    }
    const cleanDom = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const finalDomain = cleanDom || `${slug.trim()}.entwurf.invalid`;
    if (landings.some((l) => l.id !== current?.id && (l.domain || "").toLowerCase() === finalDomain)) {
      toast({ title: "Domain schon vergeben", description: "Diese Domain gehört bereits zu einer anderen Seite.", variant: "destructive" });
      setShowSettings(true);
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        slug: slug.trim(),
        domain: finalDomain,
        tenant_id: current?.tenant_id || null,
        theme_id: current?.theme_id || "theme-10",
        flow_type: current?.flow_type || "classic",
        source_slug: current?.source_slug || "",
        is_published: current?.is_published ?? false,
        booking_mode: current?.booking_mode || "calendly",
        calendly_url: calendlyUrl,
        branding,
        slots: current?.slots || {},
        sections,
      };
      if (current?.id) payload.id = current.id;
      const res = (await saveFn({ data: payload as any })) as any;
      const newId = res?.id || current?.id;
      toast({ title: "Gespeichert", description: "Landing-Seite wurde gespeichert." });
      await refreshList();
      if (newId) await loadLanding(newId);
      else savedSnapshot.current = snapshot();
    } catch (e) {
      const msg = String((e as Error).message);
      toast({
        title: "Speichern fehlgeschlagen",
        description: msg.includes("sections")
          ? "Die Datenbank kennt das Feld „sections“ noch nicht — bitte zuerst die Migration supabase/manual-migrations/20260922000000_landing_sections.sql einspielen."
          : /duplicate key.*domain/i.test(msg)
          ? "Diese Domain gehört bereits zu einer anderen Seite."
          : /duplicate key.*slug/i.test(msg)
          ? "Dieser Kurzname ist bereits vergeben."
          : msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const selectedDef = selected ? SECTION_CATALOG.find((d) => d.type === selected.type) : null;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Kopfzeile */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Layers className="h-6 w-6" /> Landing-Baukasten</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Klick in der Vorschau auf einen Abschnitt, um ihn zu bearbeiten. Bestehende Seiten bleiben unverändert, bis du sie hier speicherst.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border rounded-md px-3 py-2 bg-background text-sm max-w-[280px]"
            value={current?.id || ""}
            onChange={(e) => {
              if (!confirmLeave()) return;
              if (e.target.value) loadLanding(e.target.value);
              else setShowNewDialog(true);
            }}
          >
            <option value="">— Seite wählen —</option>
            {landings.map((l) => (
              <option key={l.id} value={l.id}>
                {((l.branding as any)?.firmenname as string) || l.slug} ({l.slug}){l.is_published ? " · online" : ""}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => { if (confirmLeave()) setShowNewDialog(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Neue Seite
          </Button>
          {templates.length > 0 && (
            <select
              className="border rounded-md px-3 py-2 bg-background text-sm max-w-[240px]"
              value=""
              onChange={(e) => {
                const t = templates.find((x) => x.id === e.target.value);
                if (t && confirmLeave()) startFromTemplate(t);
              }}
            >
              <option value="">Vorlage verwenden …</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <Link to="/admin/landing-generator">
            <Button variant="ghost" size="sm">Klassischer Generator</Button>
          </Link>
        </div>
      </div>

      {/* Werkzeugleiste */}
      <div className="flex flex-wrap items-center gap-2 border rounded-lg p-2 bg-muted/30">
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Speichern
        </Button>
        <Button variant="outline" size="sm" onClick={discard} disabled={!dirty}>
          <Undo2 className="h-4 w-4 mr-1" /> Verwerfen
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowSettings((v) => !v)}>
          <Settings2 className="h-4 w-4 mr-1" /> Grundeinstellungen
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowAiDialog(true)} disabled={aiBusy}>
          <Sparkles className="h-4 w-4 mr-1" /> Mit KI erstellen
        </Button>
        <Button variant="outline" size="sm" onClick={shuffleStyle} disabled={aiBusy}>
          {aiBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Shuffle className="h-4 w-4 mr-1" />} Design neu würfeln
        </Button>
        <Button variant="outline" size="sm" onClick={saveAsTemplate} disabled={!sections.length}>
          <BookmarkPlus className="h-4 w-4 mr-1" /> Als Vorlage speichern
        </Button>
        <Button variant="outline" size="sm" onClick={duplicateCurrent} disabled={!sections.length}>
          <Copy className="h-4 w-4 mr-1" /> Seite duplizieren
        </Button>
        <span className="text-xs text-muted-foreground ml-1">
          {dirty ? "Ungespeicherte Änderungen" : "Alles gespeichert"}
          {previewing && " · Vorschau wird aktualisiert…"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant={device === "desktop" ? "secondary" : "ghost"} size="sm" onClick={() => setDevice("desktop")}>
            <Monitor className="h-4 w-4 mr-1" /> Desktop
          </Button>
          <Button variant={device === "mobile" ? "secondary" : "ghost"} size="sm" onClick={() => setDevice("mobile")}>
            <Smartphone className="h-4 w-4 mr-1" /> Handy
          </Button>
          {current?.is_published && (branding.landing_domain as string) && (
            <a href={`https://${branding.landing_domain as string}`} target="_blank" rel="noreferrer" className="inline-flex">
              <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4 mr-1" /> Live</Button>
            </a>
          )}
        </div>
      </div>

      {showSettings && (
        <>
          <BasicSettings
            branding={branding}
            setBranding={setBranding}
            slug={slug}
            setSlug={setSlug}
            domain={domain}
            setDomain={setDomain}
            calendlyUrl={calendlyUrl}
            setCalendlyUrl={setCalendlyUrl}
            onClose={() => setShowSettings(false)}
          />
          <StyleSettings
            style={normalizeStyle(branding.style)}
            onChange={(st) => setBranding({ ...branding, style: st, primary_color: st.primary, secondary_color: st.accent })}
          />
        </>
      )}

      {/* Arbeitsfläche */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
        {/* Vorschau */}
        <Card className="overflow-hidden">
          <CardContent className="p-3 bg-muted/40">
            <div className={cn("mx-auto transition-all", device === "mobile" ? "max-w-[400px]" : "w-full")}>
              <iframe
                ref={iframeRef}
                title="Vorschau"
                srcDoc={previewHtml}
                className="w-full h-[78vh] rounded-md border bg-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* Rechte Spalte */}
        <div className="space-y-4">
          {/* Abschnittsliste */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Abschnitte ({sections.length})</CardTitle>
              <CardDescription>Zum Verschieben am Griff ziehen. Zum Bearbeiten anklicken.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {sections.map((s, idx) => {
                const def = SECTION_CATALOG.find((d) => d.type === s.type);
                return (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => setDragIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragIndex !== null) reorder(dragIndex, idx); setDragIndex(null); }}
                    onDragEnd={() => setDragIndex(null)}
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2 py-2 text-sm cursor-pointer bg-background",
                      selectedId === s.id && "border-primary ring-1 ring-primary",
                      dragIndex === idx && "opacity-50"
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
                    <span className="flex-1 truncate">{idx + 1}. {def?.label || s.type}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0}
                      onClick={(e) => { e.stopPropagation(); moveSection(s.id, -1); }}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === sections.length - 1}
                      onClick={(e) => { e.stopPropagation(); moveSection(s.id, 1); }}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); removeSection(s.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setAddAt(sections.length)}>
                <Plus className="h-4 w-4 mr-1" /> Abschnitt hinzufügen
              </Button>
            </CardContent>
          </Card>

          {/* Felder des ausgewählten Abschnitts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selectedDef ? selectedDef.label : "Kein Abschnitt ausgewählt"}
              </CardTitle>
              <CardDescription>
                {selectedDef ? selectedDef.description : "Klick in der Vorschau oder in der Liste auf einen Abschnitt."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selected && selectedDef ? (
                selectedDef.fields.length ? (
                  <div className="space-y-3">
                    {selectedDef.fields.map((f) => (
                      <FieldEditor
                        key={f.key}
                        field={f}
                        value={selected.data[f.key]}
                        onChange={(v) => updateSection(selected.id, { [f.key]: v })}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Dieser Abschnitt hat keine Einstellungen — Formular und Terminwahl sind fest eingebaut.
                  </p>
                )
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Abschnitt auswählen */}
      {addAt !== null && (
        <Overlay onClose={() => setAddAt(null)} title="Abschnitt hinzufügen">
          <div className="grid gap-2 sm:grid-cols-2">
            {SECTION_CATALOG.map((d) => {
              const blocked = Boolean(d.unique && sections.some((s) => s.type === d.type));
              return (
                <button
                  key={d.type}
                  disabled={blocked}
                  onClick={() => insertSection(d.type, addAt)}
                  className={cn(
                    "text-left border rounded-lg p-3 hover:border-primary hover:bg-accent transition",
                    blocked && "opacity-40 cursor-not-allowed hover:border-border hover:bg-transparent"
                  )}
                >
                  <div className="font-medium text-sm">{d.label}{blocked ? " · schon vorhanden" : ""}</div>
                  <div className="text-xs text-muted-foreground mt-1">{d.description}</div>
                </button>
              );
            })}
          </div>
        </Overlay>
      )}

      {/* Neue Seite */}
      {showNewDialog && (
        <Overlay onClose={() => setShowNewDialog(false)} title="Neue Seite starten">
          <div className="space-y-5">
            <div>
              <button
                onClick={() => { setShowNewDialog(false); setShowAiDialog(true); }}
                className="w-full text-left border rounded-lg p-4 hover:border-primary hover:bg-accent transition"
              >
                <div className="font-medium text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" /> Komplette Seite in einem Schritt erstellen</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Vorlage wählen, Firmenname, Stelle und ein paar Stichworte eingeben — die fertige Seite steht in rund 20 Sekunden.
                </div>
              </button>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Leer starten</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SECTION_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => startNewPage(t.id)}
                    className="text-left border rounded-lg p-3 hover:border-primary hover:bg-accent transition"
                  >
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {templatesError && (
              <p className="text-xs text-destructive">
                Eigene Vorlagen konnten nicht geladen werden ({templatesError}). Evtl. fehlt die Migration 20260923000000_landing_templates.sql.
              </p>
            )}
            {templates.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Aus eigener Vorlage</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {templates.map((t) => (
                    <div key={t.id} className="border rounded-lg p-3 flex items-start gap-2 hover:border-primary transition">
                      <button className="text-left flex-1" onClick={() => startFromTemplate(t)}>
                        <div className="font-medium text-sm">{t.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(Array.isArray(t.sections) ? t.sections.length : 0)} Abschnitte
                        </div>
                      </button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeTemplate(t)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Nach der Auswahl kannst du jeden Abschnitt frei ändern, verschieben oder löschen.
          </p>
        </Overlay>
      )}

      {/* KI-Entwurf */}
      {showAiDialog && (
        <Overlay onClose={() => (aiBusy ? null : setShowAiDialog(false))} title="Neue Seite in einem Schritt erstellen">
          <AiDialog busy={aiBusy} defaultCompany={branding.firmenname || ""} onSubmit={runAi} />
        </Overlay>
      )}
    </div>
  );
}

// ── Hilfs-Komponenten ────────────────────────────────────────────────────────

function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-background rounded-xl border shadow-xl w-full max-w-2xl mt-16 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BasicSettings({
  branding, setBranding, slug, setSlug, domain, setDomain, calendlyUrl, setCalendlyUrl, onClose,
}: {
  branding: Record<string, any>;
  setBranding: (b: Record<string, any>) => void;
  slug: string;
  setSlug: (s: string) => void;
  domain: string;
  setDomain: (s: string) => void;
  calendlyUrl: string;
  setCalendlyUrl: (s: string) => void;
  onClose: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Grundeinstellungen</CardTitle>
          <CardDescription>Gelten für die ganze Seite: Name, Farben, Kontakt, Terminlink.</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Firmenname</Label>
          <Input value={branding.firmenname || ""} onChange={(e) => setBranding({ ...branding, firmenname: e.target.value })} />
        </div>
        <div>
          <Label>Kurzname (Slug, z. B. firma-stadt)</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
        </div>
        <div className="md:col-span-2">
          <Label>Domain (optional, z. B. firma-xyz.de)</Label>
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Leer lassen = Entwurf ohne Domain" />
        </div>
        <div>
          <Label>Hauptfarbe</Label>
          <div className="flex gap-2">
            <input type="color" className="h-9 w-12 rounded border" value={branding.primary_color || "#2563eb"} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} />
            <Input value={branding.primary_color || ""} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Akzentfarbe</Label>
          <div className="flex gap-2">
            <input type="color" className="h-9 w-12 rounded border" value={branding.secondary_color || "#1e40af"} onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })} />
            <Input value={branding.secondary_color || ""} onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Kontakt-E-Mail (im Bewerbungsformular)</Label>
          <Input value={branding.kontakt_email || (branding.email as string) || ""} onChange={(e) => setBranding({ ...branding, kontakt_email: e.target.value })} />
        </div>
        <div>
          <Label>Telefon (im Bewerbungsformular)</Label>
          <Input value={branding.telefon || ""} onChange={(e) => setBranding({ ...branding, telefon: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Label>Calendly-Link (Terminbuchung nach der Bewerbung)</Label>
          <Input value={calendlyUrl} onChange={(e) => setCalendlyUrl(e.target.value)} placeholder="https://calendly.com/…" />
        </div>
        <div>
          <Label>Browser-Titel (SEO)</Label>
          <Input value={branding.seo_title || ""} onChange={(e) => setBranding({ ...branding, seo_title: e.target.value })} />
        </div>
        <div>
          <Label>Beschreibung (SEO)</Label>
          <Input value={branding.seo_description || ""} onChange={(e) => setBranding({ ...branding, seo_description: e.target.value })} />
        </div>
      </CardContent>
    </Card>
  );
}

function FieldHint({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-xs text-muted-foreground mt-1">{text}</p>;
}

const MEDIA_BUCKET = "landing-media";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-60) || "bild.png"
  );
}

/** Bild-Feld mit direktem Upload in den Storage-Bucket „landing-media". */
function ImageField({ value, onChange }: { value: unknown; onChange: (v: string) => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const url = String(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const imageFn = useServerFn(generateLandingImage);

  const generate = async () => {
    const prompt = window.prompt(
      "Was soll auf dem Bild zu sehen sein?\n(Für echte Team- oder Arbeitsplatzfotos bitte eigene Bilder hochladen.)",
      ""
    );
    if (!prompt?.trim()) return;
    setAiBusy(true);
    try {
      const res = (await imageFn({ data: { prompt: prompt.trim() } })) as unknown as { url: string };
      onChange(res.url);
    } catch (e) {
      toast({ title: "Bild nicht erzeugt", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setAiBusy(false);
    }
  };

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Kein Bild erkannt", description: "Bitte eine Bilddatei auswählen (PNG, JPG, WebP, GIF oder SVG).", variant: "destructive" });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({ title: "Bild zu groß", description: "Bitte ein Bild mit maximal 5 MB auswählen.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const path = `landing/${Date.now()}-${sanitizeFileName(file.name)}`;
      const { error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      toast({
        title: "Upload fehlgeschlagen",
        description: /security|permission|policy|row-level/i.test(msg)
          ? "Keine Berechtigung. Wurde die Migration für den Bild-Speicher (landing-media) schon eingespielt?"
          : msg,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
          {busy ? "Lädt hoch…" : "Bild hochladen"}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={aiBusy} onClick={generate}>
          {aiBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
          {aiBusy ? "Wird erzeugt…" : "Mit KI erzeugen"}
        </Button>
        {url && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            <X className="h-3.5 w-3.5 mr-1" /> Entfernen
          </Button>
        )}
      </div>
      {url && (
        <img
          src={url}
          alt=""
          className="h-20 rounded-md border bg-muted object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <Input value={url} onChange={(e) => onChange(e.target.value)} placeholder="oder Bild-URL einfügen (https://…)" />
      <p className="text-xs text-muted-foreground">PNG, JPG, WebP, GIF oder SVG · max. 5 MB</p>
    </div>
  );
}

function FieldEditor({ field, value, onChange }: { field: SectionField; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <div>
      {field.kind !== "boolean" && <Label className="text-xs">{field.label}</Label>}
      {field.kind === "text" && (
        <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
      )}
      {field.kind === "textarea" && (
        <Textarea rows={3} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
      )}
      {field.kind === "color" && (
        <div className="flex gap-2">
          <input type="color" className="h-9 w-12 rounded border" value={String(value || "#f1f5f9")} onChange={(e) => onChange(e.target.value)} />
          <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        </div>
      )}
      {field.kind === "boolean" && (
        <label className="flex items-center gap-2 text-sm mt-1">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      )}
      {field.kind === "strings" && (
        <Textarea
          rows={4}
          value={(Array.isArray(value) ? (value as string[]) : []).join("\n")}
          onChange={(e) => onChange(e.target.value.split("\n").map((l) => l.trim()).filter(Boolean))}
          placeholder="Eine Zeile = ein Punkt"
        />
      )}
      {field.kind === "image" && (
        <ImageField value={value} onChange={(v) => onChange(v)} />
      )}
      {field.kind === "select" && (
        <select
          className="w-full border rounded-md px-3 py-2 bg-background text-sm"
          value={String(value ?? field.options?.[0]?.value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {(field.options || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {field.kind === "objects" && (
        <ObjectsField field={field} value={Array.isArray(value) ? (value as Record<string, string>[]) : []} onChange={onChange} />
      )}
      <FieldHint text={field.help} />
    </div>
  );
}

function ObjectsField({
  field, value, onChange,
}: {
  field: SectionField;
  value: Record<string, string>[];
  onChange: (v: unknown) => void;
}) {
  const itemFields = field.itemFields || [];
  const setItem = (i: number, key: string, v: string) => {
    onChange(value.map((it, idx) => (idx === i ? { ...it, [key]: v } : it)));
  };
  return (
    <div className="space-y-2 mt-1">
      {value.map((item, i) => (
        <div key={i} className="border rounded-md p-3 bg-muted/30 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{field.itemLabel || "Eintrag"} {i + 1}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
          {itemFields.map((inf) => (
            <div key={inf.key}>
              <Label className="text-xs">{inf.label}</Label>
              {inf.kind === "textarea" ? (
                <Textarea rows={2} value={String(item[inf.key] ?? "")} onChange={(e) => setItem(i, inf.key, e.target.value)} />
              ) : inf.kind === "image" ? (
                <ImageField value={item[inf.key]} onChange={(v) => setItem(i, inf.key, v)} />
              ) : (
                <Input value={String(item[inf.key] ?? "")} onChange={(e) => setItem(i, inf.key, e.target.value)} />
              )}
            </div>
          ))}
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, Object.fromEntries(itemFields.map((f) => [f.key, ""]))])}
      >
        <Plus className="h-3.5 w-3.5 mr-1" /> {field.itemLabel || "Eintrag"} hinzufügen
      </Button>
    </div>
  );
}

/** Eingaben für den KI-Entwurf. */
function AiDialog({
  busy, defaultCompany, onSubmit,
}: {
  busy: boolean;
  defaultCompany: string;
  onSubmit: (v: Record<string, string>) => void;
}) {
  const [v, setV] = useState({
    firmenname: defaultCompany,
    branche: "",
    stelle: "",
    ort: "",
    tonalitaet: "locker und persönlich",
    designrichtung: "",
    besonderheiten: "",
    blueprint: LANDING_BLUEPRINTS[0]!.id,
  });
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Vorlage & Farbwelt</Label>
        <div className="grid gap-2 sm:grid-cols-2 mt-1">
          {LANDING_BLUEPRINTS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => set("blueprint", b.id)}
              className={cn(
                "text-left border rounded-lg p-3 transition",
                v.blueprint === b.id ? "border-primary ring-1 ring-primary bg-accent" : "hover:border-primary"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border" style={{ background: b.style.primary }} />
                <span className="font-medium text-sm">{b.label}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{b.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Firmenname</Label>
          <Input value={v.firmenname} onChange={(e) => set("firmenname", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Branche</Label>
          <Input value={v.branche} onChange={(e) => set("branche", e.target.value)} placeholder="z.B. Logistik, Pflege, Gastronomie" />
        </div>
        <div>
          <Label className="text-xs">Gesuchte Stelle</Label>
          <Input value={v.stelle} onChange={(e) => set("stelle", e.target.value)} placeholder="z.B. Lagerhelfer (m/w/d)" />
        </div>
        <div>
          <Label className="text-xs">Ort / Region</Label>
          <Input value={v.ort} onChange={(e) => set("ort", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Tonalität</Label>
          <select
            className="w-full border rounded-md px-3 py-2 bg-background text-sm"
            value={v.tonalitaet}
            onChange={(e) => set("tonalitaet", e.target.value)}
          >
            <option value="locker und persönlich">locker und persönlich</option>
            <option value="sachlich und seriös">sachlich und seriös</option>
            <option value="motivierend und direkt">motivierend und direkt</option>
            <option value="ruhig und vertrauensvoll">ruhig und vertrauensvoll</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Design-Richtung (optional)</Label>
          <Input value={v.designrichtung} onChange={(e) => set("designrichtung", e.target.value)} placeholder="z.B. dunkel und modern, warm, technisch" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Stichworte — nur echte Angaben</Label>
        <Textarea
          rows={4}
          value={v.besonderheiten}
          onChange={(e) => set("besonderheiten", e.target.value)}
          placeholder="z.B. 16,50 €/Std., kein Lebenslauf nötig, sofortiger Start, freie Zeiteinteilung"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Die KI erfindet keine Zahlen, Auszeichnungen oder Kundenstimmen — alles, was drinstehen soll, gehört hierher.
        </p>
      </div>
      <Button onClick={() => onSubmit(v)} disabled={busy} className="w-full">
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
        {busy ? "Seite wird erstellt…" : "Seite generieren"}
      </Button>
    </div>
  );
}

/** Gestaltung der Seite: Farben, Schrift, Rundungen, Abstände. */
function StyleSettings({ style, onChange }: { style: LandingStyle; onChange: (s: LandingStyle) => void }) {
  const set = (patch: Partial<LandingStyle>) => onChange(normalizeStyle({ ...style, ...patch }));
  const colorField = (key: keyof LandingStyle, label: string) => (
    <div key={String(key)}>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          className="h-9 w-12 rounded border"
          value={String(style[key])}
          onChange={(e) => set({ [key]: e.target.value } as Partial<LandingStyle>)}
        />
        <Input value={String(style[key])} onChange={(e) => set({ [key]: e.target.value } as Partial<LandingStyle>)} />
      </div>
    </div>
  );
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Gestaltung</CardTitle>
        <CardDescription>Farben, Schrift und Formen der ganzen Seite.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div>
          <Label className="text-xs">Hell oder dunkel</Label>
          <select className="w-full border rounded-md px-3 py-2 bg-background text-sm"
            value={style.mode} onChange={(e) => set({ mode: e.target.value as LandingStyle["mode"] })}>
            <option value="light">Hell</option>
            <option value="dark">Dunkel</option>
          </select>
        </div>
        {colorField("primary", "Hauptfarbe")}
        {colorField("accent", "Akzentfarbe")}
        {colorField("bg", "Hintergrund")}
        {colorField("surface", "Flächen / Karten")}
        {colorField("ink", "Schriftfarbe")}
        <div>
          <Label className="text-xs">Schriftart</Label>
          <select className="w-full border rounded-md px-3 py-2 bg-background text-sm"
            value={style.fontPair} onChange={(e) => set({ fontPair: e.target.value })}>
            {FONT_PAIRS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Ecken abrunden ({style.radius} px)</Label>
          <input type="range" min={0} max={28} step={2} className="w-full"
            value={style.radius} onChange={(e) => set({ radius: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Abstände</Label>
          <select className="w-full border rounded-md px-3 py-2 bg-background text-sm"
            value={style.density} onChange={(e) => set({ density: e.target.value as LandingStyle["density"] })}>
            <option value="kompakt">kompakt</option>
            <option value="normal">normal</option>
            <option value="luftig">luftig</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Knopf-Form</Label>
          <select className="w-full border rounded-md px-3 py-2 bg-background text-sm"
            value={style.buttonShape} onChange={(e) => set({ buttonShape: e.target.value as LandingStyle["buttonShape"] })}>
            <option value="pill">rund (Pille)</option>
            <option value="rund">leicht gerundet</option>
            <option value="eckig">eckig</option>
          </select>
        </div>
      </CardContent>
    </Card>
  );
}
