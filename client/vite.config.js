import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

/**
 * The api/ + contract/ sources are NodeNext TypeScript: they import siblings
 * with a `.js` specifier that actually resolves to a `.ts` file on disk
 * (`./common-types.js` -> `common-types.ts`). Vite has no `extensionAlias`,
 * so rewrite those specifiers when — and only when — a sibling `.ts` exists.
 * The compiled Compact artifacts are genuine `.js` and must be left alone.
 */
function tsExtensionAlias() {
  return {
    name: "ts-extension-alias",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer || !source.startsWith(".") || !source.endsWith(".js")) return null;
      const asTs = path.resolve(path.dirname(importer), source.slice(0, -3) + ".ts");
      return fs.existsSync(asTs) ? asTs : null;
    },
  };
}

export default defineConfig({
  plugins: [tsExtensionAlias(), react(), tailwindcss(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `isomorphic-ws`'s browser build default-exports the native WebSocket but
      // has no NAMED export, while the Midnight indexer provider imports
      // `{ WebSocket }` — which resolves to undefined and kills the live
      // subscription. Point both specifiers at a shim that exports both shapes.
      "isomorphic-ws": path.resolve(__dirname, "./src/midnight/ws-shim.mjs"),
      ws: path.resolve(__dirname, "./src/midnight/ws-shim.mjs"),
    },
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json", ".wasm"],
    mainFields: ["browser", "module", "main"],
  },
  server: {
    // api/ and contract/ live outside this package's root.
    fs: { allow: [REPO_ROOT] },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("onchain-runtime-v3")) return "wasm";
        },
      },
    },
    commonjsOptions: {
      transformMixedEsModules: true,
      extensions: [".js", ".cjs"],
      ignoreDynamicRequires: true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
      supported: { "top-level-await": true },
      platform: "browser",
      format: "esm",
    },
    include: ["@midnight-ntwrk/compact-runtime"],
    exclude: [
      "@midnight-ntwrk/onchain-runtime-v3",
      "@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.wasm",
      "@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm.js",
    ],
  },
});
