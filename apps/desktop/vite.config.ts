import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// Node.js-only packages that should be externalized for browser builds
const nodeOnlyPackages = [
  // Viben core (uses Node.js fs, os, path, child_process, etc.)
  // Desktop app should use Gateway API instead of direct imports
  "@viben/core",
  // Server-side optional dependencies
  "node-notifier",
  "@larksuiteoapi/node-sdk",
  "node-pty",
  // OpenTelemetry packages (use Node.js-specific modules like stream, zlib, http)
  "@opentelemetry/api",
  "@fastify/otel",
  "@opentelemetry/instrumentation-http",
  "@opentelemetry/sdk-metrics",
  "@opentelemetry/sdk-node",
  "@opentelemetry/sdk-trace-base",
  "@opentelemetry/semantic-conventions",
  "@opentelemetry/otlp-exporter-base",
  "@opentelemetry/exporter-trace-otlp-grpc",
  "@opentelemetry/exporter-trace-otlp-http",
  "@opentelemetry/exporter-metrics-otlp-grpc",
  "@opentelemetry/exporter-metrics-otlp-http",
  // gRPC (used by OpenTelemetry OTLP exporters)
  "@grpc/grpc-js",
  "@grpc/proto-loader",
  // Fastify and server packages
  "fastify",
  "@fastify/cors",
  "@fastify/multipart",
  "@fastify/swagger",
  "@fastify/swagger-ui",
  "@fastify/websocket",
  // MCP SDK stdio transport uses Node.js child_process
  // SSE and HTTP transports work in browser, so only exclude stdio
  "@modelcontextprotocol/sdk/client/stdio.js",
  "@modelcontextprotocol/sdk/server/stdio.js",
  // Anthropic SDKs (use Node.js child_process, fs, etc.)
  "@anthropic-ai/claude-agent-sdk",
  "@anthropic-ai/sdk",
  // CLI tools
  "commander",
  // Other Node.js-specific packages
  "pino",
  "cloudflared",
  "undici",
  "adm-zip",
  "cross-spawn",
];

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Externalize server-side only packages from @viben/core
  // These are optional dependencies that use dynamic import with fallback
  ssr: {
    external: nodeOnlyPackages,
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
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        screenshotOverlay: fileURLToPath(new URL("./screenshot-overlay.html", import.meta.url)),
      },
      // Externalize server-side only packages (including deep imports)
      external: (id: string) => {
        // Match exact package names or deep imports (e.g., @pkg/name/dist/file.js)
        return nodeOnlyPackages.some(
          (pkg) => id === pkg || id.startsWith(`${pkg}/`)
        );
      },
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
    // Exclude server-side only packages from pre-bundling
    exclude: nodeOnlyPackages,
  },
}));
