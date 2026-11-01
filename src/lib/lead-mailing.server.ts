// Serverseitiger Lead-Versand über Resend + Verarbeitung der Resend-Webhooks.
import {
  allowedToSendNow,
  renderLeadTemplate,
  isUnsubscribeReply,
  DEFAULT_LEAD_BODY,
  DEFAULT_LEAD_SUBJECT,
} from "./lead-mailing";

const RESEND_API = "https://api.resend.com";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function loadResendConfig() {
  const db = await admin();
  const { data } = await db.from("system_settings").select("resend_api_key, resend_webhook_secret").eq("id", 1).maybeSingle();
  return {
    apiKey: (data?.resend_api_key as string | null)?.trim() || process.env.RESEND_API_KEY || null,
    webhookSecret: (data?.resend_webhook_secret as string | null)?.trim() || process.env.RESEND_WEBHOOK_SECRET || null,
  };
}

import { renderMail, type MailKind, type MailSignature } from "./mail-template";

/** Signatur einer Firma: eigene Felder aus lead_mail_settings, sonst Firmendaten. */
export async function loadSignature(tenantId: string | null | undefined, senderEmail?: string | null): Promise<MailSignature> {
  if (!tenantId) return { email: senderEmail ?? null };
  const db = await admin();
  const [{ data: t }, { data: s }] = await Promise.all([
    db.from("tenants").select("name, logo_url, primary_color, domain, company_signer_name, company_signer_title, company_ceo_name").eq("id", tenantId).maybeSingle(),
    db.from("lead_mail_settings").select("sender_email, sender_name, sig_name, sig_position, sig_phone, sig_website, sig_color").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  return {
    company: t?.name ?? null,
    name: s?.sig_name || s?.sender_name || t?.company_signer_name || t?.company_ceo_name || null,
    position: s?.sig_position || t?.company_signer_title || null,
    phone: s?.sig_phone || null,
    email: senderEmail ?? s?.sender_email ?? null,
    website: s?.sig_website || t?.domain || null,
    logoUrl: t?.logo_url || null,
    color: s?.sig_color || t?.primary_color || null,
  };
}

export async function sendViaResend(opts: {
  apiKey: string; from: string; to: string; subject: string; text: string; replyTo: string;
  idempotencyKey?: string; kind?: MailKind; signature?: MailSignature;
}): Promise<{ id: string }> {
  const kind = opts.kind ?? "lead";
  const { html, text } = renderMail({ text: opts.text, signature: opts.signature ?? { email: opts.replyTo }, kind, subject: opts.subject });
  const res = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
      ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      reply_to: opts.replyTo,
      subject: opts.subject,
      text,
      html,
      ...(kind === "lead" ? { headers: { "List-Unsubscribe": `<mailto:${opts.replyTo}?subject=Abmelden>` } } : {}),
    }),
  });
  const bodyTxt = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${bodyTxt.slice(0, 300)}`);
  const data = JSON.parse(bodyTxt || "{}");
  return { id: String(data.id ?? "") };
}

export function fromHeader(name: string | null, email: string) {
  const n = (name ?? "").replace(/["<>]/g, "").trim();
  return n ? `"${n}" <${email}>` : email;
}

/** Ein Versandlauf (Cron alle 10 Minuten). */
export async function runLeadMailingCycle(now = new Date()) {
  const db = await admin();
  const { apiKey } = await loadResendConfig();
  if (!apiKey) return { skipped: "no_resend_key" };

  const { data: settings } = await db.from("lead_mail_settings").select("*").eq("active", true);
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const results: any[] = [];

  for (const s of settings ?? []) {
    if (!s.sender_email) continue;
    const { count: sentToday } = await db
      .from("lead_messages").select("id", { count: "exact", head: true })
      .eq("tenant_id", s.tenant_id).eq("direction", "out").gte("created_at", startOfDay.toISOString());
    const allowed = Math.min(25, allowedToSendNow(s.daily_limit, sentToday ?? 0, now));
    if (allowed <= 0) { results.push({ tenant: s.tenant_id, sent: 0 }); continue; }

    const { data: tenant } = await db.from("tenants").select("name").eq("id", s.tenant_id).maybeSingle();
    const { data: leads } = await db
      .from("applications").select("id, email, first_name, last_name, full_name")
      .eq("tenant_id", s.tenant_id).eq("lead_mail_status", "pending")
      .order("created_at", { ascending: true }).limit(allowed);

    const signature = await loadSignature(s.tenant_id, s.sender_email);
    let sent = 0;
    for (const lead of leads ?? []) {
      const vars = {
        Vorname: lead.first_name ?? "", Nachname: lead.last_name ?? "",
        Firma: tenant?.name ?? "", Homepage: s.homepage_url ?? "", Calendly: s.calendly_url ?? "",
        Absender: s.sender_name ?? "",
      };
      const subject = renderLeadTemplate(s.subject || DEFAULT_LEAD_SUBJECT, vars);
      const text = renderLeadTemplate(s.body || DEFAULT_LEAD_BODY, vars);
      try {
        const r = await sendViaResend({
          apiKey, from: fromHeader(s.sender_name, s.sender_email), to: lead.email, subject, text,
          replyTo: s.sender_email, idempotencyKey: `lead-invite-${lead.id}`, kind: "lead", signature,
        });
        await db.from("applications").update({ lead_mail_status: "sent", lead_mail_sent_at: new Date().toISOString(), lead_mail_error: null }).eq("id", lead.id);
        await db.from("lead_messages").insert({
          application_id: lead.id, tenant_id: s.tenant_id, direction: "out", from_email: s.sender_email,
          to_email: lead.email, subject, body_text: text, provider_id: r.id || null, handled: true,
          peer_email: String(lead.email).toLowerCase(), kind: "lead",
        });
        sent++;
      } catch (e: any) {
        const msg = String(e?.message ?? e).slice(0, 500);
        console.warn("[lead-mailing] send failed", lead.id, msg);
        await db.from("applications").update({ lead_mail_status: "failed", lead_mail_error: msg }).eq("id", lead.id);
        if (/Resend 429/.test(msg)) break;
      }
    }
    results.push({ tenant: s.tenant_id, sent });
  }
  return { results };
}

// ───────────── Webhook (Svix-Signatur) ─────────────

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function verifySvixSignature(secret: string, headers: Headers, body: string, nowSec = Math.floor(Date.now() / 1000)) {
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;
  if (Math.abs(nowSec - Number(ts)) > 5 * 60) return false;
  const key = await crypto.subtle.importKey("raw", b64ToBytes(secret.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  let bin = "";
  mac.forEach((b) => (bin += String.fromCharCode(b)));
  const expected = btoa(bin);
  return sigHeader.split(" ").some((part) => {
    const v = part.split(",")[1] ?? "";
    if (v.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < v.length; i++) diff |= v.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

const addrOf = (v: unknown): string => {
  const s = Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
};

export async function handleResendEvent(evt: any) {
  const db = await admin();
  const type: string = evt?.type ?? "";
  const data = evt?.data ?? {};

  if (type === "email.bounced" || type === "email.complained") {
    const to = addrOf(data.to);
    if (!to) return { ignored: true };
    const status = type === "email.bounced" ? "bounced" : "unsubscribed";
    await db.from("applications").update({ lead_mail_status: status, lead_mail_error: type }).ilike("email", to).not("lead_source", "is", null);
    return { updated: status };
  }

  if (type === "email.received") {
    const from = addrOf(data.from);
    const providerId = String(data.email_id ?? data.id ?? "");
    let text: string = data.text ?? "";
    const subject: string = data.subject ?? "";
    if (!text && providerId) {
      const { apiKey } = await loadResendConfig();
      if (apiKey) {
        const r = await fetch(`${RESEND_API}/emails/receiving/${encodeURIComponent(providerId)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
        if (r.ok) {
          const full = await r.json();
          text = full?.text || (full?.html ? String(full.html).replace(/<[^>]+>/g, " ") : "");
        }
      }
    }
    // Zuordnung: zuerst bestehender Verlauf mit dieser Adresse (Mitarbeiter, frei), sonst Lead.
    const { data: prev } = await db
      .from("lead_messages").select("application_id, profile_id, tenant_id, kind")
      .eq("peer_email", from).eq("direction", "out").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const { data: app } = prev
      ? { data: prev.application_id ? { id: prev.application_id, tenant_id: prev.tenant_id } : null }
      : await db.from("applications").select("id, tenant_id").ilike("email", from).not("lead_source", "is", null)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
    await db.from("lead_messages").upsert({
      application_id: app?.id ?? null, profile_id: prev?.profile_id ?? null,
      tenant_id: prev?.tenant_id ?? app?.tenant_id ?? null, direction: "in",
      from_email: from, to_email: addrOf(data.to), subject, body_text: String(text).slice(0, 20000),
      provider_id: providerId || null, handled: false, peer_email: from,
      kind: prev?.kind ?? (app ? "lead" : "other"),
    }, { onConflict: "provider_id,direction", ignoreDuplicates: true });
    if (app?.id && (prev?.kind ?? "lead") === "lead") {
      const status = isUnsubscribeReply(subject, text) ? "unsubscribed" : "replied";
      await db.from("applications").update({ lead_mail_status: status }).eq("id", app.id);
    }
    return { stored: true };
  }
  return { ignored: type };
}
