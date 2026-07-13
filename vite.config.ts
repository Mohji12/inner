import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 8081,
    hmr: {
      overlay: false,
    },
    proxy: {
      // Same-origin `/api/*` in dev → FastAPI (avoids CORS during local work).
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
