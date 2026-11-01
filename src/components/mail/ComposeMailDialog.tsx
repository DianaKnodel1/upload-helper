import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { getMailComposeContext, searchMailRecipients, sendPortalMail } from "@/lib/lead-mailing.functions";
import { MAIL_TEMPLATES } from "@/lib/mail-template";

export type MailRecipient = {
  type: "employee" | "applicant" | "free";
  name: string;
  email: string | null;
  profile_id: string | null;
  application_id: string | null;
  tenant_id: string | null;
};

export function ComposeMailDialog({ open, onOpenChange, profileId, initialRecipient, initialSubject, onSent }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId?: string;
  initialRecipient?: MailRecipient | null;
  initialSubject?: string;
  onSent?: () => void;
}) {
  const ctxFn = useServerFn(getMailComposeContext);
  const searchFn = useServerFn(searchMailRecipients);
  const sendFn = useServerFn(sendPortalMail);
  const [senders, setSenders] = useState<any[]>([]);
  const [recipient, setRecipient] = useState<MailRecipient | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MailRecipient[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRecipient(initialRecipient ?? null);
    setSubject(initialSubject ?? "");
    setText("");
    setQuery("");
    ctxFn({ data: { profileId } }).then((r) => {
      setSenders(r.senders);
      const rec = (r.recipient as MailRecipient | null) ?? initialRecipient ?? null;
      if (rec) setRecipient(rec);
      const t = rec?.tenant_id && r.senders.find((s: any) => s.tenant_id === rec.tenant_id);
      setTenantId((t || r.senders.find((s: any) => s.sender_email))?.tenant_id ?? "");
    }).catch((e) => toast.error(e?.message ?? "Laden fehlgeschlagen"));
  }, [open, profileId, initialRecipient, initialSubject, ctxFn]);

  useEffect(() => {
    if (recipient || query.trim().length < 2) { setResults([]); return; }
    const h = setTimeout(() => {
      searchFn({ data: { q: query.trim() } }).then((r) => setResults(r.results as MailRecipient[])).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(h);
  }, [query, recipient, searchFn]);

  const freeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query.trim()) ? query.trim().toLowerCase() : null;
  const sender = useMemo(() => senders.find((s) => s.tenant_id === tenantId), [senders, tenantId]);
  const firstName = (recipient?.name ?? "").split(" ")[0] ?? "";

  const applyTemplate = (id: string) => {
    const t = MAIL_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setSubject(t.subject);
    setText(t.body.replace("{Vorname}", firstName || "").replace("Guten Tag ,", "Guten Tag,"));
  };

  const send = async () => {
    if (!recipient?.email || !tenantId) return;
    setSending(true);
    try {
      await sendFn({ data: {
        to: recipient.email, tenantId, subject, text,
        profileId: recipient.profile_id, applicationId: recipient.application_id,
      } });
      toast.success("E-Mail gesendet");
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Senden fehlgeschlagen");
    } finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Neue Nachricht</DialogTitle>
          <DialogDescription>Einzelne E-Mail mit Firmen-Signatur. Antworten erscheinen im Postfach.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 min-w-0">
          <div className="space-y-1.5">
            <Label>An</Label>
            {recipient ? (
              <div className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-2 min-w-0">
                <span className="text-sm font-medium truncate">{recipient.name}</span>
                <span className="text-xs text-muted-foreground truncate">{recipient.email ?? "keine E-Mail-Adresse"}</span>
                <Button type="button" variant="ghost" size="icon" className="ml-auto h-7 w-7 rounded-full" aria-label="Empfänger entfernen" onClick={() => setRecipient(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Name oder E-Mail-Adresse" value={query} onChange={(e) => setQuery(e.target.value)} />
                {(results.length > 0 || freeEmail) && (
                  <div className="absolute z-10 mt-1 w-full rounded-2xl border border-border bg-popover p-1 max-h-60 overflow-auto">
                    {freeEmail && (
                      <button type="button" className="w-full text-left rounded-xl px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => setRecipient({ type: "free", name: freeEmail, email: freeEmail, profile_id: null, application_id: null, tenant_id: null })}>
                        An <b>{freeEmail}</b> schreiben
                      </button>
                    )}
                    {results.map((r) => (
                      <button key={`${r.type}-${r.profile_id ?? r.application_id}`} type="button" className="w-full text-left rounded-xl px-3 py-2 hover:bg-accent"
                        onClick={() => { setRecipient(r); const t = senders.find((s) => s.tenant_id === r.tenant_id); if (t) setTenantId(t.tenant_id); }}>
                        <div className="text-sm font-medium truncate">{r.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{r.type === "employee" ? "Mitarbeiter" : "Bewerber"} · {r.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="mail-sender">Absender (Firma)</Label>
              <select id="mail-sender" className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                <option value="">Firma wählen …</option>
                {senders.map((s) => (
                  <option key={s.tenant_id} value={s.tenant_id} disabled={!s.sender_email}>
                    {s.name}{s.sender_email ? ` – ${s.sender_email}` : " (kein Absender)"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="mail-template">Vorlage</Label>
              <select id="mail-template" className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Keine Vorlage</option>
                {MAIL_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mail-subject">Betreff</Label>
            <Input id="mail-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mail-text">Nachricht</Label>
            <Textarea id="mail-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ihre Nachricht … (Signatur wird automatisch angehängt)" />
          </div>
          {sender && !sender.sender_email && <p className="text-xs text-destructive">Für diese Firma ist noch kein Absender unter Lead-Mailing hinterlegt.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={send} disabled={sending || !recipient?.email || !tenantId || !subject.trim() || !text.trim()}>
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}<span>{sending ? "Wird gesendet …" : "Senden"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
