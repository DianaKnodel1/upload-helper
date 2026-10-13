import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applyEmploymentStartDate, formatGermanDate, resolveContractPlaceholders } from "@/lib/contract-utils";

function sniffImageKind(bytes: Uint8Array): "png" | "jpg" | null {
  if (bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}

/** Tenant des Vertrags; Fallback: Tenant aus dem Profil des Mitarbeiters. Nie ein fremder Tenant. */
async function resolveContractTenantId(supabaseAdmin: any, contract: { tenant_id: string | null; user_id: string }) {
  if (contract.tenant_id) return contract.tenant_id;
  const { data: prof } = await supabaseAdmin.from("profiles").select("tenant_id").eq("user_id", contract.user_id).maybeSingle();
  return (prof?.tenant_id as string | null) ?? null;
}

function extractSignatureStoragePath(value: string | null): string | null {
  if (!value) return null;
  if (/^data:/i.test(value)) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^signatures\//, "");
  const match = value.match(/\/storage\/v1\/object\/(?:public|sign)\/signatures\/([^?]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function downloadSignatureBytes(supabaseAdmin: any, path: string | null): Promise<{ bytes: Uint8Array; kind: "png" | "jpg" } | null> {
  if (!path) return null;
  let bytes: Uint8Array | null = null;
  const dataMatch = path.match(/^data:image\/[a-z+]+;base64,(.+)$/i);
  if (dataMatch) {
    const bin = atob(dataMatch[1]!);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    const storagePath = extractSignatureStoragePath(path);
    if (storagePath) {
      const { data, error } = await supabaseAdmin.storage.from("signatures").download(storagePath);
      if (error || !data) {
        console.warn("[contract-pdf] Unterschrift nicht ladbar:", storagePath, error?.message);
      } else {
        bytes = new Uint8Array(await data.arrayBuffer());
      }
    }
    if (!bytes && /^https?:\/\//i.test(path)) {
      try {
        const res = await fetch(path);
        if (res.ok) bytes = new Uint8Array(await res.arrayBuffer());
        else console.warn("[contract-pdf] Unterschrift-URL antwortet", res.status);
      } catch (e) {
        console.warn("[contract-pdf] Unterschrift-URL nicht erreichbar", e);
      }
    }
  }
  if (!bytes) return null;
  // Format am Dateiinhalt erkennen, nicht an der Endung (pdf-lib kann nur PNG/JPG).
  const kind = sniffImageKind(bytes);
  if (!kind) {
    console.warn("[contract-pdf] Unterschrift hat kein PNG/JPG-Format");
    return null;
  }
  return { bytes, kind };
}

async function createSignatureSignedUrl(supabaseAdmin: any, value: string | null): Promise<string | null> {
  if (!value) return null;
  const storagePath = extractSignatureStoragePath(value);
  if (storagePath) {
    return (await supabaseAdmin.storage.from("signatures").createSignedUrl(storagePath, 60 * 10)).data?.signedUrl ?? null;
  }
  return /^https?:\/\//i.test(value) ? value : null;
}

export const generateContractPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ contractId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify ownership via RLS-scoped client
    const { data: contract, error: cErr } = await context.supabase
      .from("contracts")
      .select("id, user_id, tenant_id, company_signature_url, generated_content, signed_name, signature_image_url, signed_at, pdf_url")
      .eq("id", data.contractId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!contract) throw new Error("Vertrag nicht gefunden");
    if (contract.user_id !== userId) throw new Error("Kein Zugriff auf diesen Vertrag");

    // Load tenant (admin – we just need company signature & meta)
    const tenantId = await resolveContractTenantId(supabaseAdmin, contract as any);
    const { data: tenant } = tenantId
      ? await supabaseAdmin
          .from("tenants")
          .select("name, company_ceo_name, company_signature_url, company_address, company_city")
          .eq("id", tenantId)
          .maybeSingle()
      : { data: null as any };

    // Snapshot: einmal festgehaltene Firmen-Unterschrift gilt für diesen Vertrag dauerhaft.
    let companySignature: string | null = (contract as any).company_signature_url ?? null;
    if (!companySignature && tenant?.company_signature_url) {
      companySignature = tenant.company_signature_url;
      const patch: { company_signature_url: string; tenant_id?: string } = { company_signature_url: companySignature };
      if (!contract.tenant_id && tenantId) patch.tenant_id = tenantId;
      await supabaseAdmin.from("contracts").update(patch).eq("id", contract.id).is("company_signature_url", null);
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, street, zip_code, city, employment_type, employment_start_date")
      .eq("user_id", contract.user_id)
      .maybeSingle();

    // Build PDF
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28; // A4
    const pageHeight = 841.89;
    const marginX = 50;
    const marginTop = 50;
    const marginBottom = 60;
    const fontSize = 10;
    const lineHeight = 14;
    const maxWidth = pageWidth - marginX * 2;

    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - marginTop;

    const ensureSpace = (needed: number) => {
      if (y - needed < marginBottom) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - marginTop;
      }
    };

    const wrapLine = (text: string, useFont = font, size = fontSize): string[] => {
      if (!text) return [""];
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let current = "";
      for (const w of words) {
        const test = current ? current + " " + w : w;
        if (useFont.widthOfTextAtSize(test, size) > maxWidth) {
          if (current) lines.push(current);
          current = w;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);
      return lines.length ? lines : [""];
    };

    // Sanitize: WinAnsi (Helvetica) can't render some unicode glyphs (e.g. § is fine, but smart quotes/emoji aren't).
    const sanitize = (s: string) =>
      s
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/\u2026/g, "...")
        .replace(/\u00A0/g, " ");

    const drawParagraph = (raw: string, opts: { bold?: boolean; size?: number } = {}) => {
      const useFont = opts.bold ? fontBold : font;
      const size = opts.size ?? fontSize;
      const lh = size + 4;
      const text = sanitize(raw);
      const lines = wrapLine(text, useFont, size);
      for (const line of lines) {
        ensureSpace(lh);
        page.drawText(line, { x: marginX, y, size, font: useFont, color: rgb(0.1, 0.1, 0.1) });
        y -= lh;
      }
    };

    // Render contract content line by line, treating §-headings as bold.
    const [firstName, ...rest] = (profile?.full_name ?? "").split(" ");
    const lastName = rest.join(" ");
    const renderedContent = resolveContractPlaceholders(contract.generated_content || "", {
      firstName,
      lastName,
      address: [profile?.street, profile?.zip_code && profile?.city ? `${profile.zip_code} ${profile.city}` : profile?.city].filter(Boolean).join(", "),
      city: profile?.city ?? tenant?.company_city ?? "",
      employmentType: profile?.employment_type ?? "",
      companyName: tenant?.name ?? "",
      companyCeoName: tenant?.company_ceo_name ?? "",
      companyAddress: tenant?.company_address ?? "",
      startDate: formatGermanDate(profile?.employment_start_date),
    });
    const rawLines = renderedContent.split("\n");
    for (const rawLine of rawLines) {
      const line = rawLine.trimEnd();
      if (line === "") {
        y -= lineHeight / 2;
        continue;
      }
      const isHeading = /^§\s?\d+/.test(line) || /^ARBEITSVERTRAG/i.test(line);
      drawParagraph(line, { bold: isHeading, size: isHeading ? 11 : fontSize });
    }

    // Signature block
    y -= 30;
    ensureSpace(180);
    const sigBlockTop = y;
    page.drawLine({
      start: { x: marginX, y: sigBlockTop },
      end: { x: pageWidth - marginX, y: sigBlockTop },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 20;

    const colWidth = (pageWidth - marginX * 2 - 30) / 2;
    const leftX = marginX;
    const rightX = marginX + colWidth + 30;
    const sigImgHeight = 60;
    const sigY = y - sigImgHeight;

    // Employee signature (left)
    const empSig = await downloadSignatureBytes(supabaseAdmin, contract.signature_image_url);
    if (empSig) {
      try {
        const img = empSig.kind === "jpg" ? await pdf.embedJpg(empSig.bytes) : await pdf.embedPng(empSig.bytes);
        const scale = Math.min(colWidth / img.width, sigImgHeight / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: leftX, y: sigY + (sigImgHeight - h) / 2, width: w, height: h });
      } catch {
        /* ignore */
      }
    }

    // Company signature (right)
    const compSig = await downloadSignatureBytes(supabaseAdmin, companySignature);
    if (compSig) {
      try {
        const img = compSig.kind === "jpg" ? await pdf.embedJpg(compSig.bytes) : await pdf.embedPng(compSig.bytes);
        const scale = Math.min(colWidth / img.width, sigImgHeight / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: rightX, y: sigY + (sigImgHeight - h) / 2, width: w, height: h });
      } catch (e) {
        console.warn("[contract-pdf] Firmen-Unterschrift nicht einbettbar", e);
      }
    } else {
      console.warn("[contract-pdf] Keine Firmen-Unterschrift für Vertrag", contract.id, "Tenant", tenantId);
    }

    y = sigY - 6;
    page.drawLine({ start: { x: leftX, y }, end: { x: leftX + colWidth, y }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
    page.drawLine({ start: { x: rightX, y }, end: { x: rightX + colWidth, y }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
    y -= 14;

    const signedDate = new Date(contract.signed_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    page.drawText(sanitize(contract.signed_name), { x: leftX, y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(sanitize(tenant?.company_ceo_name || tenant?.name || ""), { x: rightX, y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 12;
    page.drawText(`Arbeitnehmer · ${signedDate}`, { x: leftX, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(`Arbeitgeber · ${tenant?.name ?? ""}`, { x: rightX, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });

    y -= 24;
    ensureSpace(14);
    page.drawText("Dieses Dokument wurde digital unterzeichnet und ist rechtsgueltig.", {
      x: marginX,
      y,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pdfBytes = await pdf.save();

    // Upload to documents bucket
    const pdfPath = `${userId}/contract-${contract.id}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("documents")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(upErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("contracts")
      .update({ pdf_url: pdfPath })
      .eq("id", contract.id);
    if (updErr) throw new Error(updErr.message);

    // Signed URL for immediate download
    const { data: signed } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(pdfPath, 60 * 5);

    return { pdfPath, signedUrl: signed?.signedUrl ?? null };
  });

export const getContractSignatureUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ contractId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contract } = await context.supabase
      .from("contracts")
      .select("id, user_id, tenant_id, company_signature_url, signature_image_url, pdf_url")
      .eq("id", data.contractId)
      .maybeSingle();
    if (!contract || contract.user_id !== userId) throw new Error("Kein Zugriff");

    const tenantId = await resolveContractTenantId(supabaseAdmin, contract as any);
    const { data: tenant } = tenantId
      ? await supabaseAdmin.from("tenants").select("company_signature_url").eq("id", tenantId).maybeSingle()
      : { data: null as any };
    const companySignature: string | null = (contract as any).company_signature_url ?? tenant?.company_signature_url ?? null;

    // Als Data-URL ausliefern: signierte Storage-URLs zeigen bei selbst
    // gehostetem Backend teils auf interne Hosts und laden im Browser nicht.
    const toDataUrl = async (value: string | null) => {
      const sig = await downloadSignatureBytes(supabaseAdmin, value);
      if (sig) {
        let bin = "";
        for (let i = 0; i < sig.bytes.length; i += 0x8000) {
          bin += String.fromCharCode(...sig.bytes.subarray(i, i + 0x8000));
        }
        return `data:image/${sig.kind === "jpg" ? "jpeg" : "png"};base64,${btoa(bin)}`;
      }
      return createSignatureSignedUrl(supabaseAdmin, value);
    };

    const employeeUrl = await toDataUrl(contract.signature_image_url);
    const companyUrl = await toDataUrl(companySignature);

    const pdfUrl = contract.pdf_url
      ? (await supabaseAdmin.storage.from("documents").createSignedUrl(contract.pdf_url, 60 * 5)).data?.signedUrl ?? null
      : null;

    return { employeeUrl, companyUrl, pdfUrl };
  });