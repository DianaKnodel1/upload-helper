import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/sms")({
  component: AdminSmsPage,
});

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAssignableEmployees } from "@/lib/employee-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminData } from "@/contexts/AdminDataContext";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { Plus, Phone, MessageSquare, Trash2, RefreshCw, UserPlus, UserMinus, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { pollAnosimSms } from "@/lib/sms-poll.functions";
import { testAnosimConnection } from "@/lib/sms-test.functions";

const AUTO_REFRESH_MS = 15000;

interface SmsChannel {
  id: string;
  tenant_id: string | null;
  phone_number: string;
  provider: string;
  label: string;
  is_active: boolean;
  created_at: string;
  api_key: string | null;
}

interface SmsMessage {
  id: string;
  channel_id: string | null;
  user_id: string | null;
  direction: string;
  from_number: string;
  to_number: string;
  body: string;
  status: string;
  created_at: string;
}

interface SmsAssignment {
  id: string;
  user_id: string;
  sms_channel_id: string;
  is_active: boolean;
  note: string;
  assigned_at: string;
  assigned_by: string;
}

/** Erkennt einen typischen SMS-Code (4–8 Ziffern) im Text. */
function extractCode(body: string): string | null {
  const m = String(body ?? "").match(/\b(\d{4,8})\b/);
  return m ? m[1]! : null;
}

function AdminSmsPage() {
  const { toast } = useToast();
  const { profiles, adminUserIds } = useAdminData();
  const assignableEmployees = useMemo(
    () => getAssignableEmployees(profiles, adminUserIds),
    [profiles, adminUserIds],
  );

  const [channels, setChannels] = useState<SmsChannel[]>([]);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [smsAssignments, setSmsAssignments] = useState<SmsAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Dialog: neue Nummer
  const [showCreate, setShowCreate] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Zuweisung
  const [assignUserId, setAssignUserId] = useState("");

  const pollNow = useServerFn(pollAnosimSms);
  const testConn = useServerFn(testAnosimConnection);
  const pollingRef = useRef(false);

  useEffect(() => {
    void loadData();
    // Automatischer Abruf, solange die Seite offen ist.
    const t = setInterval(() => { void refreshAll(true); }, AUTO_REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const [chRes, msgRes, asgRes] = await Promise.all([
      supabase.from("sms_channels").select("*").order("created_at", { ascending: false }),
      supabase.from("sms_messages").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("sms_assignments").select("*").order("assigned_at", { ascending: false }),
    ]);
    const chs = (chRes.data as SmsChannel[]) ?? [];
    setChannels(chs);
    setMessages((msgRes.data as SmsMessage[]) ?? []);
    setSmsAssignments((asgRes.data as unknown as SmsAssignment[]) ?? []);
    setSelectedChannel((prev) => prev ?? chs[0]?.id ?? null);
    setLoading(false);
  };

  /** Holt neue SMS beim Anbieter und lädt danach neu. `silent` = Auto-Refresh. */
  const refreshAll = async (silent = false) => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const r: any = await pollNow({ data: undefined as any });
      if (!silent) {
        if (r?.errors?.length) {
          toast({ title: "Abruf mit Warnungen", description: r.errors.slice(0, 2).join(" · "), variant: "destructive" });
        } else {
          toast({ title: "SMS abgerufen", description: `${r?.new ?? 0} neu · ${r?.channels_polled ?? 0} Nummern geprüft` });
        }
      }
    } catch (e: any) {
      if (!silent) toast({ title: "Abruf fehlgeschlagen", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      pollingRef.current = false;
    }
    await loadData();
  };

  const runTest = async (apiKey: string) => {
    const key = apiKey.trim();
    if (!key) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r: any = await testConn({ data: { api_key: key } });
      setTestResult({ ok: !!r?.ok, message: r?.message ?? "" });
    } catch (e: any) {
      setTestResult({ ok: false, message: String(e?.message ?? e) });
    } finally {
      setTesting(false);
    }
  };

  const createChannel = async () => {
    if (!newPhone.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("sms_channels")
      .insert({
        phone_number: newPhone.trim(),
        label: newLabel.trim() || newPhone.trim(),
        provider: "anosim",
        api_key: newApiKey.trim() || null,
      } as any)
      .select("id")
      .maybeSingle();
    setBusy(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Nummer hinzugefügt" });
    setShowCreate(false);
    setNewPhone(""); setNewLabel(""); setNewApiKey(""); setTestResult(null);
    if ((data as any)?.id) setSelectedChannel((data as any).id);
    await refreshAll(true);
  };

  const deleteChannel = async (id: string) => {
    if (!window.confirm("Nummer wirklich löschen? Zuweisungen und Nachrichten verlieren ihre Zuordnung.")) return;
    const { error } = await supabase.from("sms_channels").delete().eq("id", id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    if (selectedChannel === id) setSelectedChannel(null);
    await loadData();
  };

  const toggleActive = async (ch: SmsChannel) => {
    const { error } = await supabase.from("sms_channels").update({ is_active: !ch.is_active }).eq("id", ch.id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    await loadData();
  };

  /** Weist die gewählte Nummer einem Mitarbeiter zu (ab jetzt sieht er neue Codes). */
  const assign = async (channelId: string) => {
    if (!assignUserId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setBusy(true);
    // Vorhandene (auch inaktive) Zuweisung reaktivieren = neuer Startzeitpunkt.
    const existing = smsAssignments.find(
      (a) => a.sms_channel_id === channelId && a.user_id === assignUserId,
    );
    const nowIso = new Date().toISOString();
    const { error } = existing
      ? await supabase.from("sms_assignments")
          .update({ is_active: true, assigned_at: nowIso } as any)
          .eq("id", existing.id)
      : await supabase.from("sms_assignments").insert({
          user_id: assignUserId,
          sms_channel_id: channelId,
          note: "",
          assigned_by: user.id,
        } as any);
    setBusy(false);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Nummer zugewiesen", description: "Der Mitarbeiter sieht ab jetzt eingehende Codes." });
    setAssignUserId("");
    await loadData();
  };

  /** Entzieht die Zuweisung – der Mitarbeiter verliert die Nummer sofort. */
  const revoke = async (asg: SmsAssignment) => {
    const { error } = await supabase.from("sms_assignments")
      .update({ is_active: false } as any)
      .eq("id", asg.id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Zuweisung entzogen" });
    await loadData();
  };

  const activeChannels = channels.filter((c) => c.is_active);
  const current = channels.find((c) => c.id === selectedChannel) ?? null;
  const currentAssignments = current
    ? smsAssignments.filter((a) => a.sms_channel_id === current.id && a.is_active)
    : [];
  const currentMessages = current
    ? messages.filter((m) => m.channel_id === current.id)
    : [];

  const getProfileName = (userId: string) =>
    profiles.find((p) => p.user_id === userId)?.full_name || userId.slice(0, 8);

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast({ title: "Kopiert", description: text });
  };

  if (loading) return <div className="p-5"><div className="h-64 bg-muted/50 rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">SIM-Modul</h1>
          <p className="text-xs text-muted-foreground">
            {channels.length} Nummern · {activeChannels.length} aktiv · {smsAssignments.filter((a) => a.is_active).length} zugewiesen
            <span className="ml-2 opacity-70">· aktualisiert sich automatisch</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refreshAll(false)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Aktualisieren
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nummer hinzufügen
          </Button>
        </div>
      </div>

      {channels.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="Noch keine Nummer"
          description="Füge eine Anosim-Nummer mit API-Key hinzu, um SMS zu empfangen."
          actionLabel="Nummer hinzufügen"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Nummernliste */}
          <div className="space-y-2">
            {channels.map((ch) => {
              const asgCount = smsAssignments.filter((a) => a.sms_channel_id === ch.id && a.is_active).length;
              const msgCount = messages.filter((m) => m.channel_id === ch.id).length;
              return (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannel(ch.id)}
                  className={cn(
                    "w-full text-left border rounded-lg p-3 bg-card transition-colors",
                    selectedChannel === ch.id ? "border-primary/60 bg-primary/5" : "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground truncate">{ch.phone_number}</span>
                    <Badge variant="secondary" className={cn("text-[10px]", ch.is_active ? "bg-green-500/15 text-green-600" : "")}>
                      {ch.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </div>
                  {ch.label && ch.label !== ch.phone_number && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{ch.label}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {asgCount > 0 ? `${asgCount} zugewiesen` : "Nicht zugewiesen"} · {msgCount} SMS
                    {!ch.api_key && <span className="text-orange-500"> · API-Key fehlt</span>}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          {current && (
            <div className="space-y-4">
              <div className="border rounded-lg bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-base font-semibold text-foreground">{current.phone_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {current.label || "Ohne Bezeichnung"} · {current.provider}
                      {current.api_key
                        ? <span className="text-green-600"> · API-Key hinterlegt</span>
                        : <span className="text-orange-500"> · API-Key fehlt</span>}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {current.api_key && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={testing} onClick={() => runTest(current.api_key!)}>
                        {testing ? "…" : "Verbindung testen"}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleActive(current)}>
                      {current.is_active ? "Deaktivieren" : "Aktivieren"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => deleteChannel(current.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {testResult && (
                  <p className={cn("text-[11px] flex items-center gap-1", testResult.ok ? "text-green-600" : "text-destructive")}>
                    {testResult.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {testResult.message}
                  </p>
                )}

                {/* Zuweisung */}
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Zugewiesene Mitarbeiter</p>
                  {currentAssignments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Niemand zugewiesen — die Codes sieht nur der Admin.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {currentAssignments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-foreground truncate">
                            {getProfileName(a.user_id)}
                            <span className="text-[11px] text-muted-foreground ml-2">
                              seit {new Date(a.assigned_at).toLocaleString("de-DE")}
                            </span>
                          </span>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => revoke(a)}>
                            <UserMinus className="h-3 w-3 mr-1" /> Entziehen
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Select value={assignUserId} onValueChange={setAssignUserId}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Mitarbeiter wählen" /></SelectTrigger>
                      <SelectContent>
                        {assignableEmployees.map((p) => (
                          <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="h-8" disabled={!assignUserId || busy} onClick={() => assign(current.id)}>
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Zuweisen
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Der Mitarbeiter sieht nur Codes, die nach der Zuweisung eingehen.
                  </p>
                </div>
              </div>

              {/* Nachrichten */}
              <div className="border rounded-lg bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Nachrichten</h2>
                  <span className="text-xs text-muted-foreground">({currentMessages.length})</span>
                </div>
                {currentMessages.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Noch keine SMS für diese Nummer.</div>
                ) : (
                  <div className="divide-y divide-border max-h-[520px] overflow-auto">
                    {currentMessages.map((m) => {
                      const code = m.direction === "inbound" ? extractCode(m.body) : null;
                      return (
                        <div key={m.id} className="px-4 py-3 hover:bg-muted/30">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground truncate">
                              {m.direction === "inbound" ? `Von ${m.from_number}` : `An ${m.to_number}`}
                            </span>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {new Date(m.created_at).toLocaleString("de-DE")}
                            </span>
                          </div>
                          {code && (
                            <button
                              onClick={() => copy(code)}
                              className="inline-flex items-center gap-1.5 mb-1 rounded-md bg-primary/10 text-primary px-2 py-1 font-mono text-sm font-bold tracking-wider"
                              title="Code kopieren"
                            >
                              {code} <Copy className="h-3 w-3" />
                            </button>
                          )}
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{m.body || "–"}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog: Nummer hinzufügen */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-heading">Anosim-Nummer hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Telefonnummer *">
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+49..." />
            </Field>
            <Field label="Bezeichnung">
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="z.B. Anosim Hauptnummer" />
            </Field>
            <Field label="API-Key">
              <div className="flex gap-2">
                <Input
                  value={newApiKey}
                  onChange={(e) => { setNewApiKey(e.target.value); setTestResult(null); }}
                  placeholder="API-Key von anosim.net"
                  type="password"
                  className="flex-1"
                />
                <Button type="button" size="sm" variant="outline" disabled={testing || !newApiKey.trim()} onClick={() => runTest(newApiKey)}>
                  {testing ? "Teste…" : "Testen"}
                </Button>
              </div>
              {testResult && (
                <p className={cn("text-[11px] mt-1", testResult.ok ? "text-green-600" : "text-destructive")}>
                  {testResult.ok ? "✓" : "✗"} {testResult.message}
                </p>
              )}
            </Field>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button size="sm" onClick={createChannel} disabled={!newPhone.trim() || busy}>Hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
