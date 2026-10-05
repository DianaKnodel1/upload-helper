import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function isMissingLastSeenColumnError(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("last_seen_at") && (
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("column")
  );
}

/**
 * Heartbeat: setzt profiles.last_seen_at für den eingeloggten User.
 * Bevorzugt die DB-Funktion touch_last_seen() (Zeitstempel serverseitig via
 * now()), fällt auf ein direktes UPDATE zurück, solange die Migration
 * `20260903120000_last_active_fixes.sql` noch nicht eingespielt ist.
 * Wird vom Browser alle ~60s aufgerufen, solange ein Tab offen ist.
 */
export const updateLastSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;

    const rpc = await sb.rpc("touch_last_seen").then(
      (r: any) => r,
      (e: any) => ({ data: null, error: { message: String(e?.message ?? e) } }),
    );
    if (!rpc.error) return { ok: true, skipped: false as const };

    const { error } = await sb
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("user_id", context.userId);

    if (error) {
      if (isMissingLastSeenColumnError(error)) {
        console.warn("profiles.last_seen_at ist noch nicht verfügbar; Presence-Heartbeat wird übersprungen.");
        return { ok: false, skipped: true as const };
      }
      throw new Error(error.message);
    }

    return { ok: true, skipped: false as const };
  });

