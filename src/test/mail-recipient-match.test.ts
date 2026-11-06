import { describe, it, expect } from "vitest";
import { pickRecipientMatch } from "@/lib/mail-recipient-match";

const app = (id: string, tenant: string, created: string, user: string | null = null) =>
  ({ id, full_name: "A " + id, tenant_id: tenant, user_id: user, created_at: created });

describe("pickRecipientMatch", () => {
  it("assigns a known employee when only the email is typed", () => {
    const r = pickRecipientMatch([app("a1", "t1", "2026-08-01", "u1")],
      [{ id: "p1", full_name: "Nikolaus", tenant_id: "t1", user_id: "u1", application_id: null }], "t1");
    expect(r).toMatchObject({ type: "employee", profile_id: "p1", application_id: "a1" });
  });
  it("uses the newest application of the selected company", () => {
    const r = pickRecipientMatch([app("old", "t1", "2026-08-01"), app("new", "t2", "2026-10-01"), app("mid", "t1", "2026-09-01")], [], "t1");
    expect(r?.application_id).toBe("mid");
  });
  it("returns no assignment for an unknown address", () => {
    expect(pickRecipientMatch([], [], "t1")).toBeNull();
  });
});
