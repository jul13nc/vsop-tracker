/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy Supabase so the browser talks to the Vite origin (same host as the
    // app) instead of 127.0.0.1:54321 directly. Robust under WSL where the
    // Windows browser cannot always reach WSL-bound ports by localhost.
    proxy: {
      "/supabase": {
        target: "http://127.0.0.1:54321",
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/supabase/, ""),
      },
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
