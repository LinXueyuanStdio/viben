import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      // Proxy vibe-kanban API to avoid CORS issues in development
      // Also enables WebSocket proxy for real-time task streaming
      "/vibe-kanban-api": {
        target: "http://127.0.0.1:60964",
        changeOrigin: true,
        ws: true, // Enable WebSocket proxy
        rewrite: (path) => path.replace(/^\/vibe-kanban-api/, "/api"),
      },
    },
  },
  // Build optimizations for production
  build: {
    // Enable code splitting for dynamic imports
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunk for React and related libraries
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // UI components chunk
          "ui-vendor": ["framer-motion", "lucide-react"],
          // i18n chunk
          "i18n-vendor": ["i18next", "react-i18next"],
        },
      },
    },
    // Target modern browsers for smaller bundle size
    target: "esnext",
    // Chunk size warning threshold (500KB)
    chunkSizeWarningLimit: 500,
  },
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "framer-motion",
      "lucide-react",
      "i18next",
      "react-i18next",
    ],
  },
}));
