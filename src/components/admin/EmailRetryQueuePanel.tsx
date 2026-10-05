import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCcw, Check, Clock, AlertTriangle, Info } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  listRetryQueue,
  cancelRetryEntry,
  type RetryQueueItem,
} from "@/lib/email-retry-queue.functions";
import { EMAIL_TYPE_LABELS } from "@/lib/email-stats";

const REASON_LABELS: Record<string, string> = {
  smtp_hourly_rate_limit: "SMTP-Stundenlimit",
  transient_smtp: "SMTP-Störung",
  unknown_transient: "Unbekannter Fehler",
  outside_send_window: "Ausserhalb Sendefenster",
  tenant_1h_cap: "Stundenkontingent",
  tenant_24h_cap: "Tageskontingent",
};

function reasonLabel(reason: string | null): string {
  if (!reason) return "—";
  const base = reason.split(":")[0];
  return REASON_LABELS[reason] ?? REASON_LABELS[base] ?? reason;
}

function fmt(ts: string | null): string {
  if (!ts) return "sofort";
  return new Date(ts).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function EmailRetryQueuePanel() {
  const { toast } = useToast();
  const list = useServerFn(listRetryQueue);
  const cancel = useServerFn(cancelRetryEntry);

  const [waiting, setWaiting] = useState<RetryQueueItem[]>([]);
  const [manual, setManual] = useState<RetryQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await list({ data: {} as any });
      setWaiting(res.waiting);
      setManual(res.manual);
    } catch (e: any) {
      toast({ title: "Laden fehlgeschlagen", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);


  const handleCancel = async (logId: string) => {
    setBusy(logId);
    try {
      await cancel({ data: { log_id: logId } });
      await load();
    } catch (e: any) {
      toast({ title: "Fehler", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const renderRows = (rows: RetryQueueItem[], kind: "waiting" | "manual") => (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Empfänger</th>
            <th className="text-left px-3 py-2 font-medium">Vorlage</th>
            <th className="text-left px-3 py-2 font-medium">Mandant</th>
            <th className="text-left px-3 py-2 font-medium">Grund</th>
            <th className="text-center px-3 py-2 font-medium">Versuche</th>
            <th className="text-left px-3 py-2 font-medium">{kind === "waiting" ? "Nächster Versuch" : "Fehler"}</th>
            <th className="text-right px-3 py-2 font-medium">Aktion</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2 break-all">{r.recipient_email ?? "—"}</td>
              <td className="px-3 py-2 truncate max-w-[12rem]">{EMAIL_TYPE_LABELS[r.template_name] ?? r.template_name}</td>
              <td className="px-3 py-2 truncate max-w-[10rem]">{r.tenant_name ?? "—"}</td>
              <td className="px-3 py-2">{reasonLabel(r.retry_reason)}</td>
              <td className="px-3 py-2 text-center">
                <Badge variant={r.retry_count >= 5 ? "destructive" : "secondary"} className="text-[10px]">{r.retry_count}</Badge>
              </td>
              <td className="px-3 py-2 text-muted-foreground truncate max-w-[16rem]" title={r.error_message ?? ""}>
                {kind === "waiting" ? fmt(r.next_retry_at) : ((r.error_message ?? "").slice(0, 90) || "—")}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <Button size="sm" variant="ghost" className="h-7 gap-1"
                  onClick={() => handleCancel(r.id)} disabled={busy === r.id}>
                  {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Erledigt
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 && (
        <div className="px-3 py-2 text-[11px] text-muted-foreground border-t">… und {rows.length - 50} weitere</div>
      )}
    </div>
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Warteschlange · Nachversand (deaktiviert)
            </h3>
            <p className="text-xs text-muted-foreground max-w-2xl mt-1">
              Der eigene Mailversand ist komplett abgeschaltet — Termin-Mails und SMS kommen von Calendly.
              Diese Liste zeigt nur noch Altlasten aus der Zeit davor; nachsenden kann hier nichts mehr.
              Einträge kannst du als „Erledigt" abhaken.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading} className="h-8 gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Neu laden
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-sky-300/60 bg-sky-50 dark:bg-sky-950/30 px-3 py-2 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-sky-600 dark:text-sky-300" />
          <p className="text-xs text-sky-800 dark:text-sky-200">
            Eigener Mailversand deaktiviert — diese Warteschlange versendet nichts mehr.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Lade…
          </div>
        ) : (
          <>
            {waiting.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground rounded-xl border border-dashed">
                Keine wartenden Mails — alles zugestellt.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-medium">Wartend ({waiting.length})</div>
                {renderRows(waiting, "waiting")}
              </div>
            )}

            {manual.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> Manuelle Nacharbeit nötig ({manual.length})
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Mails mit abgelaufenem Link oder dauerhaftem Fehler werden bewusst nicht automatisch wiederholt.
                </p>
                {renderRows(manual, "manual")}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}