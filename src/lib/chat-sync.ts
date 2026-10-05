// Gemeinsame Synchronisations-Logik für alle Chat-Oberflächen
// (Admin-Chat, Mitarbeiter-Chat, FloatingChat).
//
// Ziele:
//  - Nachrichten dürfen nie verschwinden: lokal noch nicht gespeicherte
//    Nachrichten ("pending-…") überleben jedes Neuladen.
//  - Der Chat verhält sich wie ein Live-Chat: nach Tab-Wechsel, Netzabriss
//    oder Realtime-Ausfall wird automatisch nachsynchronisiert.
import { useEffect, useRef } from "react";

export interface BaseChatMessage {
  id: string;
  created_at: string;
  delivery_status?: "sending" | "failed";
}

/** Lokale, noch nicht in der Datenbank gespeicherte Nachricht. */
export function isPendingId(id: string) {
  return typeof id === "string" && id.startsWith("pending-");
}

function sortByTime<T extends BaseChatMessage>(list: T[]) {
  return list.slice().sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/**
 * Führt Serverdaten mit dem aktuellen Zustand zusammen.
 * Bestehende Einträge werden aktualisiert, `pending-…`-Einträge bleiben
 * immer erhalten (sie existieren serverseitig noch nicht).
 */
export function mergeMessages<T extends BaseChatMessage>(
  current: T[],
  incoming: T[],
  isHidden?: (m: T) => boolean,
): T[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const message of incoming) {
    if (isHidden?.(message)) continue;
    byId.set(message.id, message);
  }
  return sortByTime(Array.from(byId.values()));
}

/**
 * Ersetzt den Verlauf durch frisch geladene Serverdaten – behält dabei aber
 * alle lokalen Nachrichten mit Status "wird gesendet" / "fehlgeschlagen".
 */
export function replaceMessages<T extends BaseChatMessage>(
  current: T[],
  next: T[],
  isHidden?: (m: T) => boolean,
): T[] {
  const pending = current.filter((m) => isPendingId(m.id));
  return mergeMessages(pending, next, isHidden);
}

export type ChatConnectionState = "live" | "reconnecting";

interface ResyncOptions {
  /** Aktiv nur, wenn true (z. B. User eingeloggt / Chat geöffnet). */
  enabled?: boolean;
  /** Intervall des stillen Fallback-Polls in ms. */
  intervalMs?: number;
}

/**
 * Löst eine Nachsynchronisierung aus bei:
 *  - Tab wird wieder sichtbar
 *  - Netzwerk kommt zurück (online)
 *  - Fenster erhält den Fokus
 *  - alle `intervalMs` als stiller Fallback (Standard 25 s)
 */
export function useChatResync(resync: () => void | Promise<void>, options: ResyncOptions = {}) {
  const { enabled = true, intervalMs = 25_000 } = options;
  const ref = useRef(resync);
  ref.current = resync;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const run = () => { void ref.current(); };
    const onVisibility = () => { if (document.visibilityState === "visible") run(); };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", run);
    window.addEventListener("focus", run);
    const iv = window.setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, intervalMs);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", run);
      window.removeEventListener("focus", run);
      window.clearInterval(iv);
    };
  }, [enabled, intervalMs]);
}

/** Jüngster gültiger Zeitstempel aus mehreren Quellen. */
export function latestTimestamp(...values: Array<string | null | undefined>): string | null {
  let best: { iso: string; ms: number } | null = null;
  for (const v of values) {
    if (!v) continue;
    const ms = new Date(v).getTime();
    if (Number.isNaN(ms)) continue;
    if (!best || ms > best.ms) best = { iso: v, ms };
  }
  return best?.iso ?? null;
}
