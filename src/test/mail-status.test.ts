import { describe, it, expect } from "vitest";
import { mailStatus } from "@/lib/mail-status";
describe("mailStatus", () => {
  it("bounced wins", () => expect(mailStatus({ bounced_at: "x", opened_at: "y" })).toBe("bounced"));
  it("opened over delivered", () => expect(mailStatus({ delivered_at: "x", opened_at: "y" })).toBe("opened"));
  it("delivered = unread", () => expect(mailStatus({ delivered_at: "x" })).toBe("delivered"));
  it("nothing = sent", () => expect(mailStatus({})).toBe("sent"));
});
