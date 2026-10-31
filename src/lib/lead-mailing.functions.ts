import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles").select("role").eq("user_id", ctx.userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nicht autorisiert");
}

const mask = (v: string | null | undefined) => (v?.trim() ? `••••••••${v.trim().slice(-4)}` : null);

export const getLeadMailingOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({}).passthrough().parse(i ?? {}))
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data: ss }, { data: tenants }, { data: settings }, { data: imports }] = await Promise.all([
      db.from("system_settings").select("resend_api_key, resend_webhook_secret").eq("id", 1).maybeSingle(),
      db.from("tenants").select("id, name").order("name"),
      db.from("lead_mail_settings").select("*"),
      db.from("lead_imports").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    const statusCounts: Record<string, Record<string, number>> = {};
    for (const t of tenants ?? []) {
      const counts: Record<string, number> = {};
      for (const st of ["pending", "sent", "failed", "bounced", "unsubscribed", "replied"]) {
        const { count } = await db.from("applications").select("id", { count: "exact", head: true })
          .eq("tenant_id", t.id).eq("lead_mail_status", st);
        counts[st] = count ?? 0;
      }
      statusCounts[t.id] = counts;
    }
    return {
      resendKeyMasked: mask(ss?.resend_api_key),
      webhookSecretMasked: mask(ss?.resend_webhook_secret),
      tenants: tenants ?? [],
      settings: settings ?? [],
      imports: imports ?? [],
      statusCounts,
    };
  });

export const saveResendAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    resend_api_key: z.string().trim().regex(/^re_/, "Resend-Schlüssel beginnt mit re_").optional(),
    resend_webhook_secret: z.string().trim().regex(/^whsec_/, "Webhook-Secret beginnt mit whsec_").optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const patch: Record<string, string> = {};
    if (data.resend_api_key) patch.resend_api_key = data.resend_api_key;
    if (data.resend_webhook_secret) patch.resend_webhook_secret = data.resend_webhook_secret;
    if (!Object.keys(patch).length) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("system_settings").update(patch).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SettingsInput = z.object({
  tenant_id: z.string().uuid(),
  active: z.boolean(),
  sender_email: z.string().trim().email().max(200).nullable(),
  sender_name: z.string().trim().max(120).nullable(),
  subject: z.string().trim().max(300).nullable(),
  body: z.string().trim().max(8000).nullable(),
  homepage_url: z.string().trim().url().max(500).nullable(),
  calendly_url: z.string().trim().url().max(500).nullable(),
  daily_limit: z.number().int().min(1).max(2000),
});

export const saveLeadMailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SettingsInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await (context.supabase as any)
      .from("lead_mail_settings").upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ImportInput = z.object({
  tenant_id: z.string().uuid(),
  file_name: z.string().max(300),
  rows: z.array(z.object({
    firstName: z.string().max(120), lastName: z.string().max(120),
    email: z.string().email().max(254), phone: z.string().max(60).nullable(),
  })).min(1).max(5000),
});

export const importLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ImportInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const emails = data.rows.map((r) => r.email.toLowerCase());
    const existing = new Set<string>();
    for (let i = 0; i < emails.length; i += 200) {
      const chunk = emails.slice(i, i + 200);
      const { data: found } = await db.from("applications").select("email").eq("tenant_id", data.tenant_id).in("email", chunk);
      for (const f of found ?? []) existing.add(String(f.email).toLowerCase());
    }
    const fresh = data.rows.filter((r) => !existing.has(r.email.toLowerCase()));
    const { data: imp, error: impErr } = await db.from("lead_imports").insert({
      tenant_id: data.tenant_id, file_name: data.file_name, total: data.rows.length,
      imported: fresh.length, skipped: data.rows.length - fresh.length, created_by: context.userId,
    }).select("id").single();
    if (impErr) throw new Error(impErr.message);
    for (let i = 0; i < fresh.length; i += 200) {
      const batch = fresh.slice(i, i + 200).map((r) => ({
        tenant_id: data.tenant_id,
        email: r.email.toLowerCase(),
        first_name: r.firstName || null,
        last_name: r.lastName || null,
        full_name: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email,
        phone: r.phone,
        source_slug: "indeed",
        lead_source: "indeed",
        lead_mail_status: "pending",
        lead_import_id: imp.id,
        message: "Indeed-Lead (CSV-Import)",
      }));
      const { error } = await db.from("applications").insert(batch);
      if (error) throw new Error(`Import abgebrochen nach ${i} Leads: ${error.message}`);
    }
    return { imported: fresh.length, skipped: data.rows.length - fresh.length };
  });

export const listLeadThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ filter: z.enum(["open", "all"]).default("open"), applicationId: z.string().uuid().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = context.supabase as any;
    if (data.applicationId) {
      const { data: msgs, error } = await db.from("lead_messages").select("*").eq("application_id", data.applicationId).order("created_at");
      if (error) throw new Error(error.message);
      return { messages: msgs ?? [], threads: [] };
    }
    let q = db.from("lead_messages").select("id, application_id, tenant_id, from_email, subject, body_text, handled, created_at")
      .eq("direction", "in").order("created_at", { ascending: false }).limit(300);
    if (data.filter === "open") q = q.eq("handled", false);
    const { data: inbound, error } = await q;
    if (error) throw new Error(error.message);
    const ids = [...new Set((inbound ?? []).map((m: any) => m.application_id).filter(Boolean))];
    const { data: apps } = ids.length
      ? await db.from("applications").select("id, full_name, email, lead_mail_status").in("id", ids)
      : { data: [] };
    const byId = new Map((apps ?? []).map((a: any) => [a.id, a]));
    return { threads: (inbound ?? []).map((m: any) => ({ ...m, application: byId.get(m.application_id) ?? null })), messages: [] };
  });

export const setLeadMessageHandled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ applicationId: z.string().uuid(), handled: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await (context.supabase as any).from("lead_messages")
      .update({ handled: data.handled }).eq("application_id", data.applicationId).eq("direction", "in");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const replyToLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    applicationId: z.string().uuid(), subject: z.string().trim().min(1).max(300), text: z.string().trim().min(1).max(8000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: app } = await db.from("applications").select("id, email, tenant_id, lead_mail_status").eq("id", data.applicationId).maybeSingle();
    if (!app) throw new Error("Bewerbung nicht gefunden");
    if (app.lead_mail_status === "unsubscribed" || app.lead_mail_status === "bounced") throw new Error("Diese Adresse ist abgemeldet oder nicht zustellbar.");
    const { data: s } = await db.from("lead_mail_settings").select("sender_email, sender_name").eq("tenant_id", app.tenant_id).maybeSingle();
    if (!s?.sender_email) throw new Error("Für diese Firma ist keine Absender-Adresse hinterlegt.");
    const { loadResendConfig, sendViaResend } = await import("@/lib/lead-mailing.server");
    const { apiKey } = await loadResendConfig();
    if (!apiKey) throw new Error("Resend-Schlüssel fehlt (Admin → Lead-Mailing).");
    const name = (s.sender_name ?? "").replace(/["<>]/g, "");
    const r = await sendViaResend({
      apiKey, from: name ? `"${name}" <${s.sender_email}>` : s.sender_email, to: app.email,
      subject: data.subject, text: data.text, replyTo: s.sender_email,
    });
    await db.from("lead_messages").insert({
      application_id: app.id, tenant_id: app.tenant_id, direction: "out", from_email: s.sender_email,
      to_email: app.email, subject: data.subject, body_text: data.text, provider_id: r.id || null, handled: true,
    });
    await db.from("lead_messages").update({ handled: true }).eq("application_id", app.id).eq("direction", "in");
    return { ok: true };
  });
