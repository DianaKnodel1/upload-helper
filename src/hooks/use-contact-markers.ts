import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Kontakt-Markierung (wer kontaktiert per WhatsApp). Quelle: applications.contact_marker. */
export type ContactMarker = "green" | "blue";

type State = { byApp: Map<string, ContactMarker>; appByUser: Map<string, string>; loaded: boolean };
let state: State = { byApp: new Map(), appByUser: new Map(), loaded: false };
let loading = false;
const subs = new Set<() => void>();
const emit = () => { state = { ...state }; subs.forEach((f) => f()); };

async function load() {
  if (loading) return;
  loading = true;
  try {
    const [apps, profs] = await Promise.all([
      (supabase as any).from("applications").select("id, user_id, contact_marker").not("contact_marker", "is", null),
      (supabase as any).from("profiles").select("user_id, application_id").not("application_id", "is", null),
    ]);
    if (apps.error) return; // Spalte noch nicht migriert → keine Markierungen
    const byApp = new Map<string, ContactMarker>();
    const appByUser = new Map<string, string>();
    for (const a of apps.data ?? []) {
      byApp.set(a.id, a.contact_marker);
      if (a.user_id) appByUser.set(a.user_id, a.id);
    }
    for (const p of profs.data ?? []) if (p.user_id && p.application_id) appByUser.set(p.user_id, p.application_id);
    state = { byApp, appByUser, loaded: true };
    emit();
  } finally {
    loading = false;
  }
}

export async function setContactMarker(appId: string, marker: ContactMarker | null, userId?: string | null) {
  const prev = state.byApp.get(appId) ?? null;
  if (marker) state.byApp.set(appId, marker); else state.byApp.delete(appId);
  if (userId) state.appByUser.set(userId, appId);
  emit();
  const { error } = await (supabase as any).from("applications").update({ contact_marker: marker }).eq("id", appId);
  if (error) {
    if (prev) state.byApp.set(appId, prev); else state.byApp.delete(appId);
    emit();
    toast.error("Markierung konnte nicht gespeichert werden", { description: error.message });
  }
}

export function useContactMarkers() {
  const s = useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb); },
    () => state,
    () => state,
  );
  useEffect(() => { if (!state.loaded) void load(); }, []);
  return {
    forApp: (appId?: string | null) => (appId ? s.byApp.get(appId) ?? null : null),
    forUser: (userId?: string | null) => {
      const appId = userId ? s.appByUser.get(userId) : undefined;
      return appId ? s.byApp.get(appId) ?? null : null;
    },
    appIdForUser: (userId?: string | null) => (userId ? s.appByUser.get(userId) ?? null : null),
  };
}
