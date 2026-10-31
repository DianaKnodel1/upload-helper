import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/lead-postfach")({
  head: () => ({ meta: [{ title: "Lead-Postfach – Admin" }] }),
  component: LeadInboxPage,
});

import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { listLeadThreads, replyToLead, setLeadMessageHandled } from "@/lib/lead-mailing.functions";

function LeadInboxPage() {
  const { toast } = useToast();
  const listFn = useServerFn(listLeadThreads);
  const replyFn = useServerFn(replyToLead);
  const handledFn = useServerFn(setLeadMessageHandled);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [threads, setThreads] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await listFn({ data: { filter } });
      // Pro Bewerber nur die neueste Antwort in der Liste
      const seen = new Set<string>();
      setThreads(r.threads.filter((t: any) => {
        const k = t.application_id ?? t.from_email;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }));
    } catch (e: any) { toast({ title: "Laden fehlgeschlagen", description: e?.message, variant: "destructive" }); }
  }, [listFn, filter, toast]);
  useEffect(() => { load(); }, [load]);

  const open = async (t: any) => {
    setSelected(t);
    setSubject(t.subject?.startsWith("Re:") ? t.subject : `Re: ${t.subject ?? "Ihre Bewerbung"}`);
    setText("");
    if (!t.application_id) { setMessages([t]); return; }
    const r = await listFn({ data: { filter: "all", applicationId: t.application_id } });
    setMessages(r.messages);
  };

  const send = async () => {
    if (!selected?.application_id) return;
    setSending(true);
    try {
      await replyFn({ data: { applicationId: selected.application_id, subject, text } });
      toast({ title: "Antwort gesendet" });
      await open(selected);
      await load();
      setText("");
    } catch (e: any) { toast({ title: "Senden fehlgeschlagen", description: e?.message, variant: "destructive" }); }
    finally { setSending(false); }
  };

  const markHandled = async (handled: boolean) => {
    if (!selected?.application_id) return;
    await handledFn({ data: { applicationId: selected.application_id, handled } });
    await load();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-heading font-bold">Lead-Postfach</h1>
          <p className="text-sm text-muted-foreground">Antworten der angeschriebenen Bewerber.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === "open" ? "default" : "outline"} size="sm" onClick={() => setFilter("open")}>Offen</Button>
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>Alle</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-4">
        <Card>
          <CardContent className="p-0 divide-y max-h-[70vh] overflow-auto">
            {threads === null && <div className="p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>}
            {threads?.length === 0 && <div className="p-4 text-sm text-muted-foreground">Keine Antworten.</div>}
            {threads?.map((t) => (
              <button key={t.id} onClick={() => open(t)}
                className={`w-full text-left p-3 hover:bg-muted ${selected?.id === t.id ? "bg-muted" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{t.application?.full_name ?? t.from_email}</span>
                  {!t.handled && <Badge variant="destructive">offen</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{t.subject}</div>
                <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("de-DE")}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            {!selected && <p className="text-sm text-muted-foreground">Antwort links auswählen.</p>}
            {selected && (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium">{selected.application?.full_name ?? selected.from_email}</div>
                    <div className="text-xs text-muted-foreground">{selected.from_email}{!selected.application_id && " · keiner Bewerbung zugeordnet"}</div>
                  </div>
                  {selected.application_id && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => markHandled(true)}>Als erledigt markieren</Button>
                      <Button size="sm" variant="ghost" onClick={() => markHandled(false)}>Wieder offen</Button>
                    </div>
                  )}
                </div>
                <div className="space-y-3 max-h-[45vh] overflow-auto">
                  {messages.map((m) => (
                    <div key={m.id} className={`rounded-md p-3 text-sm ${m.direction === "in" ? "bg-muted" : "bg-primary/10 ml-8"}`}>
                      <div className="text-xs text-muted-foreground mb-1">
                        {m.direction === "in" ? "Bewerber" : "Gesendet"} · {new Date(m.created_at).toLocaleString("de-DE")} · {m.subject}
                      </div>
                      <div className="whitespace-pre-wrap">{m.body_text}</div>
                    </div>
                  ))}
                </div>
                {selected.application_id && (
                  <div className="space-y-2 border-t pt-3">
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                    <Textarea rows={6} placeholder="Antwort schreiben …" value={text} onChange={(e) => setText(e.target.value)} />
                    <Button onClick={send} disabled={sending || !text.trim()}>
                      <span>{sending ? "Wird gesendet …" : "Antwort senden"}</span>
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
