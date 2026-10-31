// Bewerbungsgespräch (Chat, schriftlich).
// POST /api/public/interview-chat
//   { applicationId, action: "init" }                → initialer KI-Gruß + erste Frage
//   { applicationId, action: "message", text }       → Antwort des Bewerbers, AI antwortet
//   { applicationId, action: "end" }                 → erzwingt Zusammenfassung + Score
//
// Kein Auth (öffentlich, applicationId-scoped). Speichert Verlauf in
// public.applications.interview_messages und ruft Lovable AI Gateway auf.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  sendRegistrationInviteAfterAiAccept,
  getExistingRegistrationLink,
  prettifyCompanyName,
  callGateway,
  DEFAULT_INTERVIEW_PROMPT,
} from "@/lib/interview-engine.server";
import { buildInterviewFactsBlock, buildTeamNotesBlock } from "@/lib/interview-facts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const Input = z.object({
  applicationId: z.string().uuid(),
  action: z.enum(["init", "message", "end"]),
  text: z.string().max(4000).optional(),
});







const SUMMARY_PROMPT = `Du bist ein erfahrener Personalleiter. Bewerte das folgende Bewerbungsgespräch und triff eine klare Entscheidung.

WICHTIG — Entscheidungsregel:
- Ablehnen ("reject") NUR wenn der Bewerber KEINE Zeit hat ODER KEIN echtes Interesse zeigt (verarscht das Gespräch, unangemessene Antworten, offensichtlich nicht ernst gemeint).
- In ALLEN anderen Fällen: einladen ("invite"). Fehlende Erfahrung, Nervosität, kurze Antworten oder Rechtschreibfehler sind KEIN Ablehnungsgrund — jeder darf mitmachen.
- "unsure" ist NICHT erlaubt. Triff eine klare Entscheidung.

Antworte AUSSCHLIESSLICH als gültiges JSON-Objekt (keine Markdown-Codeblöcke):
{
  "summary": "string (3–6 Sätze, Deutsch, neutral, fasse die Antworten zusammen)",
  "score": number,         // 0–100
  "recommendation": "invite" | "reject"
}`;

type Msg = { role: "user" | "assistant"; text: string; ts: string };

type ApplicationRow = {
  id: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  tenant_id?: string | null;
  status?: string | null;
  source_slug?: string | null;
  source_landing_id?: string | null;
  target_landing_id?: string | null;
  interview_messages?: unknown;
  interview_status?: string | null;
  interview_mode?: string | null;
  interview_started_at?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}



type Rec = "invite" | "reject";

/** Holt das JSON-Objekt aus einer Modellantwort (Codeblöcke/Vortext tolerant). */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body.trim();
}

/** Notauswertung — nach einem geführten Gespräch MUSS eine Entscheidung fallen. */
function fallbackDecision(messages: Msg[]): { summary: string; score: number; recommendation: Rec } {
  const answers = messages.filter((m) => m.role !== "assistant").map((m) => m.text.trim()).filter(Boolean);
  const text = answers.join(" ").toLowerCase();
  const substantial = answers.filter((a) => a.length >= 8).length;
  const refuses = /(kein interesse|keine lust|nicht interessiert|will nicht|möchte nicht|abbrechen|absage|doch nicht|keine zeit)/.test(text);
  const rec: Rec = refuses || substantial < 2 ? "reject" : "invite";
  return {
    summary:
      `Automatische Entscheidung ohne KI-Auswertung (Modellantwort war technisch unlesbar). ` +
      `Grundlage: ${answers.length} Antworten des Bewerbers, davon ${substantial} inhaltlich. ` +
      (rec === "reject"
        ? "Es wurde kein ernsthaftes Interesse erkennbar — Absage."
        : "Der Bewerber hat mitgewirkt und Interesse gezeigt — Zusage."),
    score: rec === "invite" ? 60 : 20,
    recommendation: rec,
  };
}

async function runSummary(messages: Msg[]): Promise<{ summary: string; score: number; recommendation: Rec }> {
  const transcript = messages
    .map((m) => `${m.role === "assistant" ? "Recruiter" : "Bewerber"}: ${m.text}`)
    .join("\n");
  let lastRaw = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const strict =
        attempt === 1
          ? SUMMARY_PROMPT
          : `${SUMMARY_PROMPT}\n\nDEIN LETZTER VERSUCH WAR UNGÜLTIG. Antworte NUR mit dem reinen JSON-Objekt — kein Text davor oder danach, keine Markdown-Codeblöcke.`;
      lastRaw = await callGateway(
        [
          { role: "system", content: strict },
          { role: "user", content: `Transcript:\n\n${transcript}` },
        ],
        { jsonMode: true },
      );
      const parsed = JSON.parse(extractJson(lastRaw));
      return {
        summary: String(parsed.summary ?? "").trim() || lastRaw.slice(0, 2000),
        score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
        recommendation: parsed.recommendation === "reject" ? "reject" : "invite",
      };
    } catch (e) {
      console.error(`[interview-chat] Auswertung Versuch ${attempt} fehlgeschlagen:`, (e as any)?.message);
    }
  }
  return fallbackDecision(messages);
}

const toAiDecision = (rec: Rec) => (rec === "reject" ? "absage" : "zusage");

const toApplicationStatus = (rec: Rec) => (rec === "reject" ? "abgelehnt" : "akzeptiert");

export const Route = createFileRoute("/api/public/interview-chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const parsed = Input.safeParse(payload);
        if (!parsed.success) return json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
        const { applicationId, action, text } = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Lade Bewerbung + Landing-Prompt
        const { data: app, error: appErr } = await supabaseAdmin
          .from("applications")
          .select("id, full_name, first_name, last_name, email, tenant_id, status, source_slug, source_landing_id, target_landing_id, interview_messages, interview_status, interview_mode, interview_started_at, scheduled_at, is_test")
          .eq("id", applicationId)
          .maybeSingle();
        if (appErr || !app) return json({ error: "Bewerbung nicht gefunden" }, 404);
        if (app.interview_status === "done" || app.interview_status === "taken_over") {
          return json({ error: "Interview bereits abgeschlossen", status: app.interview_status }, 409);
        }

        void (app as any).is_test;

        // Termin-Gating entfernt: Das Bewerbungsgespräch kann jederzeit sofort
        // gestartet werden (kein gebuchter Termin, keine Wartezeit, kein Umbuchen).

        // Geschäftszeiten-Gate deaktiviert (Testphase) — Recruiter rund um die Uhr erreichbar.

        // Kein hartes Zeitlimit mehr — Server-Auto-Timeout (45 Min Inaktivität) via DB-Cron
        // beendet vergessene Gespräche. Ein starres 15-Min-Limit killte Interviews mitten
        // im Abschluss (siehe Stephanie Adler).
        const timedOut = false;


        let systemPrompt = DEFAULT_INTERVIEW_PROMPT;
  let teamNotes = "";
        {
          // Admin → KI-Einstellungen: Standard-Prompt / feste Anweisungen.
          const { data: ss } = await supabaseAdmin.from("system_settings").select("default_system_prompt").eq("id", 1).maybeSingle();
          const adminPrompt = (ss as any)?.default_system_prompt?.trim?.();
          if (adminPrompt) teamNotes = adminPrompt;
        }
        let companyName = "unserem Unternehmen";
        let recruiterName = "Ihr HR-Team";
        let recruiterAvatarUrl: string | null = null;
        {
          const sel = "id, slug, source_slug, interview_system_prompt, branding, recruiter_name, recruiter_avatar_url, linked_fasttrack_landing_id";
          let lp: any = null;
          if ((app as any).source_landing_id) {
            const { data: byId } = await supabaseAdmin
              .from("landing_pages").select(sel).eq("id", (app as any).source_landing_id).maybeSingle();
            lp = byId ?? null;
          }
          if (!lp && app.source_slug) {
          const { data: bySource } = await supabaseAdmin
            .from("landing_pages").select(sel).eq("source_slug", app.source_slug).maybeSingle();
          lp = bySource ?? null;
          if (!lp) {
            const { data: bySlug } = await supabaseAdmin
              .from("landing_pages").select(sel).eq("slug", app.source_slug).maybeSingle();
            lp = bySlug ?? null;
          }
          }
          let ft: any = null;
          if (lp?.linked_fasttrack_landing_id) {
            const { data: ftData } = await supabaseAdmin
              .from("landing_pages").select(sel).eq("id", lp.linked_fasttrack_landing_id).maybeSingle();
            ft = ftData ?? null;
          }
          if (!lp && (app as any).target_landing_id) {
            const { data: ftData } = await supabaseAdmin
              .from("landing_pages").select(sel).eq("id", (app as any).target_landing_id).maybeSingle();
            ft = ftData ?? null;
          }
          // Das Gespräch führt IMMER die Fast-Track-Firma → diese hat Vorrang,
          // die Vermittlungs-Landing ist nur Fallback für fehlende Felder.
          const custom = ft?.interview_system_prompt?.trim?.() || lp?.interview_system_prompt?.trim?.();
          if (custom) systemPrompt = custom;
          const fn = ft?.branding?.firmenname?.trim?.() || lp?.branding?.firmenname?.trim?.();
          if (fn) companyName = prettifyCompanyName(fn);
          const rn =
            ft?.branding?.recruiter_name?.trim?.() ||
            ft?.recruiter_name?.trim?.() ||
            lp?.branding?.recruiter_name?.trim?.() ||
            lp?.recruiter_name?.trim?.();
          if (rn) recruiterName = rn;
          recruiterAvatarUrl =
            ft?.recruiter_avatar_url ||
            ft?.branding?.recruiter_avatar_url ||
            lp?.recruiter_avatar_url ||
            lp?.branding?.recruiter_avatar_url ||
            null;
        }
        // Branding wird an das Frontend durchgereicht, damit Chat-Kopf und
        // Begrüßungstext garantiert dieselbe Firma/Person zeigen.
        const brandingOut = {
          recruiter_name: recruiterName,
          recruiter_avatar_url: recruiterAvatarUrl,
          company_name: companyName,
        };
        // Portal der Partnerfirma (Fast-Track) — identische Aufloesung wie in
        // der Zusage-Mail. Ohne diesen Wert darf das Frontend KEINEN
        // Registrierungslink raten (sonst landet der Bewerber auf der
        // Vermittlungs-Domain statt bei der Partnerfirma).
        let portalBaseOut: string | null = null;
        try {
          const { resolveFasttrackPortalBase } = await import("@/lib/portal-base.server");
          portalBaseOut = (await resolveFasttrackPortalBase(applicationId)).base;
        } catch (e) {
          console.warn("[interview-chat] portal base:", e);
        }
        // Vorname personalisieren — für persönliche Ansprache im Prompt.
        const rawFirst = (app as any).first_name?.trim?.() || (app.full_name || "").trim().split(/\s+/)[0] || "";
        const firstNameForPrompt = rawFirst || "";
        systemPrompt = systemPrompt
          .replace(/\{company\}/g, companyName)
          .replace(/\{recruiter\}/g, recruiterName)
          .replace(/\{first_name\}/g, firstNameForPrompt)
          // Alte/custom Landing-Prompts enthielten Sabine teils hartcodiert statt als {recruiter}.
          .replace(/Sabine Schneider/g, recruiterName);
        systemPrompt += buildTeamNotesBlock(teamNotes) + buildInterviewFactsBlock();

        const history: Msg[] = Array.isArray(app.interview_messages) ? (app.interview_messages as any) : [];

        // ──────────────────────────────────────────────────────────────
        if (action === "end" || timedOut) {
          if (history.length === 0) return json({ error: "Kein Verlauf vorhanden" }, 400);
          const result = await runSummary(history);
          const { error: updErr } = await supabaseAdmin
            .from("applications")
            .update({
              status: toApplicationStatus(result.recommendation),
              interview_status: "done",
              interview_summary: result.summary,
              interview_score: result.score,
              interview_recommendation: result.recommendation,
              ai_decision: toAiDecision(result.recommendation),
              ai_reason: result.summary,
              interview_completed_at: new Date().toISOString(),
            } as any)
            .eq("id", applicationId);
          if (updErr) return json({ error: updErr.message }, 500);
          // KI-Zusage → Glückwunsch-/Registrierungs-Mail geht sofort raus.
          let inviteMail: any = { sent: false, skipped: true, reason: "no_ai_invite" };
          if (result.recommendation === "invite") {
            inviteMail = await sendRegistrationInviteAfterAiAccept(app as any, request);
            // Der Link ist im Mail-losen Betrieb der einzige Weg weiter —
            // deshalb immer mitliefern, auch wenn kein Mailversand stattfand.
            if (!inviteMail?.registration_link) {
              const link = await getExistingRegistrationLink(app as any, request);
              if (link) inviteMail = { ...(inviteMail ?? {}), registration_link: link };
            }
            await supabaseAdmin.rpc("advance_application_stage", {
              _application_id: applicationId,
              _to_stage: "vermittlung_zusage",
              _actor_id: null,
              _reason: "ai_interview:invite",
              _force: false,
            } as any).then(() => {}, (e: any) => console.warn("[interview-chat] stage rpc:", e));
          }
          return json({ ok: true, ended: true, timedOut, application_status: toApplicationStatus(result.recommendation), invite_mail: inviteMail, branding: brandingOut, portal_base: portalBaseOut, applicant_email: app.email ?? null, ...result });
        }

        // Baue Messages für AI
        const aiMessages: Array<{ role: string; content: string }> = [
          { role: "system", content: systemPrompt },
        ];
        for (const m of history) aiMessages.push({ role: m.role, content: m.text });

        if (action === "message") {
          if (!text || !text.trim()) return json({ error: "text fehlt" }, 400);
          history.push({ role: "user", text: text.trim(), ts: new Date().toISOString() });
          aiMessages.push({ role: "user", content: text.trim() });
        }

        // Bei init: nur Greeting holen, falls History leer; sonst bestehenden Verlauf zurückgeben.
        if (action === "init" && history.length > 0) {
          const alreadyDone = app.interview_status === "done" || app.interview_status === "taken_over";
          // Nach Reload den bereits erzeugten Registrierungs-Link mitliefern,
          // damit der Zusage-Screen den Button „Jetzt registrieren" zeigt.
          let inviteMail: any = undefined;
          if (alreadyDone && app.status === "akzeptiert") {
            const link = await getExistingRegistrationLink(app as any, request);
            if (link) inviteMail = { sent: true, registration_link: link };
          }
          return json({
            reply: history[history.length - 1]?.text ?? "",
            ended: alreadyDone,
            history,
            application_status: alreadyDone ? app.status ?? undefined : undefined,
            invite_mail: inviteMail,
            interview_started_at: app.interview_started_at ?? null,
            branding: brandingOut,
            portal_base: portalBaseOut,
            applicant_email: app.email ?? null,
          });
        }

        // AI-Antwort
        const replyRaw = await callGateway(aiMessages);
        const ended = /\[INTERVIEW_END\]/i.test(replyRaw);
        const reply = replyRaw.replace(/\[INTERVIEW_END\]/gi, "").trim();
        history.push({ role: "assistant", text: reply, ts: new Date().toISOString() });

        const updates: any = {
          interview_messages: history,
          interview_mode: app.interview_mode ?? "chat",
        };
        if (!app.interview_started_at && (!app.interview_status || app.interview_status === "pending")) {
          updates.interview_status = "running";
          updates.interview_started_at = new Date().toISOString();
        }

        if (ended) {
          const result = await runSummary(history);
          updates.status = toApplicationStatus(result.recommendation);
          updates.interview_status = "done";
          updates.interview_summary = result.summary;
          updates.interview_score = result.score;
          updates.interview_recommendation = result.recommendation;
          updates.ai_decision = toAiDecision(result.recommendation);
          updates.ai_reason = result.summary;
          updates.interview_completed_at = new Date().toISOString();
        }

        const { error: updErr } = await supabaseAdmin.from("applications").update(updates).eq("id", applicationId);
        if (updErr) return json({ error: updErr.message }, 500);

        // Auto-Invite bei positiver KI-Entscheidung.
        let inviteMail: any = undefined;
        if (ended && updates.interview_recommendation === "invite") {
          inviteMail = await sendRegistrationInviteAfterAiAccept(app as any, request);
          if (!inviteMail?.registration_link) {
            const link = await getExistingRegistrationLink(app as any, request);
            if (link) inviteMail = { ...(inviteMail ?? {}), registration_link: link };
          }
          await supabaseAdmin.rpc("advance_application_stage", {
            _application_id: applicationId,
            _to_stage: "vermittlung_zusage",
            _actor_id: null,
            _reason: "ai_interview:invite",
            _force: false,
          } as any).then(() => {}, (e: any) => console.warn("[interview-chat] stage rpc:", e));
        }

        return json({ ok: true, reply, ended, history, application_status: ended ? updates.status : undefined, interview_started_at: updates.interview_started_at ?? app.interview_started_at ?? null, invite_mail: inviteMail, branding: brandingOut, portal_base: portalBaseOut, applicant_email: app.email ?? null });
        } catch (e: any) {
          console.error("[interview-chat] fatal:", e?.stack || e);
          const msg = String(e?.message ?? "");
          const friendly = /upstream_unavailable|empty_ai_response|apinet|gemini|openai|502|503|504|429/i.test(msg)
            ? "Einen Moment bitte — die Verbindung ist gerade kurz überlastet. Versuchen Sie es in ein paar Sekunden noch einmal."
            : "Es ist ein technisches Problem aufgetreten. Bitte laden Sie die Seite neu.";
          return json({ error: friendly, retryable: true }, 503);
        }

      },
    },
  },
});
