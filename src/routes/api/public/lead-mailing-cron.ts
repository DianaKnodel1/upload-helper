import { createFileRoute } from "@tanstack/react-router";

// Verschickt wartende Indeed-Lead-Mails (Tageslimit, 08–20 Uhr verteilt).
// Aufruf alle 10 Minuten via Cron auf dem Frontend-Server:
//   */10 * * * * curl -fsS "https://<portal>/api/public/lead-mailing-cron?key=<CRON_SECRET>" >/dev/null

export const Route = createFileRoute("/api/public/lead-mailing-cron")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = new URL(request.url).searchParams.get("key");
        const expected = process.env.CRON_SECRET;
        if (!expected || key !== expected) return new Response("Unauthorized", { status: 401 });
        try {
          const { runLeadMailingCycle } = await import("@/lib/lead-mailing.server");
          return Response.json({ ok: true, ...(await runLeadMailingCycle()) });
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
    },
  },
});
