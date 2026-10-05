// Erzeugt landing-server/sections-renderer.js aus src/lib/landing-sections.ts.
// Der Live-Renderer läuft eigenständig auf dem VPS und kann nicht aus src/
// importieren — deshalb dieser Mirror (gleiches Muster wie legal-content).
// Nach jeder Änderung an src/lib/landing-sections.ts:
//   bun scripts/build-sections-renderer-js.mjs
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import * as esbuild from "esbuild";

const rawPlugin = {
  name: "raw-loader",
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: resolve(args.resolveDir, args.path.replace(/\?raw$/, "")),
      namespace: "raw",
    }));
    build.onLoad({ filter: /.*/, namespace: "raw" }, (args) => ({
      contents: readFileSync(args.path, "utf8"),
      loader: "text",
    }));
  },
};

await esbuild.build({
  entryPoints: ["src/lib/landing-sections.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  outfile: "landing-server/sections-renderer.js",
  plugins: [rawPlugin],
  banner: { js: "/* AUTOGENERIERT aus src/lib/landing-sections.ts — nicht direkt bearbeiten!\n   Neu erzeugen mit: bun scripts/build-sections-renderer-js.mjs */" },
});

const out = readFileSync("landing-server/sections-renderer.js", "utf8");
console.log("landing-server/sections-renderer.js geschrieben:", out.length, "bytes");
