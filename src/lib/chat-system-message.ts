// Zentrale Erkennung automatischer Systemnachrichten im Mitarbeiter-Chat.
// DB-Trigger (Willkommen, Vertrag, Verifizierung, Auftragszuweisung, SMS-Code)
// erzeugen Nachrichten mit dem Teamleiter als Absender – sie sollen im Chat als
// neutrale Systemnachricht erscheinen, nicht wie persönliche Nachrichten des
// Teamleiters.

export interface SystemMessageLike {
  sender_id: string;
  message: string;
  is_system?: boolean | null;
}

// Rückfall für Altdaten ohne gesetztes is_system-Feld. "Hallo"/"Willkommen"
// als Wort sind raus – echte Teamleiter-Antworten beginnen oft so. Die exakten
// Auto-Texte der DB-Trigger sind dagegen eindeutig.
const SYSTEM_PREFIXES = ["✅", "🎓", "📋", "💰", "⚠️", "🎉", "📅", "✍️", "📩", "Neuer Auftrag:"];
const SYSTEM_EXACT_TEXTS = ["Vertrag unterschrieben!", "Einführung abgeschlossen!", "Verifizierung bestätigt!"];

export function isSystemMessage(msg: SystemMessageLike, leaderId: string | null) {
  // Echte Server-Markierung hat Vorrang.
  if (msg.is_system === true) return true;
  if (msg.sender_id !== leaderId) return false;
  const text = msg.message ?? "";
  return (
    SYSTEM_PREFIXES.some((p) => text.startsWith(p)) ||
    SYSTEM_EXACT_TEXTS.includes(text) ||
    text.includes("Willkommen im Team!")
  );
}
