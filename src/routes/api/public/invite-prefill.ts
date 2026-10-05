// Public: Registrierungs-Formular mit den Daten der Bewerbung vorbefüllen.
// Eingabe ist der persönliche Einladungs-Token aus dem Registrierungslink —
// wer ihn hat, ist die eingeladene Person. Es werden ausschließlich die
// Angaben zurückgegeben, die der Bewerber selbst eingetragen hat.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const Schema = z.object({ token: z.string().trim().min(8).max(200) });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/invite-prefill")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let payload: unknown;
        try { payload = await request.json(); } catch { return json({ ok: false }, 400); }
        const parsed = Schema.safeParse(payload);
        if (!parsed.success) return json({ ok: false }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tok } = await supabaseAdmin
          .from("invitation_tokens")
          .select("application_id, email, used")
          .eq("token", parsed.data.token)
          .maybeSingle();
        if (!tok) return json({ ok: false, found: false });

        let first_name: string | null = null;
        let last_name: string | null = null;
        let phone: string | null = null;
        const appId = (tok as any).application_id as string | null;
        if (appId) {
          const { data: app } = await supabaseAdmin
            .from("applications")
            .select("first_name, last_name, full_name, phone")
            .eq("id", appId)
            .maybeSingle();
          if (app) {
            const full = String((app as any).full_name ?? "").trim();
            first_name = (app as any).first_name || (full ? full.split(/\s+/)[0] ?? null : null);
            last_name = (app as any).last_name || (full ? full.split(/\s+/).slice(1).join(" ") || null : null);
            phone = (app as any).phone ?? null;
          }
        }
        return json({
          ok: true,
          found: true,
          email: (tok as any).email ?? null,
          first_name,
          last_name,
          phone,
        });
      },
    },
  },
});
