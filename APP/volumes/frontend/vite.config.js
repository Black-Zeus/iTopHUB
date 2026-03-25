import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function spaFallback(base) {
  return {
    name: "spa-fallback",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (
          req.url.startsWith(base) &&
          !req.url.includes(".") &&
          req.headers.accept?.includes("text/html")
        ) {
          req.url = base;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE_URL ?? "/itop-hub/";

  return {
    plugins: [react(), spaFallback(base)],

    base,

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@pages": path.resolve(__dirname, "./src/pages"),
        "@routes": path.resolve(__dirname, "./src/router"),
        "@styles": path.resolve(__dirname, "./src/styles"),
        "@data": path.resolve(__dirname, "./src/data"),
        "@services": path.resolve(__dirname, "./src/services"),
        "@ui": path.resolve(__dirname, "./src/ui"),
        "@components": path.resolve(__dirname, "./src/components"),
        "@layout": path.resolve(__dirname, "./src/layout"),
        "@hooks": path.resolve(__dirname, "./src/hooks"),
      },
    },

    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      allowedHosts: ["localhost", "nginx", "itophub-nginx"],

      hmr: {
        // Host y puerto público (donde nginx escucha)
        host: "localhost",
        clientPort: 80,
        // El path del WS debe ser solo la base, sin duplicar.
        // Vite NO concatena base + clientPort aquí — path es el path final
        // que el cliente usará para conectar el socket.
        path: "vite-hmr",
      },
    },
  };
});
