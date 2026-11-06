import { Badge } from "@/components/ui/badge";
import { mailStatus, type MailTrack } from "@/lib/mail-status";

const LABEL = { sent: "Gesendet", delivered: "Zugestellt – ungelesen", opened: "Geöffnet", bounced: "Unzustellbar" } as const;
const CLS = {
  sent: "bg-muted text-muted-foreground",
  delivered: "bg-primary/15 text-primary",
  opened: "bg-success/15 text-success",
  bounced: "bg-destructive/15 text-destructive",
} as const;

export function MailStatusBadge({ msg }: { msg: MailTrack & { created_at?: string } }) {
  const s = mailStatus(msg);
  const extra = s === "opened" && msg.opened_at ? ` ${new Date(msg.opened_at).toLocaleDateString("de-DE")}${(msg.open_count ?? 0) > 1 ? ` (${msg.open_count}×)` : ""}` : "";
  return (
    <Badge variant="outline" className={`text-[10px] border-transparent ${CLS[s]}`} title="Geöffnet ist ein Anhaltspunkt, kein sicherer Lesebeweis.">
      ✉ {LABEL[s]}{extra}
    </Badge>
  );
}
