import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mitarbeiter sperren / freigeben.
 * Gesperrte Konten können sich nicht mehr anmelden und nicht neu registrieren.
 * Der Mitarbeiter sieht davon nichts (normale Fehlermeldung beim Login).
 */

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nicht autorisiert");
}

const BlockSchema = z.object({
  user_id: z.string().uuid(),
  blocked: z.boolean(),
});

export const setEmployeeBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BlockSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { error } = await sb
      .from("profiles")
      .update({
        is_blocked: data.blocked,
        blocked_at: data.blocked ? new Date().toISOString() : null,
        blocked_by: data.blocked ? context.userId : null,
      })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);

    // Laufende Sitzung beenden, damit die Sperre sofort greift.
    if (data.blocked) {
      try {
        await supabaseAdmin.auth.admin.signOut(data.user_id as any);
      } catch {
        /* Sitzung läuft spätestens beim nächsten Token-Refresh aus */
      }
    }

    try {
      await sb.from("activity_log").insert({
        action: data.blocked ? "mitarbeiter_gesperrt" : "mitarbeiter_freigegeben",
        entity_type: "profile",
        entity_id: data.user_id,
        actor_id: context.userId,
        comment: data.blocked ? "Zugang gesperrt" : "Zugang wieder freigegeben",
      });
    } catch {
      /* Protokoll ist optional */
    }

    return { ok: true, blocked: data.blocked };
  });

const EmailSchema = z.object({ email: z.string().email() });

/**
 * Öffentlich: prüft vor der Registrierung, ob diese E-Mail zu einem
 * gesperrten Konto gehört. Gibt nur true/false zurück, keine Details.
 */
export const isEmailBlocked = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EmailSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const email = data.email.trim().toLowerCase();

    try {
      const { data: profs } = await sb
        .from("profiles")
        .select("user_id")
        .eq("is_blocked", true);
      const ids: string[] = (profs ?? []).map((p: any) => p.user_id);
      if (ids.length === 0) return { blocked: false };

      for (const id of ids) {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
        if ((u?.user?.email ?? "").toLowerCase() === email) return { blocked: true };
      }
    } catch {
      /* im Zweifel nicht blockieren */
    }
    return { blocked: false };
  });
