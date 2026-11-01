import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/lead-mailing")({
  head: () => ({ meta: [
    { title: "Lead-Mailing – Mitarbeiter-Portal" },
    { name: "description", content: "Indeed-Bewerbungen importieren und den E-Mail-Versand je Firma verwalten." },
    { property: "og:title", content: "Lead-Mailing – Mitarbeiter-Portal" },
    { property: "og:description", content: "E-Mail-Versand und Bewerbungsvorlagen je Firma verwalten." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: LeadMailingPage,
});

import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";
import {
  getLeadMailingOverview, saveResendAccess, saveLeadMailSettings, importLeads,
} from "@/lib/lead-mailing.functions";
import { parseLeadCsv, renderLeadTemplate, DEFAULT_LEAD_BODY, DEFAULT_LEAD_SUBJECT, type LeadRow } from "@/lib/lead-mailing";

type Settings = {
  tenant_id: string; active: boolean; sender_email: string | null; sender_name: string | null;
  subject: string | null; body: string | null; homepage_url: string | null; calendly_url: string | null; daily_limit: number;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Wartend", sent: "Gesendet", replied: "Geantwortet", failed: "Fehler", bounced: "Unzustellbar", unsubscribed: "Abgemeldet",
};

function LeadMailingPage() {
  const { toast } = useToast();
  const loadFn = useServerFn(getLeadMailingOverview);
  const saveAccessFn = useServerFn(saveResendAccess);
  const saveSettingsFn = useServerFn(saveLeadMailSettings);
  const importFn = useServerFn(importLeads);

  const [data, setData] = useState<any>(null);
  const [tenantId, setTenantId] = useState<string>("");
  const [form, setForm] = useState<Settings | null>(null);
  const [resendKey, setResendKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [csv, setCsv] = useState<{ name: string; rows: LeadRow[]; invalid: number; duplicates: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await loadFn({ data: {} });
      setData(d);
      setTenantId((cur) => cur || d.tenants[0]?.id || "");
    } catch (e: any) {
      toast({ title: "Laden fehlgeschlagen", description: e?.message, variant: "destructive" });
    }
  }, [loadFn, toast]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data || !tenantId) return;
    const s = data.settings.find((x: Settings) => x.tenant_id === tenantId);
    setForm(s ?? {
      tenant_id: tenantId, active: false, sender_email: "", sender_name: "", subject: DEFAULT_LEAD_SUBJECT,
      body: DEFAULT_LEAD_BODY, homepage_url: "", calendly_url: "", daily_limit: 50,
    });
  }, [data, tenantId]);

  const tenantName = data?.tenants.find((t: any) => t.id === tenantId)?.name ?? "";
  const preview = useMemo(() => {
    if (!form) return "";
    const v = { Vorname: "Anna", Nachname: "Muster", Firma: tenantName, Homepage: form.homepage_url ?? "", Calendly: form.calendly_url ?? "", Absender: form.sender_name ?? "" };
    return `Betreff: ${renderLeadTemplate(form.subject || DEFAULT_LEAD_SUBJECT, v)}\n\n${renderLeadTemplate(form.body || DEFAULT_LEAD_BODY, v)}`;
  }, [form, tenantName]);

  const saveAccess = async () => {
    setBusy("access");
    try {
      await saveAccessFn({ data: { resend_api_key: resendKey.trim() || undefined, resend_webhook_secret: webhookSecret.trim() || undefined } });
      setResendKey(""); setWebhookSecret("");
      toast({ title: "Resend-Zugang gespeichert" });
      await load();
    } catch (e: any) { toast({ title: "Fehler", description: e?.message, variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const saveSettings = async () => {
    if (!form) return;
    setBusy("settings");
    const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
    try {
      await saveSettingsFn({ data: {
        ...form, sender_email: clean(form.sender_email), sender_name: clean(form.sender_name), subject: clean(form.subject),
        body: clean(form.body), homepage_url: clean(form.homepage_url), calendly_url: clean(form.calendly_url),
        daily_limit: Number(form.daily_limit) || 50,
      } });
      toast({ title: "Einstellungen gespeichert" });
      await load();
    } catch (e: any) { toast({ title: "Fehler", description: e?.message, variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const onFile = async (file: File) => {
    try {
      const r = parseLeadCsv(await file.text());
      setCsv({ name: file.name, ...r });
    } catch (e: any) { toast({ title: "CSV nicht lesbar", description: e?.message, variant: "destructive" }); }
  };

  const doImport = async () => {
    if (!csv || !tenantId) return;
    setBusy("import");
    try {
      let imported = 0, skipped = 0;
      for (let i = 0; i < csv.rows.length; i += 1000) {
        const r = await importFn({ data: { tenant_id: tenantId, file_name: csv.name, rows: csv.rows.slice(i, i + 1000) } });
        imported += r.imported; skipped += r.skipped;
      }
      toast({ title: `${imported} Leads importiert`, description: skipped ? `${skipped} waren schon vorhanden.` : undefined });
      setCsv(null);
      await load();
    } catch (e: any) { toast({ title: "Import fehlgeschlagen", description: e?.message, variant: "destructive" }); }
    finally { setBusy(null); }
  };

  if (!data) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  const counts = data.statusCounts[tenantId] ?? {};
  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/resend-webhook` : "";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-heading font-bold">Lead-Mailing</h1>
        <p className="text-sm text-muted-foreground">Indeed-Leads per CSV importieren und automatisch mit Tageslimit anschreiben. Antworten erscheinen im Lead-Postfach.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Resend-Zugang</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>API-Schlüssel {data.resendKeyMasked && <span className="text-muted-foreground">({data.resendKeyMasked})</span>}</Label>
              <Input type="password" placeholder="re_…" value={resendKey} onChange={(e) => setResendKey(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Webhook-Signing-Secret {data.webhookSecretMasked && <span className="text-muted-foreground">({data.webhookSecretMasked})</span>}</Label>
              <Input type="password" placeholder="whsec_…" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Webhook-URL in Resend eintragen (Ereignisse: email.bounced, email.complained, email.received): <code className="font-mono break-all">{webhookUrl}</code></p>
          <Button onClick={saveAccess} disabled={busy === "access" || (!resendKey && !webhookSecret)}>Speichern</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] sm:flex items-center gap-3">
        <Label>Firma</Label>
        <Select value={tenantId} onValueChange={setTenantId}>
          <SelectTrigger className="w-full min-w-0 sm:w-72"><SelectValue placeholder="Firma wählen" /></SelectTrigger>
          <SelectContent>{data.tenants.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_LABEL).map(([k, label]) => (
          <Badge key={k} variant="secondary">{label}: {counts[k] ?? 0}</Badge>
        ))}
      </div>

      {form && (
        <Card>
          <CardHeader><CardTitle className="text-base">Versand für {tenantName}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <span className="text-sm">{form.active ? "Versand aktiv" : "Versand pausiert"}</span>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Absender-Adresse</Label>
                <Input placeholder="karriere@bewerbung.firma.de" value={form.sender_email ?? ""} onChange={(e) => setForm({ ...form, sender_email: e.target.value })} /></div>
              <div className="space-y-1"><Label>Absender-Name</Label>
                <Input placeholder="Max Mustermann" value={form.sender_name ?? ""} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Homepage-Link</Label>
                <Input placeholder="https://…" value={form.homepage_url ?? ""} onChange={(e) => setForm({ ...form, homepage_url: e.target.value })} /></div>
              <div className="space-y-1"><Label>Calendly-Link</Label>
                <Input placeholder="https://calendly.com/…" value={form.calendly_url ?? ""} onChange={(e) => setForm({ ...form, calendly_url: e.target.value })} /></div>
              <div className="space-y-1"><Label>Tageslimit</Label>
                <Input type="number" min={1} max={2000} value={form.daily_limit} onChange={(e) => setForm({ ...form, daily_limit: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground">Neue Domain: Woche 1 → 50, danach wöchentlich verdoppeln bis 500.</p></div>
            </div>
            <div className="space-y-1"><Label>Betreff</Label>
              <Input value={form.subject ?? ""} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div className="space-y-1"><Label>Text</Label>
              <Textarea rows={12} value={form.body ?? ""} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              <p className="text-xs text-muted-foreground">Platzhalter: {"{Vorname} {Nachname} {Firma} {Homepage} {Calendly} {Absender}"}. Ein Abmeldehinweis wird automatisch angehängt.</p></div>
            <div className="space-y-1"><Label>Vorschau</Label>
              <pre className="whitespace-pre-wrap break-words text-sm bg-muted rounded-md p-3">{preview}</pre></div>
            <Button onClick={saveSettings} disabled={busy === "settings"}>Einstellungen speichern</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">CSV-Import (Indeed-Export)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          {csv && (
            <div className="text-sm space-y-2">
              <p><strong>{csv.rows.length}</strong> gültige Leads · {csv.duplicates} doppelt · {csv.invalid} ohne gültige E-Mail</p>
              <p className="text-muted-foreground">Bereits vorhandene Bewerbungen dieser Firma werden beim Import übersprungen. Neue Leads erscheinen in „Bewerbungen“ mit Quelle Indeed.</p>
              <Button className="h-auto min-h-11 max-w-full whitespace-normal text-left" onClick={doImport} disabled={busy === "import" || csv.rows.length === 0}>
                <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4" /><span>{csv.rows.length} Leads für {tenantName} importieren</span></span>
              </Button>
            </div>
          )}
          {data.imports.length > 0 && (
            <div className="text-xs text-muted-foreground break-words space-y-1 pt-2 border-t">
              {data.imports.slice(0, 8).map((i: any) => (
                <div key={i.id}>{new Date(i.created_at).toLocaleString("de-DE")} · {i.file_name} · {i.imported} importiert, {i.skipped} übersprungen</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
