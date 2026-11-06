import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Loader2, PenSquare, Search } from "lucide-react";
import { listMailThreads, getMailThread, setThreadHandled, sendPortalMail } from "@/lib/lead-mailing.functions";
import { ComposeMailDialog } from "@/components/mail/ComposeMailDialog";

export const Route = createFileRoute("/admin/postfach")({
  head: () => ({ meta: [
    { title: "Postfach – Admin-Portal" },
    { name: "description", content: "Alle E-Mails mit Leads, Bewerbern und Mitarbeitern lesen, beantworten und neu schreiben." },
    { property: "og:title", content: "Postfach – Admin-Portal" },
    { property: "og:description", content: "Gemeinsames Postfach für Leads, Bewerber und Mitarbeiter." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PostfachPage,
});

type Filter = "all" | "lead" | "employee" | "unread";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Alle" }, { id: "lead", label: "Leads" }, { id: "employee", label: "Mitarbeiter" }, { id: "unread", label: "Ungelesen" },
];
const KIND_LABEL: Record<string, string> = { lead: "Lead", employee: "Mitarbeiter", other: "Extern" };

function PostfachPage() {
  const listFn = useServerFn(listMailThreads);
  const threadFn = useServerFn(getMailThread);
  const handledFn = useServerFn(setThreadHandled);
  const sendFn = useServerFn(sendPortalMail);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [threads, setThreads] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await listFn({ data: { filter, q } });
      setThreads(r.threads);
    } catch (e: any) { toast.error(e?.message ?? "Laden fehlgeschlagen"); }
  }, [listFn, filter, q]);
  useEffect(() => { const h = setTimeout(load, 200); return () => clearTimeout(h); }, [load]);

  const open = async (t: any) => {
    setSelected(t);
    setSubject(t.subject?.startsWith("Re:") ? t.subject : `Re: ${t.subject ?? "Ihre Nachricht"}`);
    setText("");
    const r = await threadFn({ data: { peer: t.peer } });
    setMessages(r.messages);
  };

  const send = async () => {
    if (!selected) return;
    if (!selected.tenant_id) { toast.error("Diesem Verlauf ist keine Firma zugeordnet. Bitte über „Neue Nachricht“ schreiben."); return; }
    setSending(true);
    try {
      await sendFn({ data: { to: selected.peer, tenantId: selected.tenant_id, subject, text, profileId: selected.profile_id, applicationId: selected.application_id } });
      toast.success("Antwort gesendet");
      setText("");
      await open(selected);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Senden fehlgeschlagen"); }
    finally { setSending(false); }
  };

  const markHandled = async (handled: boolean) => {
    if (!selected) return;
    await handledFn({ data: { peer: selected.peer, handled } });
    await load();
  };

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-heading font-semibold tracking-tight">Postfach</h1>
          <p className="text-sm text-muted-foreground">E-Mails mit Leads, Bewerbern und Mitarbeitern an einem Ort.</p>
        </div>
        <Button onClick={() => setComposeOpen(true)} className="rounded-full gap-2"><PenSquare className="h-4 w-4" />Neue Nachricht</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-full bg-muted p-1">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={filter === f.id ? "glass-tab glass-tab-active min-h-8" : "glass-tab min-h-8"}>{f.label}</button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 rounded-full" placeholder="Name oder E-Mail suchen" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(240px,320px)_minmax(0,1fr)] gap-4">
        <div className={`${selected ? "hidden md:block" : ""} min-w-0 rounded-3xl border border-border bg-card overflow-hidden`}>
          <div className="divide-y divide-border max-h-[68vh] overflow-auto">
            {threads === null && <div className="p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>}
            {threads?.length === 0 && <div className="p-4 text-sm text-muted-foreground">Keine Nachrichten.</div>}
            {threads?.map((t) => (
              <button type="button" key={t.peer} onClick={() => open(t)}
                className={`block w-full min-w-0 text-left p-3.5 hover:bg-accent ${selected?.peer === t.peer ? "bg-accent" : ""}`}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <span className={`text-sm min-w-0 truncate ${t.unread ? "font-semibold" : "font-medium"}`}>{t.name}</span>
                  {t.unread > 0 ? <Badge>{t.unread} neu</Badge> : <span className="text-[11px] text-muted-foreground">{KIND_LABEL[t.kind] ?? ""}</span>}
                </div>
                <div className="text-xs truncate">{t.subject}</div>
                <div className="text-xs text-muted-foreground truncate">{t.last_direction === "out" ? "Sie: " : ""}{t.preview}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(t.last_at).toLocaleString("de-DE")}</div>
              </button>
            ))}
          </div>
        </div>

        <div className={`${selected ? "" : "hidden md:block"} min-w-0 rounded-3xl border border-border bg-card p-4 md:p-5 space-y-4`}>
          {!selected && <p className="text-sm text-muted-foreground">Verlauf links auswählen oder eine neue Nachricht schreiben.</p>}
          {selected && (
            <>
              <Button variant="ghost" className="md:hidden gap-2" onClick={() => setSelected(null)}><ArrowLeft />Zurück zum Postfach</Button>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0 break-words">
                  <div className="font-semibold">{selected.name}</div>
                  <div className="text-xs text-muted-foreground break-all">{selected.peer} · {KIND_LABEL[selected.kind] ?? ""}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => markHandled(true)}>Als erledigt markieren</Button>
                  <Button size="sm" variant="ghost" className="rounded-full" onClick={() => markHandled(false)}>Wieder offen</Button>
                </div>
              </div>
              <div className="space-y-3 max-h-[42vh] overflow-auto">
                {messages.map((m) => (
                  <div key={m.id} className={`rounded-2xl p-3 text-sm ${m.direction === "in" ? "bg-muted mr-8" : "bg-primary text-primary-foreground ml-8"}`}>
                    <div className="text-xs opacity-70 mb-1">
                      {m.direction === "in" ? "Eingang" : "Gesendet"} · {new Date(m.created_at).toLocaleString("de-DE")} · {m.subject}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{m.body_text}</div>
                    {m.direction === "out" && (
                      <div className="mt-1 text-xs opacity-80" title="„Geöffnet" ist ein Anhaltspunkt, kein sicherer Lesebeweis.">
                        {m.bounced_at ? "Unzustellbar" : m.opened_at ? `Geöffnet ${new Date(m.opened_at).toLocaleString("de-DE")}${m.open_count > 1 ? ` (${m.open_count}×)` : ""}` : m.delivered_at ? "Zugestellt" : "Gesendet"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t border-border pt-3">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                <Textarea rows={6} placeholder="Antwort schreiben … (Signatur wird automatisch angehängt)" value={text} onChange={(e) => setText(e.target.value)} />
                <Button onClick={send} disabled={sending || !text.trim()} className="rounded-full">
                  <span>{sending ? "Wird gesendet …" : "Antwort senden"}</span>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <ComposeMailDialog open={composeOpen} onOpenChange={setComposeOpen} onSent={load} />
    </div>
  );
}
