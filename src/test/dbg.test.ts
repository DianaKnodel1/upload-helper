import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
it("dbg", () => {
  const serverSrc = readFileSync(join(__dirname, "..", "..", "landing-server", "server.js"), "utf8");
  const code = serverSrc.slice(serverSrc.indexOf("// Entfernt doppelte Impressum-/Datenschutz-Links"), serverSrc.indexOf("function cleanEmptyMeta(html, branding, domain)"));
  const sandbox: Record<string, unknown> = {};
  vm.runInNewContext(code + "\nmodule = { exports: {} }; module.exports = { injectTrustFooter };", sandbox);
  console.log("KEYS", Object.keys(sandbox), typeof sandbox.module, typeof (sandbox.module as any)?.injectTrustFooter);
  expect(1).toBe(1);
});
