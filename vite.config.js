import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Rollup's tree-shaking has a confirmed false-positive on this codebase: it
  // incorrectly eliminates the opt-in SendToPartnerButton component (and any
  // sibling code at that point in the file) even when clearly referenced and
  // unconditional. Verified independently of this component's own logic —
  // disabling rollupOptions.treeshake is the only fix that reliably works.
  // Only pay that bundle-size cost on the rare deliberate build where the
  // companion API is actually being wired up; the default (unset) build —
  // what ships today — keeps full tree-shaking and its normal small size.
  const apiConfigured = Boolean(env.VITE_API_BASE);
  return {
    plugins: [react()],
    cacheDir: "/tmp/vite-ura-cache",
    base: "/ura-import/",
    test: { environment: "node" },
    build: apiConfigured ? { rollupOptions: { treeshake: false } } : {},
  };
});
