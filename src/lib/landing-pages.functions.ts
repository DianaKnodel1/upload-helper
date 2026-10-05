// CRUD für public.landing_pages.
// Werden vom Admin-UI (/admin/landing-generator) aufgerufen.
// Server 1 (Landing-Renderer) liest direkt mit anon-Key — braucht keine Server-Fn.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const cleanDomain = (s: string) => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
// IP des Portal-Servers (mb-portal / TanStack). Muss synchron zu
// src/routes/admin.tenants.tsx bleiben.
const PORTAL_SERVER_IP = "190.97.167.124";

const BrandingSchema = z.object({
  firmenname: z.string().min(1).max(120),
  primary_color: Hex,
  secondary_color: Hex,
  whatsapp_number: z.string().max(40).default(""),
  whatsapp_enabled: z.boolean().default(false),
  email: z.string().email().max(255),
  telefon: z.string().max(40).default(""),
  telefon_2: z.string().max(40).default(""),
  strasse: z.string().max(200).default(""),
  plz: z.string().max(20).default(""),
  stadt: z.string().max(120).default(""),
  hrb: z.string().max(60).default(""),
  registergericht: z.string().max(120).default(""),
  ust_id: z.string().max(40).default(""),
  steuernummer: z.string().max(40).default(""),
  geschaeftsfuehrer: z.string().max(120).default(""),
  impressum: z.string().max(5000).default(""),
  api_endpoint: z.union([z.literal(""), z.string().url().max(500)]).default(""),
  portal_url: z.string().max(500).default(""),
  // Meta-/Facebook-Pixel (optional, pro Landing Page)
  meta_pixel_id: z.string().max(40).default(""),
  // Optional: kompletter Pixel-Code (überschreibt meta_pixel_id)
  meta_pixel_code: z.string().max(10_000).default(""),
  tenant_id: z.string().max(120).default(""),
  seo_title: z.string().max(320).default(""),
  seo_description: z.string().max(640).default(""),
  seo_image: z.string().max(500).default(""),
  // Portal-Design (nur Fast-Track relevant) — steuert Login/Registrierung im Portal
  portal_theme: z.enum(["clean", "office", "atmosphere"]).default("clean"),
  // Gestaltung der Baukasten-Seite (Farben, Schrift, Rundungen …)
  style: z.record(z.string(), z.any()).default({}),
});

const SaveInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, "Slug nur a-z, 0-9 und -"),
  domain: z.string().min(3).max(255),
  tenant_id: z.string().uuid().nullable().optional(),
  theme_id: z.string().min(1).max(40),
  branding: BrandingSchema,
  slots: z.record(z.string(), z.string().max(20_000)).default({}),
  // Baukasten-Abschnitte (Renderer: landing-server/sections-renderer.js).
  // Wird das Feld nicht mitgeschickt, bleibt der vorhandene Wert unverändert.
  sections: z
    .array(
      z
        .object({
          id: z.string().max(60),
          type: z.string().max(40),
          data: z.record(z.string(), z.any()),
        })
        .passthrough()
    )
    .max(40)
    .nullable()
    .optional(),
  flow_type: z.enum(["classic", "fast", "broker"]).default("classic"),
  source_slug: z.string().max(120).default(""),
  is_published: z.boolean().default(true),
  // Calendly-Integration (optional pro Landing)
  calendly_url: z.string().max(500).default(""),
  intermediate_company_name: z.string().max(160).default(""),
  intermediate_logo_url: z.string().max(500).default(""),
  redirect_delay_ms: z.number().int().min(0).max(60000).default(2500),
  partner_company_id: z.string().uuid().nullable().optional(),
  // Optional: Data-URLs für Logo/Favicon — werden in Storage gelegt
  logo_data_url: z.string().max(15_000_000).nullable().optional(),
  favicon_data_url: z.string().max(1_000_000).nullable().optional(),
  // KI-Bewerbungsgespräch
  interview_mode: z.enum(["chat", "voice", "both"]).default("chat"),
  interview_voice_id: z.string().max(80).nullable().optional(),
  interview_system_prompt: z.string().max(8000).nullable().optional(),
  linked_fasttrack_landing_id: z.string().uuid().nullable().optional(),
  recruiter_name: z.string().max(120).nullable().optional(),
  recruiter_avatar_url: z.string().max(500).nullable().optional(),
  recruiter_avatar_data_url: z.string().max(8_000_000).nullable().optional(),
  // Termin-Buchungssystem pro Landing Page
  booking_mode: z.enum(["calendly", "internal"]).default("calendly"),
  event_description: z.string().max(4000).nullable().optional(),
  booking_window_days: z.number().int().min(1).max(180).default(30),
});

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nicht autorisiert");
}

function parseDataUrl(dataUrl: string): { mime: string; ext: string; bytes: Uint8Array } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const ext = mime.includes("svg") ? "svg" : mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : mime.includes("ico") ? "ico" : "png";
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime, ext, bytes };
}

function portalDomainFromUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const hostname = new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.toLowerCase();
    return hostname.replace(/^portal\./, "") || null;
  } catch {
    return null;
  }
}

async function uploadAsset(supabaseAdmin: any, slug: string, kind: "logo" | "favicon", dataUrl: string): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const path = `${slug}/${kind}.${parsed.ext}`;
  const { error } = await supabaseAdmin.storage.from("landing-assets").upload(path, parsed.bytes, {
    contentType: parsed.mime,
    upsert: true,
  });
  if (error) throw new Error(`Storage-Upload (${kind}) fehlgeschlagen: ${error.message}`);
  const { data } = supabaseAdmin.storage.from("landing-assets").getPublicUrl(path);
  return data.publicUrl;
}

export const listLandingPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("landing_pages")
      .select("id, slug, domain, tenant_id, theme_id, flow_type, source_slug, is_published, logo_url, created_at, updated_at, branding, sections, linked_fasttrack_landing_id, partner_company_id, calendly_url, booking_mode")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const getLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: row, error } = await context.supabase
      .from("landing_pages")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Landing nicht gefunden");
    return row;
  });

export const saveLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    const slug = data.slug.toLowerCase();
    const domain = cleanDomain(data.domain);

    // Upload Logo/Favicon (nutzt service-role wegen Bucket-Privacy)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let logo_url: string | undefined;
    let favicon_url: string | undefined;
    if (data.logo_data_url) logo_url = (await uploadAsset(supabaseAdmin, slug, "logo", data.logo_data_url)) ?? undefined;
    if (data.favicon_data_url) favicon_url = (await uploadAsset(supabaseAdmin, slug, "favicon", data.favicon_data_url)) ?? undefined;

    const recruiterName = data.recruiter_name?.trim() || null;
    const payload: any = {
      slug,
      domain,
      tenant_id: data.tenant_id || null,
      theme_id: data.theme_id,
      branding: {
        ...data.branding,
        recruiter_name: recruiterName,
      },
      slots: data.slots,
      ...(data.sections !== undefined ? { sections: data.sections } : {}),
      flow_type: data.flow_type,
      source_slug: data.source_slug || null,
      is_published: data.is_published,
      calendly_url: data.calendly_url || null,
      intermediate_company_name: data.intermediate_company_name || null,
      intermediate_logo_url: data.intermediate_logo_url || null,
      redirect_delay_ms: data.redirect_delay_ms ?? 2500,
      partner_company_id: data.partner_company_id ?? null,
      interview_mode: data.interview_mode ?? "chat",
      interview_voice_id: data.interview_voice_id ?? null,
      interview_system_prompt: data.interview_system_prompt ?? null,
      linked_fasttrack_landing_id: data.linked_fasttrack_landing_id ?? null,
      booking_mode: data.booking_mode ?? "calendly",
      event_description: data.event_description ?? null,
      booking_window_days: data.booking_window_days ?? 30,
    };
    if (logo_url) payload.logo_url = logo_url;
    if (favicon_url) payload.favicon_url = favicon_url;

    // Recruiter-Avatar: entweder neue Data-URL hochladen, oder bestehende URL übernehmen.
    if (data.recruiter_avatar_data_url) {
      const parsed = parseDataUrl(data.recruiter_avatar_data_url);
      if (parsed) {
        const path = `${slug}/recruiter.${parsed.ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("recruiter-avatars")
          .upload(path, parsed.bytes, { contentType: parsed.mime, upsert: true });
        if (upErr) throw new Error(`Recruiter-Avatar Upload: ${upErr.message}`);
        const { data: pub } = supabaseAdmin.storage.from("recruiter-avatars").getPublicUrl(path);
        payload.recruiter_avatar_url = pub.publicUrl;
        payload.branding.recruiter_avatar_url = pub.publicUrl;
      }
    } else if (data.recruiter_avatar_url !== undefined) {
      payload.recruiter_avatar_url = data.recruiter_avatar_url || null;
      payload.branding.recruiter_avatar_url = data.recruiter_avatar_url || null;
    }

    // ── Server-Pool: least-full Auswahl, nur bei Neu-Anlage
    let assignedServer: { id: string; name: string; ip: string } | null = null;
    if (!data.id) {
      const { data: pool } = await context.supabase
        .from("landing_servers")
        .select("id, name, ip, landing_count, capacity, status")
        .in("status", ["online", "pending"])
        .order("landing_count", { ascending: true });
      const free = (pool ?? []).find((s: any) => s.landing_count < s.capacity);
      if (free) {
        payload.server_id = free.id;
        assignedServer = { id: free.id, name: free.name, ip: String(free.ip) };
      }
    }

    let row: any;
    if (data.id) {
      const { data: updated, error } = await context.supabase
        .from("landing_pages")
        .update(payload)
        .eq("id", data.id)
        .select("*, landing_servers(id, name, ip)")
        .single();
      if (error) throw new Error(error.message);
      row = updated;
      if (updated?.landing_servers) {
        assignedServer = { id: updated.landing_servers.id, name: updated.landing_servers.name, ip: String(updated.landing_servers.ip) };
      }
    } else {
      const { data: inserted, error } = await context.supabase
        .from("landing_pages")
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      row = inserted;
    }

    // Login und Registrierung gehören zur Landing: Die im Generator gepflegten
    // Marken- und Kontaktdaten werden deshalb auf das ausgewählte Unternehmen
    // übertragen. So kann das Portal anhand seiner Domain dieselben Angaben laden.
    if (data.tenant_id) {
      const portalDomain = portalDomainFromUrl(data.branding.portal_url ?? "");
      const { data: tenantRow, error: tenantReadError } = await context.supabase
        .from("tenants")
        .select("domain_aliases")
        .eq("id", data.tenant_id)
        .maybeSingle();
      if (tenantReadError) throw new Error(tenantReadError.message);

      const aliases = Array.isArray((tenantRow as any)?.domain_aliases)
        ? ((tenantRow as any).domain_aliases as string[])
        : [];
      const domainAliases = portalDomain
        ? Array.from(new Set([...aliases, portalDomain]))
        : aliases;
      const tenantBranding = {
        name: data.branding.firmenname.trim(),
        company_email: data.branding.email.trim(),
        primary_color: data.branding.primary_color,
        portal_theme: data.branding.portal_theme,
        logo_url: row.logo_url ?? null,
        domain_aliases: domainAliases,
      };
      const { error: tenantUpdateError } = await context.supabase
        .from("tenants")
        .update(tenantBranding as any)
        .eq("id", data.tenant_id);
      if (tenantUpdateError) throw new Error(`Portal-Daten konnten nicht übernommen werden: ${tenantUpdateError.message}`);
    }

    // ── Cloudflare-DNS: wenn passende Zone existiert, A-Record automatisch setzen
    let dnsStatus: "auto" | "manual" | "skipped" | "error" = "manual";
    let dnsMessage: string | undefined;
    if (assignedServer && data.is_published) {
      try {
        const { data: zones } = await context.supabase
          .from("cloudflare_zones")
          .select("id, domain, zone_id, cloudflare_account_id, cloudflare_accounts!inner(api_token, name)")
          .order("domain", { ascending: false });
        const zone = (zones ?? []).find((z: any) => domain === z.domain || domain.endsWith("." + z.domain));
        if (zone) {
          const acc = (zone as any).cloudflare_accounts;
          const token = acc?.api_token?.trim();
          if (!token) {
            dnsStatus = "error";
            dnsMessage = `Cloudflare-API-Token fehlt für Account "${acc?.name ?? "unbekannt"}". Bitte im Admin-Portal hinterlegen.`;
          } else {
            await setCloudflareARecord(token, zone.zone_id, zone.domain, domain, assignedServer.ip);
            await context.supabase.from("landing_pages").update({ cloudflare_zone_id: zone.id }).eq("id", row.id);
            dnsStatus = "auto";
            dnsMessage = `A-Record für ${domain} → ${assignedServer.ip} gesetzt.`;
          }
        } else {
          dnsStatus = "manual";
          dnsMessage = `Keine CF-Zone für "${domain}" — bitte beim Registrar A-Record auf ${assignedServer.ip} setzen.`;
        }
      } catch (e: any) {
        dnsStatus = "error";
        dnsMessage = e?.message ?? String(e);
      }
    } else if (!assignedServer) {
      dnsStatus = "skipped";
      dnsMessage = "Kein Landing-Server im Pool — bitte erst unter /admin/infrastructure registrieren.";
    }

    // ── Portal-DNS: Nur bei Fasttrack-Landings (nicht Vermittlung/Broker
    // oder Classic) automatisch portal.<domain> → Portal-Server-IP setzen.
    // Broker/Vermittlung leiten zu partner.calendly_url und brauchen keinen
    // portal.-Host beim Bewerber-Landing-Registrar.
    let portalDnsStatus: "auto" | "manual" | "skipped" | "error" | null = null;
    let portalDnsMessage: string | undefined;
    let portalHost: string | null = null;
    if (data.flow_type === "fast" && data.is_published) {
      const rawPortal = (data.branding?.portal_url ?? "").trim();
      if (rawPortal) {
        try {
          portalHost = new URL(rawPortal.startsWith("http") ? rawPortal : `https://${rawPortal}`)
            .hostname.toLowerCase();
        } catch { portalHost = null; }
      }
      if (portalHost) {
        try {
          const { data: zones } = await context.supabase
            .from("cloudflare_zones")
            .select("id, domain, zone_id, cloudflare_account_id, cloudflare_accounts!inner(api_token, name)")
            .order("domain", { ascending: false });
          const zone = (zones ?? []).find((z: any) => portalHost === z.domain || portalHost!.endsWith("." + z.domain));
          if (!zone) {
            portalDnsStatus = "manual";
            portalDnsMessage = `Keine CF-Zone für "${portalHost}" — bitte beim Registrar A-Record auf ${PORTAL_SERVER_IP} setzen.`;
          } else {
            const acc = (zone as any).cloudflare_accounts;
            const token = acc?.api_token?.trim();
            if (!token) {
              portalDnsStatus = "error";
              portalDnsMessage = `Cloudflare-API-Token fehlt für Account "${acc?.name ?? "unbekannt"}".`;
            } else {
              await setCloudflareARecord(token, zone.zone_id, zone.domain, portalHost, PORTAL_SERVER_IP);
              portalDnsStatus = "auto";
              portalDnsMessage = `A-Record für ${portalHost} → ${PORTAL_SERVER_IP} gesetzt.`;
            }
          }
        } catch (e: any) {
          portalDnsStatus = "error";
          portalDnsMessage = e?.message ?? String(e);
        }
      }
    }

    // Jede gespeicherte Landing fordert auf dem zugewiesenen Renderer automatisch
    // einen Theme-/server.js-Resync an. Sonst bleiben ältere Remote-Templates
    // sichtbar, obwohl im Generator Theme/Einstellungen geändert wurden.
    const resyncServerId = assignedServer?.id ?? row?.server_id ?? null;
    if (resyncServerId) {
      await context.supabase
        .from("landing_servers")
        .update({ themes_resync_requested_at: new Date().toISOString() })
        .eq("id", resyncServerId);
    }

    await context.supabase.from("automation_log").insert({
      action: data.id ? "landing.updated" : "landing.live",
      target: domain,
      status: (dnsStatus === "error" || portalDnsStatus === "error") ? "warn" : "ok",
      actor_id: context.userId,
      payload: { slug, server: assignedServer?.name ?? null, dns: dnsStatus, dnsMessage, portal_host: portalHost, portal_dns: portalDnsStatus, portal_dns_message: portalDnsMessage },
      error: dnsStatus === "error" ? dnsMessage : (portalDnsStatus === "error" ? portalDnsMessage : null),
    });

    return { ...row, assignedServer, dnsStatus, dnsMessage, portalHost, portalDnsStatus, portalDnsMessage };
  });

// ── Cloudflare-DNS-Helper ─────────────────────────────────────────────────
const CF_API = "https://api.cloudflare.com/client/v4";
function normalizeCloudflareToken(input: string): string {
  const trimmed = (input ?? "").trim();
  const cfatMatch = trimmed.match(/cfat_[A-Za-z0-9_-]+/);
  if (cfatMatch) return cfatMatch[0];
  const legacyMatch = trimmed.match(/^[A-Za-z0-9_-]{30,}$/);
  if (legacyMatch) return trimmed;
  throw new Error("Ungültiges Cloudflare-Token. Bitte Token im Admin-Portal neu speichern.");
}
async function cfReq(token: string, path: string, init: RequestInit = {}): Promise<any> {
  const cleanToken = normalizeCloudflareToken(token);
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${cleanToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    const errors = Array.isArray(json?.errors) ? json.errors : [];
    const msg = errors.map((e: any) => [e?.code, e?.message].filter(Boolean).join(": ")).filter(Boolean).join("; ") || `HTTP ${res.status}`;
    throw new Error(`Cloudflare: ${msg}`);
  }
  return json;
}
async function setCloudflareARecord(token: string, zoneId: string, zoneDomain: string, fullDomain: string, ip: string) {
  const recordName = fullDomain === zoneDomain ? "@" : fullDomain;
  const list = await cfReq(token, `/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(fullDomain)}`);
  const existing = list.result?.[0];
  const body = { type: "A", name: recordName, content: ip, ttl: 1, proxied: true, comment: "managed by mb-portal landing-pool" };
  if (existing) {
    await cfReq(token, `/zones/${zoneId}/dns_records/${existing.id}`, { method: "PUT", body: JSON.stringify(body) });
  } else {
    await cfReq(token, `/zones/${zoneId}/dns_records`, { method: "POST", body: JSON.stringify(body) });
  }
  if (recordName === "@") {
    const wwwName = `www.${zoneDomain}`;
    const wwwList = await cfReq(token, `/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(wwwName)}`);
    const wwwExisting = wwwList.result?.[0];
    const wwwBody = { ...body, name: "www" };
    if (wwwExisting) {
      await cfReq(token, `/zones/${zoneId}/dns_records/${wwwExisting.id}`, { method: "PUT", body: JSON.stringify(wwwBody) });
    } else {
      await cfReq(token, `/zones/${zoneId}/dns_records`, { method: "POST", body: JSON.stringify(wwwBody) });
    }
  }
}

/**
 * Prüft vor dem Löschen, was an der Landing hängt: Buchungskalender und
 * bereits gebuchte Termine. Termine sind in der DB gegen Löschen geschützt.
 */
export const checkLandingPageDeletable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: schedules, error: sErr } = await context.supabase
      .from("availability_schedules")
      .select("id")
      .eq("landing_page_id", data.id);
    if (sErr) throw new Error(sErr.message);
    const ids = (schedules ?? []).map((s: any) => s.id);
    let appointments = 0;
    if (ids.length > 0) {
      const { count, error: aErr } = await (context.supabase as any)
        .from("interview_appointments")
        .select("id", { count: "exact", head: true })
        .in("schedule_id", ids);
      if (aErr) throw new Error(aErr.message);
      appointments = count ?? 0;
    }
    return { schedules: ids.length, appointments };
  });

export const deleteLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    // Der Kalender hängt per CASCADE an der Landing, gebuchte Termine sind aber
    // per RESTRICT geschützt. Deshalb Kalender vorher lösen + deaktivieren:
    // Termine bleiben vollständig erhalten, die Landing kann gelöscht werden.
    const { error: detachErr } = await context.supabase
      .from("availability_schedules")
      .update({ landing_page_id: null, active: false } as any)
      .eq("landing_page_id", data.id);
    if (detachErr) throw new Error(detachErr.message);

    // Verknüpfte Fast-Track-Landings verlieren nur die Zuordnung.
    await (context.supabase as any)
      .from("landing_pages")
      .update({ linked_fasttrack_landing_id: null })
      .eq("linked_fasttrack_landing_id", data.id);

    const { error } = await context.supabase.from("landing_pages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const toggleLandingPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), is_published: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase
      .from("landing_pages")
      .update({ is_published: data.is_published })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
