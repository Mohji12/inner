import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "localhost",
    port: 8081,
    strictPort: true,
    // Keep HMR on this origin so the `/api` proxy cannot steal the Vite websocket.
    hmr: {
      overlay: false,
      protocol: "ws",
      host: "localhost",
      port: 8081,
      clientPort: 8081,
    },
    proxy: {
      // Used only when `VITE_API_URL` is empty (same-origin `/api` → local FastAPI).
      // Chat/API websockets go to VITE_API_URL when it is set (production).
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
