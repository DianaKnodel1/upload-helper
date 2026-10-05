// KI-Anbindung für den Landing-Baukasten (Texte, Design, Bilder).
// Nutzt dieselben Zugangsdaten wie der Support-Chat: system_settings
// (apinet.cloud bevorzugt, sonst Google Gemini). Nur serverseitig.

const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const APINET_BASE = "https://apinet.cloud";
const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";
const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";

type Creds = {
  apiKey: string;
  model: string;
  base: string;
  provider: "apinet" | "gemini";
};

export async function loadAiCreds(): Promise<Creds> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("gemini_api_key, gemini_model, apinet_api_key, apinet_model")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`system_settings: ${error.message}`);
  const row = (data ?? {}) as Record<string, string | null>;
  const apinetKey = row.apinet_api_key?.trim();
  const geminiKey = row.gemini_api_key?.trim();
  if (apinetKey) {
    return { apiKey: apinetKey, model: row.apinet_model?.trim() || DEFAULT_TEXT_MODEL, base: APINET_BASE, provider: "apinet" };
  }
  if (geminiKey) {
    return { apiKey: geminiKey, model: row.gemini_model?.trim() || DEFAULT_TEXT_MODEL, base: GEMINI_BASE, provider: "gemini" };
  }
  throw new Error("Es sind keine KI-Zugangsdaten hinterlegt (Admin → KI-Einstellungen).");
}

function headersFor(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
    Authorization: `Bearer ${apiKey}`,
  };
}

/** Ruft das Textmodell auf und erzwingt eine JSON-Antwort. */
export async function callAiJson(systemPrompt: string, userPrompt: string): Promise<any> {
  const { apiKey, model, base } = await loadAiCreds();
  const url = `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: headersFor(apiKey),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      system_instruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
    }),
  });
  if (!res.ok) {
    throw new Error(`KI-Anfrage fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: any) => p?.text ?? "").join("") : "";
  if (!text.trim()) throw new Error("Die KI hat keine Antwort geliefert. Bitte erneut versuchen.");
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = /[{[][\s\S]*[}\]]/.exec(cleaned);
    if (m) return JSON.parse(m[0]);
    throw new Error("Die KI-Antwort war nicht lesbar. Bitte erneut versuchen.");
  }
}

/** Erzeugt ein Bild und legt es im öffentlichen Bucket „landing-media" ab. */
export async function generateAiImage(prompt: string): Promise<string> {
  const { apiKey, base } = await loadAiCreds();
  const url = `${base}/v1beta/models/${encodeURIComponent(DEFAULT_IMAGE_MODEL)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: headersFor(apiKey),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Bild-Erzeugung fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
  const b64: string | undefined = inline?.inlineData?.data ?? inline?.inline_data?.data;
  const mime: string = inline?.inlineData?.mimeType ?? inline?.inline_data?.mime_type ?? "image/png";
  if (!b64) throw new Error("Die KI hat kein Bild geliefert. Bitte Beschreibung anpassen und erneut versuchen.");

  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  const path = `landing/ki-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("landing-media")
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(`Bild konnte nicht gespeichert werden: ${error.message}`);
  const { data: pub } = supabaseAdmin.storage.from("landing-media").getPublicUrl(path);
  return pub.publicUrl;
}
