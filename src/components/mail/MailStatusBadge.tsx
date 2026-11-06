import { Badge } from "@/components/ui/badge";
import { mailStatus, type MailTrack } from "@/lib/mail-status";

const LABEL = { sent: "Gesendet", delivered: "Zugestellt – ungelesen", opened: "Geöffnet", bounced: "Unzustellbar" } as const;
const CLS = {
  sent: "bg-muted text-muted-foreground",
  delivered: "bg-secondary text-secondary-foreground",
  opened: "bg-primary text-primary-foreground",
  bounced: "bg-destructive/15 text-destructive",
} as const;

type Msg = MailTrack & { created_at?: string; subject?: string | null };

export function MailStatusBadge({ msg }: { msg?: Msg | null }) {
  if (!msg) {
    return (
      <Badge variant="outline" className="text-[10px] border-transparent text-muted-foreground/70" title="Über das Portal wurde noch keine E-Mail gesendet.">
        ✉ keine Mail
      </Badge>
    );
  }
  const s = mailStatus(msg);
  const extra = s === "opened" && msg.opened_at ? ` ${new Date(msg.opened_at).toLocaleDateString("de-DE")}${(msg.open_count ?? 0) > 1 ? ` (${msg.open_count}×)` : ""}` : "";
  const sent = msg.created_at ? new Date(msg.created_at).toLocaleString("de-DE") : "";
  const title = [msg.subject ? `Betreff: ${msg.subject}` : null, sent ? `Gesendet: ${sent}` : null, "Geöffnet ist ein Anhaltspunkt, kein sicherer Lesebeweis."].filter(Boolean).join("\n");
  return (
    <Badge variant="outline" className={`text-[10px] border-transparent ${CLS[s]}`} title={title}>
      ✉ {LABEL[s]}{extra}
    </Badge>
  );
}
