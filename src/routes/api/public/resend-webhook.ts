import { createFileRoute } from "@tanstack/react-router";

// Resend-Webhook: Bounces, Beschwerden und eingehende Antworten der Bewerber.
// In Resend → Webhooks diese URL eintragen; das Signing-Secret (whsec_…) in
// Admin → Lead-Mailing → Resend-Zugang speichern.

export const Route = createFileRoute("/api/public/resend-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const { loadResendConfig, verifySvixSignature, handleResendEvent } = await import("@/lib/lead-mailing.server");
        const { webhookSecret } = await loadResendConfig();
        if (!webhookSecret || !(await verifySvixSignature(webhookSecret, request.headers, body))) {
          return new Response("Invalid signature", { status: 401 });
        }
        let evt: unknown;
        try { evt = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }
        try {
          const result = await handleResendEvent(evt);
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[resend-webhook]", e?.message ?? e);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
