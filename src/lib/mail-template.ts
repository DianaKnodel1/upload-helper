// Gemeinsames E-Mail-Layout (HTML + Klartext) für alle Portal-Mails:
// Lead-Einladungen, Antworten im Postfach und Mails an Mitarbeiter.

export type MailSignature = {
  company?: string | null;
  name?: string | null;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  color?: string | null;
};

export type MailKind = "lead" | "employee" | "other";

export const LEAD_FOOTER =
  "Sie erhalten diese Nachricht wegen Ihrer Bewerbung. Wenn Sie keine weiteren Nachrichten wünschen, antworten Sie bitte mit „Abmelden“.";

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Nur http(s)-Adressen zulassen; alles andere wird verworfen. */
export function safeUrl(u?: string | null): string | null {
  const v = (u ?? "").trim();
  if (!v) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(v) ? `https://${v}` : "";
  try {
    const url = new URL(withProto);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function safeColor(c?: string | null, fallback = "#1f1b16"): string {
  const v = (c ?? "").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : fallback;
}

const linkify = (escaped: string, color: string) =>
  escaped.replace(/(https?:\/\/[^\s<]+)/g, (m) => `<a href="${m}" style="color:${color}">${m}</a>`);

export function bodyToHtml(text: string, color = "#1f1b16"): string {
  return escapeHtml(text.trim())
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${linkify(p, color).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function signatureText(sig: MailSignature): string {
  const lines = [
    sig.name,
    [sig.position, sig.company].filter(Boolean).join(" · "),
    sig.phone ? `Tel. ${sig.phone}` : null,
    sig.email,
    sig.website,
  ].filter((l): l is string => !!l && !!l.trim());
  return lines.length ? `Mit freundlichen Grüßen\n\n${lines.join("\n")}` : "";
}

export function signatureHtml(sig: MailSignature): string {
  const color = safeColor(sig.color);
  const logo = safeUrl(sig.logoUrl);
  const site = safeUrl(sig.website);
  const rows: string[] = [];
  if (sig.name) rows.push(`<div style="font-weight:700;font-size:15px;color:#1f1b16">${escapeHtml(sig.name)}</div>`);
  const role = [sig.position, sig.company].filter(Boolean).map((v) => escapeHtml(String(v))).join(" · ");
  if (role) rows.push(`<div style="color:#6b6258;font-size:13px;margin-bottom:6px">${role}</div>`);
  if (sig.phone) rows.push(`<div style="font-size:13px;color:#3d362f">Tel. ${escapeHtml(sig.phone)}</div>`);
  if (sig.email) rows.push(`<div style="font-size:13px"><a href="mailto:${escapeHtml(sig.email)}" style="color:${color};text-decoration:none">${escapeHtml(sig.email)}</a></div>`);
  if (site) rows.push(`<div style="font-size:13px"><a href="${escapeHtml(site)}" style="color:${color};text-decoration:none">${escapeHtml(sig.website!.replace(/^https?:\/\//, ""))}</a></div>`);
  if (!rows.length) return "";
  const logoCell = logo
    ? `<td style="padding-right:16px;vertical-align:top"><img src="${escapeHtml(logo)}" alt="" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:contain;border-radius:12px"></td>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:2px solid ${color};padding-top:14px"><tr>${logoCell}<td style="vertical-align:top;padding-top:14px;font-family:Arial,Helvetica,sans-serif">${rows.join("")}</td></tr></table>`;
}

export function renderMail(opts: { text: string; signature: MailSignature; kind: MailKind; subject?: string }) {
  const color = safeColor(opts.signature.color);
  const sigTxt = signatureText(opts.signature);
  const footer = opts.kind === "lead" ? LEAD_FOOTER : "";
  const text = [opts.text.trim(), sigTxt, footer ? `—\n${footer}` : ""].filter(Boolean).join("\n\n");
  const logo = safeUrl(opts.signature.logoUrl);
  const header = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(opts.signature.company ?? "")}" height="36" style="display:block;height:36px;max-width:180px;object-fit:contain">`
    : opts.signature.company
      ? `<div style="font-weight:700;font-size:16px;color:${color}">${escapeHtml(opts.signature.company)}</div>`
      : "";
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(opts.subject ?? "")}</title></head>
<body style="margin:0;padding:0;background:#f4f1ec">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8e2d9">
${header ? `<tr><td style="padding:22px 28px;border-bottom:1px solid #efe9e0">${header}</td></tr>` : ""}
<tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2a241e">${bodyToHtml(opts.text, color)}${signatureHtml(opts.signature)}</td></tr>
</table>
${footer ? `<p style="max-width:600px;margin:14px auto 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#8a8076">${escapeHtml(footer)}</p>` : ""}
</td></tr></table></body></html>`;
  return { html, text };
}

export const MAIL_TEMPLATES = [
  {
    id: "melden",
    label: "Bitte melden Sie sich",
    subject: "Bitte melden Sie sich bei uns",
    body: "Guten Tag {Vorname},\n\nwir haben Sie leider nicht erreicht und würden gern kurz mit Ihnen sprechen. Bitte melden Sie sich bei uns im Portal oder antworten Sie direkt auf diese E-Mail.\n\nVielen Dank!",
  },
  {
    id: "auftrag",
    label: "Neuer Auftrag wartet",
    subject: "Ein neuer Auftrag wartet auf Sie",
    body: "Guten Tag {Vorname},\n\nin Ihrem Portal wartet ein neuer Auftrag auf Sie. Bitte melden Sie sich an und schauen Sie ihn sich an.\n\nBei Fragen antworten Sie einfach auf diese E-Mail.",
  },
] as const;
