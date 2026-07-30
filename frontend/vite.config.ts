import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend runs on 8080; the dev server proxies /api and /ws so the frontend
// can always talk to relative paths in both dev and production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true
      },
      "/ws": {
        target: "ws://localhost:8080",
        ws: true
      }
    }
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true
      },
      "/ws": {
        target: "ws://localhost:8080",
        ws: true
      }
    }
  },
  build: {
    outDir: "dist"
  }
});
