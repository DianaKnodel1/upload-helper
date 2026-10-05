import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, ShieldAlert, ExternalLink, Save, Megaphone } from "lucide-react";

export const Route = createFileRoute("/admin/webid-sim")({
  component: WebIdSimPage,
  head: () => ({
    meta: [
      { title: "WebID-Simulation – Admin" },
      { name: "description", content: "Simulationsdomains und die Hinweis-Meldung für die WebID-Umgebung verwalten." },
      { property: "og:title", content: "WebID-Simulation – Admin" },
      { property: "og:description", content: "Simulationsdomains und die Hinweis-Meldung für die WebID-Umgebung verwalten." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type SimMode = "simulation" | "tunnel";
interface SimDomain {
  id: string;
  domain: string;
  display_name: string;
  target_origin: string;
  logo_url: string | null;
  topbar_text: string;
  is_active: boolean;
  allow_submit: boolean;
  mode: SimMode;
  notes: string | null;
}

function WebIdSimPage() {
  return (
    <div className="space-y-6 p-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" /> WebID-Simulation
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Domains verwalten und die Hinweis-Meldung pflegen. Pro Domain wählbar:{" "}
          <strong>Simulation</strong> (Overlay, Submits blockiert) oder <strong>Tunnel</strong>{" "}
          (echter Durchgang, Overlay bleibt oben). Die Meldung erscheint automatisch auf allen
          Seiten — sobald hier geändert, wenige Sekunden später live.
        </p>
      </div>

      <Tabs defaultValue="domains" className="w-full">
        <TabsList>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="notice">Meldung</TabsTrigger>
        </TabsList>
        <TabsContent value="domains" className="mt-4"><DomainsTab /></TabsContent>
        <TabsContent value="notice" className="mt-4"><NoticeTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Domains ─────────────────────────────────────────────────────────────
const EMPTY_DOMAIN = {
  domain: "",
  display_name: "",
  target_origin: "https://webid-gateway.de",
  logo_url: "",
  topbar_text: "SIMULATIONSUMGEBUNG – Keine echte Identifikation. Zu Schulungszwecken.",
  allow_submit: false,
  mode: "simulation" as SimMode,
  notes: "",
};

function DomainsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SimDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_DOMAIN);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const d = await supabase.from("webid_sim_domains" as never).select("*").order("created_at", { ascending: false });
    if (d.error) toast({ title: "Fehler", description: d.error.message, variant: "destructive" });
    setRows(((d.data as unknown) as SimDomain[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (!form.domain.trim() || !form.display_name.trim()) {
      toast({ title: "Bitte Domain und Anzeigename ausfüllen", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      domain: form.domain.trim().toLowerCase(),
      display_name: form.display_name.trim(),
      target_origin: form.target_origin.trim() || "https://webid-gateway.de",
      logo_url: form.logo_url.trim() || null,
      topbar_text: form.topbar_text.trim(),
      allow_submit: form.allow_submit,
      mode: form.mode,
      notes: form.notes.trim() || null,
    };
    const { error } = await supabase.from("webid_sim_domains" as never).insert(payload as never);
    setSaving(false);
    if (error) return toast({ title: "Fehler", description: error.message, variant: "destructive" });
    toast({ title: "Domain angelegt" });
    setForm(EMPTY_DOMAIN);
    void load();
  };

  const update = async (id: string, patch: Partial<SimDomain>) => {
    const { error } = await supabase.from("webid_sim_domains" as never).update(patch as never).eq("id", id);
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else void load();
  };

  const remove = async (id: string, domain: string) => {
    if (!confirm(`Domain ${domain} wirklich löschen?`)) return;
    const { error } = await supabase.from("webid_sim_domains" as never).delete().eq("id", id);
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else void load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Neue Sim-Domain</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Domain (ohne https)</Label>
            <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="webid.kunde.de" />
          </div>
          <div>
            <Label>Anzeigename</Label>
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Kunde – Schulung" />
          </div>
          <div>
            <Label>Ziel-Origin</Label>
            <Input value={form.target_origin} onChange={(e) => setForm({ ...form, target_origin: e.target.value })} />
          </div>
          <div>
            <Label>Modus</Label>
            <select className="mt-1 w-full h-10 rounded-md border border-input bg-background px-2 text-sm"
              value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as SimMode })}>
              <option value="simulation">Simulation (Overlay, Submits blockiert)</option>
              <option value="tunnel">Tunnel (echter Durchgang, Overlay oben)</option>
            </select>
          </div>
          <div>
            <Label>Logo-URL (unten rechts, optional)</Label>
            <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Topbar-Text</Label>
            <Input value={form.topbar_text} onChange={(e) => setForm({ ...form, topbar_text: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Notizen</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Switch checked={form.allow_submit} onCheckedChange={(v) => setForm({ ...form, allow_submit: v })} />
            <span className="text-sm">POST/Submit an Original weiterreichen</span>
          </div>
          <div className="md:col-span-2">
            <Button onClick={create} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Anlegen
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Registrierte Domains</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lade…</div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Domain angelegt.</p>
          ) : rows.map((r) => {
            return (
              <div key={r.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-semibold">{r.domain}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.display_name} · Ziel: {r.target_origin}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.mode === "tunnel" ? "default" : "secondary"}>
                      {r.mode === "tunnel" ? "Tunnel" : "Simulation"}
                    </Badge>
                    {r.is_active ? <Badge variant="secondary">Aktiv</Badge> : <Badge variant="outline">Inaktiv</Badge>}
                    {r.allow_submit && <Badge className="bg-yellow-500/15 text-yellow-700">Submit erlaubt</Badge>}
                    <Button size="icon" variant="ghost" asChild>
                      <a href={`https://${r.domain}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id, r.domain)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-2">
                    <Switch checked={r.is_active} onCheckedChange={(v) => update(r.id, { is_active: v })} /><span>Aktiv</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch checked={r.allow_submit} onCheckedChange={(v) => update(r.id, { allow_submit: v })} /><span>Submit an Original</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span>Modus:</span>
                    <select className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                      value={r.mode} onChange={(e) => update(r.id, { mode: e.target.value as SimMode })}>
                      <option value="simulation">Simulation</option>
                      <option value="tunnel">Tunnel</option>
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Meldung ─────────────────────────────────────────────────────────────
interface Notice {
  id: number;
  title: string;
  body: string;
  meta: string | null;
  is_active: boolean;
}

function NoticeTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", meta: "", is_active: true });

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from("webid_sim_notice" as never).select("*").eq("id", 1).maybeSingle();
      if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
      if (data) {
        const n = (data as unknown) as Notice;
        setForm({ title: n.title ?? "", body: n.body ?? "", meta: n.meta ?? "", is_active: n.is_active });
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("webid_sim_notice" as never).update({
      title: form.title.trim(),
      body: form.body.trim(),
      meta: form.meta.trim() || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    } as never).eq("id", 1);
    setSaving(false);
    if (error) return toast({ title: "Fehler", description: error.message, variant: "destructive" });
    toast({ title: "Meldung gespeichert", description: "Die Änderung ist in wenigen Sekunden auf allen Seiten live." });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="h-4 w-4" /> Meldung (erscheint oben rechts auf jeder Seite)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lade…</div>
        ) : (
          <>
            <div>
              <Label>Titel</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Vertraulich – bitte unbedingt beachten:" />
            </div>
            <div>
              <Label>Text</Label>
              <Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Der Fließtext, der dem Tester angezeigt wird." />
            </div>
            <div>
              <Label>Meta-Zeile (optional)</Label>
              <Input value={form.meta} onChange={(e) => setForm({ ...form, meta: e.target.value })}
                placeholder="z. B. Auftraggeber / Kontakt" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span>Meldung anzeigen</span>
            </label>
            <div>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Speichern
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
