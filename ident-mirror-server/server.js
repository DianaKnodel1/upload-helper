/**
 * Ident-Mirror-Server
 * -------------------------------------------------------------------------
 * - Hoert auf 127.0.0.1:PORT (default 3003), Caddy macht TLS + Reverse-Proxy.
 * - Spiegelt Ident-Strecken (WebID, POSTIDENT) unter der Mirror-Domain und
 *   blendet je Vorgang einen Hinweis ein.
 * - Tunnel-Links:  https://<mirror>/t/<vorgang>/<originaler-pfad>?<query>
 * - Admin-Panel:   /admin/  (passwortgeschuetzt, Session-Cookie)
 * - Konfiguration: CONFIG_PATH (default ./config.json) — Vorgaenge, Texte,
 *   Firmenname, oeffentliche Mirror-URL, Admin-Passwort-Hash, Session-Schluessel.
 *
 * Endpunkte:
 *   GET  /_health                     → "ok"
 *   GET  /robots.txt                  → Disallow: /
 *   GET  /admin/                      → Admin-Panel (HTML)
 *   POST /_admin/api/login            → {password} → Session-Cookie
 *   POST /_admin/api/logout
 *   POST /_admin/api/setup-password   → nur solange kein Passwort gesetzt
 *   GET  /_admin/api/config           → Konfiguration (ohne Geheimnisse)
 *   POST /_admin/api/config           → Konfiguration speichern
 *   POST /_admin/api/password         → Passwort aendern {current, next}
 *   *    /t/<vorgang>/*               → Mirror
 */

import { createServer } from "node:http";
import { Readable } from "node:stream";
import { readFileSync, writeFileSync, renameSync, existsSync, statSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scryptSync, randomBytes, createHmac, timingSafeEqual } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3003);
const CONFIG_PATH = process.env.CONFIG_PATH || join(__dirname, "config.json");
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 h
const RATE_LIMIT_MAX = 240;
const RATE_LIMIT_WINDOW_MS = 60_000;

// ── Provider ──────────────────────────────────────────────────────────────
const PROVIDERS = {
  webid: { origin: "https://webid-gateway.de", label: "WebID" },
  postident: { origin: "https://postident.deutschepost.de", label: "POSTIDENT" },
};

// ── Konfiguration ─────────────────────────────────────────────────────────
function defaultConfig() {
  return {
    company_name: "Ident-Mirror",
    public_url: "",
    admin_password_hash: "",
    session_secret: randomBytes(32).toString("hex"),
    procedures: [],
  };
}

let configCache = { mtimeMs: -1, data: null };

function loadConfig() {
  try {
    const st = statSync(CONFIG_PATH);
    if (configCache.data && configCache.mtimeMs === st.mtimeMs) return configCache.data;
    const data = { ...defaultConfig(), ...JSON.parse(readFileSync(CONFIG_PATH, "utf8")) };
    if (!data.session_secret) data.session_secret = randomBytes(32).toString("hex");
    configCache = { mtimeMs: st.mtimeMs, data };
    return data;
  } catch {
    if (!configCache.data) configCache = { mtimeMs: -1, data: defaultConfig() };
    return configCache.data;
  }
}

function saveConfig(patch) {
  const current = loadConfig();
  const next = { ...current, ...patch, session_secret: current.session_secret };
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  const tmp = CONFIG_PATH + ".tmp";
  writeFileSync(tmp, JSON.stringify(next, null, 2));
  renameSync(tmp, CONFIG_PATH);
  configCache = { mtimeMs: statSync(CONFIG_PATH).mtimeMs, data: next };
  return next;
}

// ── Passwort / Session ────────────────────────────────────────────────────
function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(pw, stored) {
  try {
    const [scheme, salt, hash] = String(stored || "").split(":");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const candidate = scryptSync(pw, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

function signToken(secret, ts) {
  return createHmac("sha256", secret).update(`admin:${ts}`).digest("hex");
}

function makeSessionCookie(secret) {
  const ts = Date.now().toString();
  return `${ts}.${signToken(secret, ts)}`;
}

function checkSession(cookieHeader, secret) {
  if (!cookieHeader) return false;
  const m = /(?:^|;\s*)im_session=([0-9]+)\.([a-f0-9]{64})/.exec(cookieHeader);
  if (!m) return false;
  const ts = Number(m[1]);
  if (!ts || Date.now() - ts > SESSION_TTL_MS) return false;
  const expected = Buffer.from(signToken(secret, m[1]), "hex");
  const given = Buffer.from(m[2], "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ── Rate-Limit ────────────────────────────────────────────────────────────
const rateBuckets = new Map();
function checkRate(ip) {
  const now = Date.now();
  const b = rateBuckets.get(ip);
  if (!b || b.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  b.count++;
  return b.count <= RATE_LIMIT_MAX;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function findProcedure(cfg, key) {
  return (cfg.procedures || []).find((p) => p.key === key) || null;
}
function publicBase(req, cfg) {
  if (cfg.public_url) return cfg.public_url.replace(/\/+$/, "");
  const host = (req.headers.get("host") || "localhost").split(":")[0];
  return `https://${host}`;
}

// ── Hinweis-Overlay ───────────────────────────────────────────────────────
const OVERLAY_CSS = `
#__im_topbar{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:2147483647!important;
  background:#111!important;color:#fff!important;font:600 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;
  padding:8px 14px!important;text-align:center!important;letter-spacing:.02em!important;
  box-shadow:0 2px 8px rgba(0,0,0,.25)!important;}
body.__im_shifted{padding-top:40px!important;}
#__im_backdrop{position:fixed!important;inset:0!important;z-index:2147483646!important;
  background:rgba(10,15,25,.78)!important;display:flex!important;align-items:center!important;
  justify-content:center!important;padding:20px!important;
  font:400 14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;}
#__im_modal{background:#fff!important;color:#111!important;max-width:520px!important;width:100%!important;
  border-radius:14px!important;padding:28px!important;box-shadow:0 20px 60px rgba(0,0,0,.4)!important;}
#__im_modal h2{margin:0 0 10px!important;font-size:20px!important;font-weight:700!important;color:#111!important;}
#__im_modal p{margin:0 0 12px!important;color:#222!important;white-space:pre-line!important;}
#__im_modal .im-meta{margin:0 0 12px!important;font-size:12px!important;color:#666!important;}
#__im_modal button{margin-top:8px!important;background:#0a66c2!important;color:#fff!important;border:0!important;
  border-radius:8px!important;padding:10px 18px!important;font-weight:600!important;cursor:pointer!important;}
`;

function buildOverlay(cfg, proc) {
  const provider = PROVIDERS[proc.provider] || PROVIDERS.webid;
  const topbarText = `${cfg.company_name || "Ident-Mirror"} · Testumgebung · ${proc.label} (${provider.label})`;
  const topbarEl = `<div id="__im_topbar" role="note"><span>${escapeHtml(topbarText)}</span></div>`;
  const metaLine = proc.meta ? `<p class="im-meta">${escapeHtml(proc.meta)}</p>` : "";
  const modalEl = `<div id="__im_backdrop" role="dialog" aria-modal="true">
    <div id="__im_modal">
      <h2>${escapeHtml(proc.title || "Hinweis für diesen Vorgang")}</h2>
      <p>${escapeHtml(proc.text || "")}</p>
      ${metaLine}
      <button type="button" onclick="var b=document.getElementById('__im_backdrop');if(b)b.remove();try{sessionStorage.setItem('__im_ack','1')}catch(e){}">Verstanden – weiter</button>
    </div>
  </div>`;
  const style = `<style id="__im_style">${OVERLAY_CSS}</style>`;
  const script = `<script>(function(){
    try{document.title='${escapeHtml(proc.label)} · '+document.title;}catch(e){}
    function boot(){
      try{document.body.classList.add('__im_shifted');}catch(e){}
      var ack=false;try{ack=sessionStorage.getItem('__im_ack')==='1'}catch(e){}
      if(ack){var b=document.getElementById('__im_backdrop');if(b)b.remove();}
    }
    if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',boot);}else{boot();}
  })();</script>`;
  return `${style}${topbarEl}${modalEl}${script}`;
}

function rewriteHtml(html, proc, targetHost, mirrorPrefix) {
  const re = new RegExp(`https?://${escapeReg(targetHost)}`, "gi");
  let out = html.replace(re, mirrorPrefix);
  const overlay = buildOverlay(loadConfig(), proc);
  if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${overlay}</body>`);
  else out += overlay;
  return out;
}

function rewriteCss(css, targetHost, mirrorPrefix) {
  return css.replace(new RegExp(`https?://${escapeReg(targetHost)}`, "gi"), mirrorPrefix);
}

function copySetCookie(upstream, target, targetHost) {
  const anyH = upstream.headers;
  const cookies = typeof anyH.getSetCookie === "function" ? anyH.getSetCookie() : [];
  for (const c of cookies) {
    target.append("set-cookie", c.replace(new RegExp(`Domain=\\.?${escapeReg(targetHost)}`, "gi"), ""));
  }
}

// ── Admin-API ─────────────────────────────────────────────────────────────
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "x-robots-tag": "noindex, nofollow", ...headers },
  });
}

function requireAdmin(req, cfg) {
  if (!cfg.admin_password_hash) return { ok: false, res: json({ error: "no_password_set" }, 403) };
  if (!checkSession(req.headers.get("cookie") || "", cfg.session_secret)) {
    return { ok: false, res: json({ error: "unauthorized" }, 401) };
  }
  return { ok: true };
}

const PROC_KEY_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;

function sanitizeProcedure(p) {
  const key = String(p.key || "").toLowerCase().trim();
  if (!PROC_KEY_RE.test(key)) return { error: `Ungültiger Schlüssel: ${key || "(leer)"}` };
  const provider = p.provider === "postident" ? "postident" : "webid";
  return {
    value: {
      key,
      label: String(p.label || key).slice(0, 80),
      provider,
      title: String(p.title || "").slice(0, 200),
      text: String(p.text || "").slice(0, 4000),
      meta: String(p.meta || "").slice(0, 300),
      allow_submit: !!p.allow_submit,
    },
  };
}

async function handleAdminApi(req, url) {
  const cfg = loadConfig();
  const path = url.pathname;

  if (path === "/_admin/api/login" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (!cfg.admin_password_hash) return json({ ok: false, error: "no_password_set" }, 403);
    if (!verifyPassword(String(body.password || ""), cfg.admin_password_hash)) {
      return json({ ok: false }, 401);
    }
    const cookie = `im_session=${makeSessionCookie(cfg.session_secret)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`;
    return json({ ok: true }, 200, { "set-cookie": cookie });
  }

  if (path === "/_admin/api/setup-password" && req.method === "POST") {
    if (cfg.admin_password_hash) return json({ ok: false, error: "already_set" }, 403);
    const body = await req.json().catch(() => ({}));
    const pw = String(body.password || "");
    if (pw.length < 8) return json({ ok: false, error: "min_8" }, 400);
    const next = saveConfig({ admin_password_hash: hashPassword(pw) });
    const cookie = `im_session=${makeSessionCookie(next.session_secret)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`;
    return json({ ok: true }, 200, { "set-cookie": cookie });
  }

  if (path === "/_admin/api/logout" && req.method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": "im_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
  }

  const auth = requireAdmin(req, cfg);
  if (!auth.ok) return auth.res;

  if (path === "/_admin/api/config" && req.method === "GET") {
    return json({
      company_name: cfg.company_name,
      public_url: cfg.public_url,
      password_set: !!cfg.admin_password_hash,
      procedures: cfg.procedures || [],
    });
  }

  if (path === "/_admin/api/config" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const patch = {};
    if (typeof body.company_name === "string") patch.company_name = body.company_name.slice(0, 80) || "Ident-Mirror";
    if (typeof body.public_url === "string") patch.public_url = body.public_url.trim().replace(/\/+$/, "").slice(0, 200);
    if (Array.isArray(body.procedures)) {
      const procs = [];
      const seen = new Set();
      for (const raw of body.procedures.slice(0, 50)) {
        const { value, error } = sanitizeProcedure(raw || {});
        if (error) return json({ ok: false, error }, 400);
        if (seen.has(value.key)) return json({ ok: false, error: `Schlüssel doppelt: ${value.key}` }, 400);
        seen.add(value.key);
        procs.push(value);
      }
      patch.procedures = procs;
    }
    saveConfig(patch);
    return json({ ok: true });
  }

  if (path === "/_admin/api/password" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (!verifyPassword(String(body.current || ""), cfg.admin_password_hash)) {
      return json({ ok: false, error: "wrong_password" }, 403);
    }
    const next = String(body.next || "");
    if (next.length < 8) return json({ ok: false, error: "min_8" }, 400);
    saveConfig({ admin_password_hash: hashPassword(next) });
    return json({ ok: true });
  }

  return json({ error: "not_found" }, 404);
}

// ── Admin-Panel (statisch) ────────────────────────────────────────────────
function serveAdminHtml() {
  const file = join(__dirname, "admin", "index.html");
  if (!existsSync(file)) return new Response("admin/index.html fehlt", { status: 500 });
  return new Response(readFileSync(file, "utf8"), {
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, nofollow", "cache-control": "no-store" },
  });
}

// ── Mirror ────────────────────────────────────────────────────────────────
async function handleMirror(req, url) {
  const cfg = loadConfig();
  const m = /^\/t\/([a-z0-9-]+)(\/.*)?$/.exec(url.pathname);
  if (!m) {
    return new Response(renderLanding(cfg), { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, nofollow" } });
  }
  const proc = findProcedure(cfg, m[1]);
  if (!proc) return new Response("Unbekannter Vorgang.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const provider = PROVIDERS[proc.provider] || PROVIDERS.webid;
  const rest = m[2] || "/";

  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && !(proc.allow_submit && method === "POST")) {
    return blockedResponse(cfg, proc);
  }

  const targetUrl = new URL(rest + url.search, provider.origin);
  const targetHost = new URL(provider.origin).host;
  const mirrorPrefix = `${publicBase(req, cfg)}/t/${proc.key}`;

  const outHeaders = new Headers();
  outHeaders.set("host", targetHost);
  outHeaders.set("user-agent", req.headers.get("user-agent") || "Mozilla/5.0");
  for (const h of ["accept", "accept-language", "accept-encoding", "cookie", "referer", "content-type"]) {
    const v = req.headers.get(h);
    if (v) outHeaders.set(h, h === "referer" ? v.replace(new RegExp(escapeReg(mirrorPrefix), "gi"), provider.origin) : v);
  }

  const hasBody = method !== "GET" && method !== "HEAD";
  let reqBody;
  if (hasBody) {
    try { reqBody = await req.arrayBuffer(); } catch { reqBody = undefined; }
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers: outHeaders,
      body: reqBody && reqBody.byteLength > 0 ? reqBody : undefined,
      redirect: "manual",
    });
  } catch (err) {
    console.warn(`[ident-mirror] upstream fail ${targetUrl}: ${err.message}`);
    return new Response("Gegenstelle vorübergehend nicht erreichbar.", { status: 502 });
  }

  console.log(`[ident-mirror] ${method} /t/${proc.key}${rest} -> ${upstream.status}`);

  if (upstream.status >= 300 && upstream.status < 400) {
    const loc = upstream.headers.get("location");
    if (loc) {
      const h = new Headers();
      h.set("location", loc.replace(new RegExp(`https?://${escapeReg(targetHost)}`, "gi"), mirrorPrefix));
      h.set("x-robots-tag", "noindex, nofollow");
      copySetCookie(upstream, h, targetHost);
      return new Response(null, { status: upstream.status, headers: h });
    }
  }

  const resHeaders = new Headers();
  const stripped = new Set(["content-security-policy", "content-security-policy-report-only", "strict-transport-security", "x-frame-options", "content-length", "content-encoding", "transfer-encoding"]);
  upstream.headers.forEach((v, k) => { if (!stripped.has(k.toLowerCase())) resHeaders.set(k, v); });
  resHeaders.set("content-security-policy", "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; img-src * data: blob:; style-src * 'unsafe-inline'; script-src * 'unsafe-inline' 'unsafe-eval';");
  resHeaders.set("x-robots-tag", "noindex, nofollow");
  copySetCookie(upstream, resHeaders, targetHost);

  const ct = upstream.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    const out = rewriteHtml(await upstream.text(), proc, targetHost, mirrorPrefix);
    resHeaders.set("content-type", ct);
    return new Response(out, { status: upstream.status, headers: resHeaders });
  }
  if (ct.includes("text/css")) {
    const out = rewriteCss(await upstream.text(), targetHost, mirrorPrefix);
    resHeaders.set("content-type", ct);
    return new Response(out, { status: upstream.status, headers: resHeaders });
  }
  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}

function renderLanding(cfg) {
  const procs = (cfg.procedures || [])
    .map((p) => `<li><strong>${escapeHtml(p.label)}</strong> <span class="badge">${escapeHtml((PROVIDERS[p.provider] || {}).label || p.provider)}</span><br><span class="muted">Link im Admin-Panel unter „Tunnel" erzeugen.</span></li>`)
    .join("");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow"><title>${escapeHtml(cfg.company_name)}</title>
    <style>body{margin:0;background:#0b0d12;color:#e8eaf0;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
    .card{max-width:560px;width:100%;background:#14171f;border:1px solid #232838;border-radius:14px;padding:32px}
    h1{margin:0 0 6px;font-size:22px}p.muted,.muted{color:#9aa3b2}ul{padding-left:18px}.badge{background:#123;border:1px solid #2b5d8a;color:#7cc0ff;border-radius:6px;padding:1px 8px;font-size:12px}
    a{color:#7cc0ff}</style></head>
    <body><div class="card"><h1>${escapeHtml(cfg.company_name)}</h1>
    <p class="muted">Testumgebung für Ident-Verfahren. Tunnel-Links werden im Admin-Panel erzeugt.</p>
    ${procs ? `<ul>${procs}</ul>` : `<p class="muted">Noch keine Vorgänge angelegt.</p>`}
    <p><a href="/admin/">Zum Admin-Panel</a></p></div></body></html>`;
}

function blockedResponse(cfg, proc) {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow"><title>Aktion nicht freigegeben</title>
    <style>body{margin:0;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0b1220;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
    .card{max-width:520px;background:#fff;color:#111;border-radius:14px;padding:32px}h1{margin:0 0 10px;font-size:22px}p{margin:0 0 12px;color:#333}</style></head>
    <body><div class="card"><h1>Aktion nicht freigegeben</h1>
    <p>Diese verbindliche Aktion ist für den Vorgang <strong>${escapeHtml(proc.label)}</strong> nicht freigeschaltet.</p>
    <p>Freigabe erteilt der Betreiber (${escapeHtml(cfg.company_name)}) im Admin-Panel.</p></div></body></html>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, nofollow" } });
}

// ── Router ────────────────────────────────────────────────────────────────
async function handle(req) {
  const url = new URL(req.url);
  if (url.pathname === "/_health") return new Response("ok", { headers: { "content-type": "text/plain" } });
  if (url.pathname === "/robots.txt") {
    return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain", "x-robots-tag": "noindex, nofollow" } });
  }
  if (url.pathname === "/admin") {
    return new Response(null, { status: 302, headers: { location: "/admin/" } });
  }
  if (url.pathname === "/admin/") return serveAdminHtml();
  if (url.pathname.startsWith("/_admin/api/")) return handleAdminApi(req, url);

  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRate(ip)) return new Response("Too Many Requests", { status: 429 });

  return handleMirror(req, url);
}

// ── Node-Adapter ──────────────────────────────────────────────────────────
function toWebRequest(req) {
  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else if (value !== undefined) headers.set(name, value);
  }
  const method = req.method || "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  return new Request(`http://${host}${req.url || "/"}`, {
    method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    ...(hasBody ? { duplex: "half" } : {}),
  });
}

async function sendWebResponse(response, res) {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  if (!response.body) return res.end();
  Readable.fromWeb(response.body).pipe(res);
}

const server = createServer(async (incoming, outgoing) => {
  try {
    await sendWebResponse(await handle(toWebRequest(incoming)), outgoing);
  } catch (err) {
    console.error("[ident-mirror] handler error", err);
    if (!outgoing.headersSent) outgoing.writeHead(500, { "content-type": "text/plain" });
    outgoing.end("Internal error");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[ident-mirror] listening on 127.0.0.1:${PORT}, config: ${CONFIG_PATH}`);
});
