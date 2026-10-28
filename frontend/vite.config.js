import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The green-credit screens call the Spring backend on the same origin (/api); VITE_BACKEND_URL points the proxy elsewhere
  // (for example the Prism mock on http://localhost:4010).
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL ?? "http://localhost:8080",
        changeOrigin: true,
        // the backend's CORS list only knows localhost:5173; through the proxy the call is same-origin anyway
        configure: (proxy) => proxy.on("proxyReq", (req) => req.removeHeader("origin")),
      },
    },
  },
});
