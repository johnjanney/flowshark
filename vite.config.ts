import { defineConfig } from "vite";

// Tauri expects a fixed dev port and no auto-open.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
} as any);
