import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { pickNewReceived } from "@/lib/lead-mailing.server";

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
