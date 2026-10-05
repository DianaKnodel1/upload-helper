import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  checkDomainsHealth,
  setPrimaryDomain,
  getAffectedRecipients,
  addWatchlistDomain,
  removeWatchlistDomain,
  type AffectedRecipient,
  type ExtraDomainHealth,
} from "@/lib/tenant-domains.functions";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Loader2, Users, Star, ExternalLink, Download, Plus, Trash2, Globe, Eye } from "lucide-react";

export const Route = createFileRoute("/admin/domains")({
  component: AdminDomainsPage,
});

type DomainStatus = "ok" | "down" | "slow" | "unknown" | "no_landing";

interface DomainRow {
  tenant_id: string;
  tenant_name: string;
  domain: string;
  is_primary: boolean;
  is_root: boolean;
  status: DomainStatus;
  http_status: number | null;
  latency_ms: number | null;
  error: string | null;
  checked_url?: string;
  root_status?: DomainStatus;
  portal_status?: DomainStatus;
}

function AdminDomainsPage() {
  const { toast } = useToast();
  const checkFn = useServerFn(checkDomainsHealth);
  const setPrimaryFn = useServerFn(setPrimaryDomain);
  const getAffectedFn = useServerFn(getAffectedRecipients);
  const addWatchlistFn = useServerFn(addWatchlistDomain);
  const removeWatchlistFn = useServerFn(removeWatchlistDomain);

  const [rows, setRows] = useState<DomainRow[]>([]);
  const [extras, setExtras] = useState<ExtraDomainHealth[]>([]);
  const [watchlistAvailable, setWatchlistAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [openTenantId, setOpenTenantId] = useState<string | null>(null);
  const [affected, setAffected] = useState<Record<string, AffectedRecipient[]>>({});
  const [loadingAffected, setLoadingAffected] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [newNote, setNewNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const runCheck = async () => {
    setLoading(true);
    try {
      const res = await checkFn({ data: {} as any });
      setRows(res.domains as DomainRow[]);
      setExtras((res as any).extras ?? []);
      setWatchlistAvailable((res as any).watchlist_available !== false);
      setCheckedAt(res.checked_at);
    } catch (e: any) {
      toast({ title: "Health-Check fehlgeschlagen", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runCheck(); }, []);

  const landingExtras = extras.filter((e) => e.source === "landing_page");
  const watchlistExtras = extras.filter((e) => e.source === "watchlist");

  const handleAddDomain = async () => {
    const domain = newDomain.trim();
    if (!domain) return;
    setAdding(true);
    try {
      const res = await addWatchlistFn({ data: { domain, note: newNote.trim() || null } });
      toast({
        title: `${res.entry.domain} wird jetzt überwacht`,
        description: res.check.status === "down" ? "Achtung: Domain aktuell nicht erreichbar!" : `Status: ${res.check.status}`,
        variant: res.check.status === "down" ? "destructive" : "default",
      });
      setNewDomain("");
      setNewNote("");
      await runCheck();
    } catch (e: any) {
      toast({ title: "Hinzufügen fehlgeschlagen", description: e.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveDomain = async (id: string) => {
    setRemovingId(id);
    try {
      await removeWatchlistFn({ data: { id } });
      toast({ title: "Domain aus Überwachung entfernt" });
      setExtras((prev) => prev.filter((e) => e.watchlist_id !== id));
    } catch (e: any) {
      toast({ title: "Entfernen fehlgeschlagen", description: e.message, variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; domains: DomainRow[] }>();
    for (const r of rows) {
      if (!map.has(r.tenant_id)) map.set(r.tenant_id, { name: r.tenant_name, domains: [] });
      map.get(r.tenant_id)!.domains.push(r);
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [rows]);

  const handleSetPrimary = async (tenant_id: string, domain: string) => {
    setSettingPrimary(`${tenant_id}:${domain}`);
    try {
      await setPrimaryFn({ data: { tenant_id, domain } });
      toast({ title: "Versand-Domain aktualisiert", description: `Neue Mails nutzen jetzt ${domain}` });
      await runCheck();
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setSettingPrimary(null);
    }
  };

  const toggleAffected = async (tenant_id: string) => {
    if (openTenantId === tenant_id) { setOpenTenantId(null); return; }
    setOpenTenantId(tenant_id);
    if (!affected[tenant_id]) {
      setLoadingAffected(tenant_id);
      try {
        const res = await getAffectedFn({ data: { tenant_id } });
        setAffected((p) => ({ ...p, [tenant_id]: res.recipients }));
      } catch (e: any) {
        toast({ title: "Fehler", description: e.message, variant: "destructive" });
      } finally {
        setLoadingAffected(null);
      }
    }
  };

  const exportCsv = (tenant_id: string, tenant_name: string, primary_domain: string) => {
    const list = affected[tenant_id] ?? [];
    if (list.length === 0) {
      toast({ title: "Keine Daten", description: 'Erst "Betroffene Empfänger anzeigen" laden.', variant: "destructive" });
      return;
    }
    const header = ["Typ", "Name", "E-Mail", "Telefon", "Status", "Neuer Portal-Link"];
    const rows = list.map((r) => [
      r.kind,
      r.name ?? "",
      r.email ?? "",
      r.phone ?? "",
      r.status,
      `https://${primary_domain}/`,
    ]);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
    // BOM for Excel UTF-8 compatibility
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().split("T")[0];
    const safeName = tenant_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.href = url;
    a.download = `betroffene-empfaenger-${safeName}-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };



  return (
    <div className="p-5 max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-heading font-bold">Domain-Übersicht</h1>
          <p className="text-xs text-muted-foreground">
            Status aller Landing-/Portal-Domains. Klicke „Aktiv setzen" um auf eine andere Domain zu wechseln.
            {checkedAt && <> · Zuletzt geprüft: {new Date(checkedAt).toLocaleTimeString("de-DE")}</>}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={runCheck} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Erneut prüfen
        </Button>
      </div>

      {/* Hilfe-Aufklapper: Was tun bei Domain-Ausfall? */}
      <details className="border rounded-lg bg-muted/30 group">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium flex items-center gap-2 hover:bg-muted/50 transition-colors">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          Was tun, wenn eine Domain ausfällt?
          <span className="ml-auto text-[10px] text-muted-foreground group-open:hidden">Klicken zum Aufklappen</span>
        </summary>
        <div className="px-4 pb-4 pt-1 text-xs text-foreground space-y-2 border-t">
          <p>
            <strong>Beispiel:</strong> <code className="bg-background px-1 rounded">digital-dgigmbh.de</code> ist down,
            <code className="bg-background px-1 rounded">digital-dgigmbh.com</code> soll übernehmen:
          </p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>In der Tabelle unten beim Tenant die <strong>.com</strong>-Zeile suchen.</li>
            <li>Auf <strong>„Aktiv setzen"</strong> klicken (Stern wechselt zur neuen Domain).</li>
            <li>Ab sofort gehen alle neuen Mails von <code className="bg-background px-1 rounded">noreply@digital-dgigmbh.com</code> raus.</li>
            <li>Der Recovery-Cron schickt automatisch an alle Mitarbeiter eine Mail mit dem neuen Login-Link.</li>
          </ol>
          <p className="pt-2 text-muted-foreground">
            <strong>Voraussetzung:</strong> Die Alias-Domain muss vorher schon hinzugefügt + DNS-verifiziert sein.
            Sonst kannst du im Notfall nicht umstellen. Lege deshalb für jeden Tenant <strong>vorab</strong> mindestens
            eine Backup-Domain an.
          </p>
        </div>
      </details>

      {loading && rows.length === 0 && (
        <div className="text-center text-muted-foreground py-10 text-sm">Prüfe Domains…</div>
      )}

      {grouped.map((t) => {
        const primary = t.domains.find((d) => d.is_primary)?.domain ?? t.domains[0]?.domain ?? "";
        const anyDown = t.domains.some((d) => d.status === "down");
        return (
          <Card key={t.id} className={anyDown ? "border-destructive/40" : ""}>
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2 flex-wrap">
                    {t.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Aktive Versand-Domain: <code className="bg-muted px-1.5 py-0.5 rounded">{primary}</code>
                  </p>
                </div>
                {anyDown && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" /> Mindestens eine Domain down
                  </Badge>
                )}
              </div>

              <div className="border rounded-lg divide-y">
                {t.domains.map((d) => (
                  <div key={d.domain} className="flex items-center justify-between p-3 gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <StatusDot status={d.status} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono truncate">{d.checked_url ? d.checked_url.replace(/^https?:\/\//, "").replace(/\/$/, "") : d.domain}</code>
                          {d.is_primary && (
                            <Badge variant="default" className="gap-1 h-5 text-[10px]">
                              <Star className="h-2.5 w-2.5" /> AKTIV
                            </Badge>
                          )}
                          {d.is_root && !d.is_primary && (
                            <Badge variant="outline" className="h-5 text-[10px]">Root</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {d.status === "down" ? (
                            <span className="text-destructive">Nicht erreichbar: {d.error}</span>
                          ) : d.status === "no_landing" ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              Erreichbar, aber keine Landing Page für diesen Host hinterlegt (HTTP 404). Mail-Versand ist davon nicht betroffen.
                            </span>
                          ) : (
                            <>HTTP {d.http_status ?? "?"} · {d.latency_ms}ms · Root {d.root_status ?? "?"} · Portal {d.portal_status ?? "?"}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={d.checked_url ?? `https://${d.domain}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                      >
                        <ExternalLink className="h-3 w-3" /> Öffnen
                      </a>
                      {!d.is_primary && d.status !== "down" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetPrimary(t.id, d.domain)}
                          disabled={settingPrimary === `${t.id}:${d.domain}`}
                        >
                          {settingPrimary === `${t.id}:${d.domain}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>Aktiv setzen</>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => toggleAffected(t.id)}>
                  <Users className="h-3.5 w-3.5 mr-1" />
                  {openTenantId === t.id ? "Empfänger ausblenden" : "Betroffene Empfänger anzeigen"}
                </Button>
                {openTenantId === t.id && (affected[t.id]?.length ?? 0) > 0 && (
                  <Button size="sm" variant="outline" onClick={() => exportCsv(t.id, t.name, primary)}>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    CSV exportieren
                  </Button>
                )}
              </div>


              {openTenantId === t.id && (
                <div className="border rounded-lg overflow-hidden">
                  {loadingAffected === t.id ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Laden…
                    </div>
                  ) : affected[t.id]?.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">Keine aktiven Empfänger.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2">Typ</th>
                            <th className="text-left p-2">Name</th>
                            <th className="text-left p-2">E-Mail</th>
                            <th className="text-left p-2">Telefon</th>
                            <th className="text-left p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(affected[t.id] ?? []).map((r) => (
                            <tr key={`${r.kind}-${r.id}`}>
                              <td className="p-2"><Badge variant="outline" className="text-[10px]">{r.kind}</Badge></td>
                              <td className="p-2 font-medium">{r.name || "–"}</td>
                              <td className="p-2 text-muted-foreground">{r.email ?? "–"}</td>
                              <td className="p-2 text-muted-foreground">{r.phone ?? "–"}</td>
                              <td className="p-2 text-muted-foreground">{r.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Landing-Seiten-Domains */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" /> Landing-Seiten-Domains
            </h2>
            <p className="text-xs text-muted-foreground">
              Alle Domains aus dem Landing-Generator – werden ebenfalls automatisch überwacht.
            </p>
          </div>
          {landingExtras.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">{loading ? "Prüfe…" : "Keine Landing-Domains gefunden."}</p>
          ) : (
            <div className="border rounded-lg divide-y">
              {landingExtras.map((d) => (
                <ExtraDomainRow key={d.domain} d={d} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manuell überwachte Domains */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" /> Manuell überwachte Domains
            </h2>
            <p className="text-xs text-muted-foreground">
              Beliebige Domain hinzufügen – sie wird sofort geprüft und danach alle 5 Minuten automatisch.
            </p>
          </div>

          {!watchlistAvailable ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
              Die Watchlist-Tabelle fehlt noch auf der Datenbank. Bitte die Migration
              <code className="mx-1 bg-background px-1 rounded">20260905000000_domain_monitoring.sql</code>
              im SQL-Editor ausführen – danach funktioniert das Hinzufügen hier.
            </p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="example.de"
                className="h-9 text-sm flex-1 min-w-[180px]"
                onKeyDown={(e) => { if (e.key === "Enter") void handleAddDomain(); }}
              />
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Notiz (optional)"
                className="h-9 text-sm flex-1 min-w-[140px]"
                onKeyDown={(e) => { if (e.key === "Enter") void handleAddDomain(); }}
              />
              <Button size="sm" onClick={() => void handleAddDomain()} disabled={adding || !newDomain.trim()}>
                {adding ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                Hinzufügen & prüfen
              </Button>
            </div>
          )}

          {watchlistExtras.length > 0 && (
            <div className="border rounded-lg divide-y">
              {watchlistExtras.map((d) => (
                <ExtraDomainRow
                  key={d.domain}
                  d={d}
                  onRemove={d.watchlist_id ? () => void handleRemoveDomain(d.watchlist_id!) : undefined}
                  removing={removingId === d.watchlist_id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && grouped.length === 0 && (
        <div className="text-center text-muted-foreground py-10 text-sm">Keine aktiven Tenants gefunden.</div>
      )}
    </div>
  );
}

function ExtraDomainRow({ d, onRemove, removing }: { d: ExtraDomainHealth; onRemove?: () => void; removing?: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <StatusDot status={d.status} />
        <div className="min-w-0">
          <code className="text-sm font-mono truncate">{d.domain}</code>
          <p className="text-[11px] text-muted-foreground">
            {d.status === "down" ? (
              <span className="text-destructive">Nicht erreichbar: {d.error}</span>
            ) : d.status === "no_landing" ? (
              <span className="text-amber-600 dark:text-amber-400">Erreichbar, aber keine Landing Page (HTTP 404)</span>
            ) : (
              <>HTTP {d.http_status ?? "?"} · {d.latency_ms}ms{d.label ? ` · ${d.label}` : ""}</>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <a
          href={d.checked_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1"
        >
          <ExternalLink className="h-3 w-3" /> Öffnen
        </a>
        {onRemove && (
          <Button size="sm" variant="ghost" onClick={onRemove} disabled={removing} title="Aus Überwachung entfernen">
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: DomainStatus }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
  if (status === "down") return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  if (status === "no_landing") return <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />;
  if (status === "slow") return <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />;
  return <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
}
