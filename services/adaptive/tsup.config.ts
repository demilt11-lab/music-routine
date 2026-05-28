import { defineConfig } from "tsup";

// Bundle the entire service (including the @biomusic/core workspace and npm
// deps) into one self-contained ESM file so the production image ships just
// `dist/index.js` with no node_modules.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  bundle: true,
  noExternal: [/.*/],
  clean: true,
  minify: false,
  sourcemap: true,
  // Avoids ESM "dynamic require" crashes from transitively-bundled CJS deps.
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
});
