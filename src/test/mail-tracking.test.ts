import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { trackingPatch } from "@/lib/lead-mailing.server";
const base = { delivered_at: null, opened_at: null, open_count: 0, bounced_at: null };
describe("trackingPatch", () => {
  it("delivered sets delivered_at once", () => {
    expect(trackingPatch(base, "email.delivered", "T1")).toEqual({ delivered_at: "T1" });
    expect(trackingPatch({ ...base, delivered_at: "T0" }, "email.delivered", "T1")).toBeNull();
  });
  it("repeat opens count up and keep first date", () => {
    expect(trackingPatch({ ...base, delivered_at: "T0", opened_at: "T1", open_count: 1 }, "email.opened", "T2"))
      .toEqual({ opened_at: "T1", open_count: 2, delivered_at: "T0" });
  });
});
