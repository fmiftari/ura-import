import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  cacheDir: "/tmp/vite-ura-cache",
  base: "/ura-import/",
  // server/ has its own independent package.json + node_modules + test
  // setup (run via `cd server && npm test`, see server/README.md) — excluded
  // here so the root CI step doesn't try to resolve the backend's
  // dependencies (which it never installs).
  test: { environment: "node", exclude: ["**/node_modules/**", "**/server/**"] },
  // Rollup's tree-shaking has a confirmed, reproducible bug on this codebase:
  // it silently drops referenced, unconditional JSX/code near the end of the
  // giant App() function — verified across dozens of variations (different
  // content, different position, forced global side effects, smaller file)
  // with NO config short of fully disabling treeshake working reliably.
  // Bundle size cost accepted (~330KB -> ~975KB minified) until the file is
  // properly split into smaller modules (tracked as follow-up work).
  build: { rollupOptions: { treeshake: false } },
});
