import { describe, it, expect } from "vitest";
import { renderMail, safeUrl, safeColor, LEAD_FOOTER } from "@/lib/mail-template";

const sig = { company: "Muster GmbH", name: "Anna Weber", position: "Geschäftsführerin", phone: "030 123", email: "a@muster.de", website: "muster.de", color: "#c2410c" };

describe("mail-template", () => {
  it("escapes HTML in the body", () => {
    const { html } = renderMail({ text: "<script>alert(1)</script>", signature: sig, kind: "employee" });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("puts the signature into HTML and plain text", () => {
    const { html, text } = renderMail({ text: "Hallo", signature: sig, kind: "employee" });
    expect(html).toContain("Anna Weber");
    expect(html).toContain("Geschäftsführerin · Muster GmbH");
    expect(text).toContain("Mit freundlichen Grüßen");
    expect(text).toContain("Tel. 030 123");
  });

  it("adds the unsubscribe footer only for leads", () => {
    expect(renderMail({ text: "x", signature: sig, kind: "lead" }).text).toContain(LEAD_FOOTER);
    expect(renderMail({ text: "x", signature: sig, kind: "employee" }).text).not.toContain("Abmelden");
  });

  it("rejects unsafe links and colors", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("muster.de")).toBe("https://muster.de/");
    expect(safeColor("red;background:url(x)")).toBe("#1f1b16");
  });
});
