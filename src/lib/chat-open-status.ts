// Zentrale Regel "Antwort offen" für den Admin-Chat.
// MUSS identisch zur SQL-Funktion public.list_chat_conversations() bleiben
// (supabase/manual-migrations/20261012100000_chat_open_status.sql).
//
// Ein Chat ist offen, wenn nach der letzten ECHTEN Admin-Antwort noch
// Mitarbeiter-Nachrichten kommen. Lesestatus spielt keine Rolle.
// Keine echte Antwort: Systemnachrichten (is_system bzw. bekannte Auto-Texte)
// und interne KI-Notizen.

export interface OpenStatusMessage {
  sender_id: string;
  receiver_id?: string;
  message: string | null;
  created_at: string;
  is_system?: boolean | null;
}

export interface OpenCase {
  openCount: number;
  openSince: string | null;
  openPreview: string | null;
}

const INTERNAL_NOTE_PREFIXES = ["[ESCALATE]", "🤖 KI-Eskalation", "🤖 KI Eskalation"];
const SYSTEM_PREFIXES = ["✅", "🎓", "📋", "💰", "⚠️", "🎉", "📅", "✍️", "📩", "Neuer Auftrag:"];
const SYSTEM_EXACT = ["Vertrag unterschrieben!", "Einführung abgeschlossen!", "Verifizierung bestätigt!"];

export function isInternalNote(text: string | null | undefined) {
  const m = text ?? "";
  return INTERNAL_NOTE_PREFIXES.some((p) => m.startsWith(p));
}

/** Automatische Nachricht von Admin-Seite (zählt nicht als Antwort). */
export function isAutoMessage(msg: OpenStatusMessage) {
  if (msg.is_system === true) return true;
  const t = msg.message ?? "";
  return SYSTEM_PREFIXES.some((p) => t.startsWith(p)) || SYSTEM_EXACT.includes(t) || t.includes("Willkommen im Team!");
}

/** Echte Admin-Antwort an den Mitarbeiter? */
export function isRealAdminReply(msg: OpenStatusMessage, partnerId: string) {
  return msg.sender_id !== partnerId && !isInternalNote(msg.message) && !isAutoMessage(msg);
}

/** Berechnet den offenen Fall aus dem Verlauf eines Mitarbeiters (beliebige Reihenfolge). */
export function computeOpenCase(messages: OpenStatusMessage[], partnerId: string): OpenCase {
  const sorted = messages.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  let openCount = 0;
  let openSince: string | null = null;
  let openPreview: string | null = null;
  for (const m of sorted) {
    if (isInternalNote(m.message)) continue;
    if (m.sender_id === partnerId) {
      openCount += 1;
      openSince = m.created_at;
      if (openPreview === null) openPreview = m.message ?? "";
      continue;
    }
    if (isRealAdminReply(m, partnerId)) break;
  }
  return { openCount, openSince, openPreview };
}
