import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
it("dbg", () => {
  const serverSrc = readFileSync(join(__dirname, "..", "..", "landing-server", "server.js"), "utf8");
  const code = serverSrc.slice(serverSrc.indexOf("// Entfernt doppelte Impressum-/Datenschutz-Links"), serverSrc.indexOf("function cleanEmptyMeta(html, branding, domain)"));
  const sandbox: Record<string, unknown> = {};
  vm.runInNewContext(code + "\nglobalThis.__out = { injectTrustFooter, stripThemeLegalLinks, themeFooterHasLegalLinks };", sandbox);
  console.log("KEYS", JSON.stringify(Object.keys(sandbox)));
  console.log("TYPES", JSON.stringify(Object.fromEntries(Object.entries(sandbox).map(([k,v]) => [k, typeof v]))));
  expect(1).toBe(1);
});
