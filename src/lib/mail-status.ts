export type MailTrack = { delivered_at?: string | null; opened_at?: string | null; open_count?: number | null; bounced_at?: string | null };
export type MailStatus = "bounced" | "opened" | "delivered" | "sent";
export function mailStatus(m: MailTrack): MailStatus {
  if (m.bounced_at) return "bounced";
  if (m.opened_at) return "opened";
  if (m.delivered_at) return "delivered";
  return "sent";
}
