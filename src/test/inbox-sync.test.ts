import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
import { pickNewReceived, handleResendEvent, syncReceivedEmails } from "@/lib/lead-mailing.server";

function dbChain(result: any) {
  const chain: any = {};
  for (const method of ["select", "eq", "order", "limit", "ilike", "not", "insert", "in", "update"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => result);
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Postfach-Abruf aus Resend", () => {
  const now = Date.now();
  const iso = (h: number) => new Date(now - h * 3600000).toISOString();
  it("übernimmt keine bereits gespeicherten Mails", () => {
    const r = pickNewReceived([{ id: "a", created_at: iso(1) }, { id: "b", created_at: iso(2) }], new Set(["a"]), now - 15 * 86400000);
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });
  it("übernimmt dieselbe Mail nur einmal", () => {
    const r = pickNewReceived([{ id: "c", created_at: iso(1) }, { id: "c", created_at: iso(1) }], new Set(), now - 86400000);
    expect(r).toHaveLength(1);
  });
  it("ignoriert Mails älter als 15 Tage", () => {
    const r = pickNewReceived([{ id: "d", created_at: iso(24 * 16) }], new Set(), now - 15 * 86400000);
    expect(r).toHaveLength(0);
  });
});

describe("Speicherung eingegangener Mails", () => {
  const event = { type: "email.received", data: { id: "received-1", from: "person@example.org", to: ["info@example.org"], text: "Antwort", subject: "Re: Termin" } };
  it("meldet einen Speicherfehler statt Erfolg", async () => {
    mocks.from.mockReturnValueOnce(dbChain({ data: { profile_id: "profile-1", kind: "employee" } }))
      .mockReturnValueOnce(dbChain({ error: { code: "42P10", message: "missing conflict constraint" } }));
    await expect(handleResendEvent(event)).rejects.toThrow("Eingegangene Mail konnte nicht gespeichert werden");
  });
  it("speichert einen neuen Eingang ungelesen mit geprüftem INSERT", async () => {
    const insert = dbChain({ error: null });
    mocks.from.mockReturnValueOnce(dbChain({ data: { profile_id: "profile-1", kind: "employee" } })).mockReturnValueOnce(insert);
    await expect(handleResendEvent(event)).resolves.toEqual({ stored: true });
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ provider_id: "received-1", direction: "in", handled: false, body_text: "Antwort" }));
  });
  it("zählt einen bestätigten doppelten Eingang nicht erneut", async () => {
    mocks.from.mockReturnValueOnce(dbChain({ data: { kind: "employee" } }))
      .mockReturnValueOnce(dbChain({ error: { code: "23505", message: "duplicate" } }))
      .mockReturnValueOnce(dbChain({ data: { id: "stored-1" }, error: null }));
    await expect(handleResendEvent(event)).resolves.toEqual({ stored: false });
  });
  it("übernimmt den Mailinhalt aus dem Empfangsdetail", async () => {
    const insert = dbChain({ error: null });
    mocks.from.mockReturnValueOnce(dbChain({ data: { resend_api_key: "test-key" } }))
      .mockReturnValueOnce(dbChain({ data: { kind: "employee" } })).mockReturnValueOnce(insert);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ text: "Vollständige Antwort" })));
    await handleResendEvent({ ...event, data: { ...event.data, text: "" } });
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ body_text: "Vollständige Antwort" }));
  });
  it("meldet fehlende Empfangsrechte und speichert keinen leeren Eingang", async () => {
    mocks.from.mockReturnValueOnce(dbChain({ data: { resend_api_key: "test-key" } }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("restricted_api_key", { status: 403 })));
    await expect(handleResendEvent({ ...event, data: { ...event.data, text: "" } })).rejects.toThrow("Resend 403");
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  it("gibt beim Abruf einen Speicherfehler zurück statt keine neuen Mails", async () => {
    vi.useFakeTimers();
    mocks.from.mockReturnValueOnce(dbChain({ data: { resend_api_key: "test-key" } }))
      .mockReturnValueOnce(dbChain({ data: [], error: null }))
      .mockReturnValueOnce(dbChain({ data: { kind: "employee" } }))
      .mockReturnValueOnce(dbChain({ error: { code: "42501", message: "permission denied" } }));
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [{ ...event.data, created_at: new Date().toISOString() }], has_more: false })));
    const result = syncReceivedEmails();
    await vi.runAllTimersAsync();
    expect(await result).toEqual(expect.objectContaining({ stored: 0, error: expect.stringContaining("permission denied") }));
  });
});
