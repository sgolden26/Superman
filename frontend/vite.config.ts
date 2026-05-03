import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// In dev, serve `state.json` and `intel.json` directly off `../data/` so a
// backend `intel tick` (which rewrites `data/intel.json`) is reflected on
// the next FE poll without having to restart `npm run dev`. The `predev`
// copy step still seeds `frontend/public/` for production builds and as a
// fallback when the live file is missing.
function liveDataFiles(): Plugin {
  const dataDir = path.resolve(__dirname, "../data");
  const served: Record<string, string> = {
    "/state.json": path.join(dataDir, "state.json"),
    "/intel.json": path.join(dataDir, "intel.json"),
  };
  return {
    name: "axis-live-data-files",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const [pathname] = req.url.split("?");
        const fsPath = served[pathname];
        if (!fsPath || !existsSync(fsPath)) return next();
        try {
          const body = readFileSync(fsPath);
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(body);
        } catch (err) {
          console.warn(`[axis-live-data-files] failed to serve ${pathname}:`, err);
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), liveDataFiles()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
