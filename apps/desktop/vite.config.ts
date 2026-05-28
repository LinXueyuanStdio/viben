import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import postcssCascadeLayers from "@csstools/postcss-cascade-layers";
import postcss from "postcss";
import path from "path";
import { fileURLToPath } from "url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// Check if building for mobile (Android/iOS)
// Mobile builds need CSS @layer polyfill because Android WebView (Chrome 86) doesn't support @layer (requires Chrome 99+)
// TAURI_ENV_PLATFORM is set by `tauri android build` or `tauri ios build`
// VITE_MOBILE_BUILD can be set manually for testing
// @ts-expect-error process is a nodejs global
const platform = process.env.TAURI_ENV_PLATFORM || "";
// @ts-expect-error process is a nodejs global
const isMobileBuild = platform === "android" || platform === "ios" || process.env.VITE_MOBILE_BUILD === "true";

if (isMobileBuild) {
  console.log(`[vite.config] Mobile build detected (platform=${platform}), enabling CSS @layer polyfill`);
}

/**
 * Custom Vite plugin to run postcss-cascade-layers AFTER @tailwindcss/vite processes CSS.
 *
 * IMPORTANT: @tailwindcss/vite bypasses Vite's PostCSS pipeline entirely, so adding
 * postcss-cascade-layers to css.postcss.plugins does NOT work. This plugin uses
 * generateBundle hook to transform the final CSS bundle after all processing is done.
 *
 * This polyfills CSS @layer for Android WebView (Chrome 86) which doesn't support
 * cascade layers (requires Chrome 99+).
 */
function cascadeLayersPolyfill(): Plugin {
  return {
    name: "cascade-layers-polyfill",
    enforce: "post",
    async generateBundle(_options, bundle) {
      const cascadeLayersPlugin = postcssCascadeLayers();

      for (const fileName of Object.keys(bundle)) {
        const chunk = bundle[fileName];
        // Only process CSS assets
        if (chunk.type !== "asset" || !fileName.endsWith(".css")) continue;

        const source = typeof chunk.source === "string" ? chunk.source : chunk.source.toString();

        // Only process if @layer is present
        if (!source.includes("@layer")) continue;

        console.log(`[cascade-layers-polyfill] Processing ${fileName}...`);

        try {
          const result = await postcss([cascadeLayersPlugin]).process(source, {
            from: fileName,
          });
          chunk.source = result.css;
          console.log(`[cascade-layers-polyfill] Successfully transformed ${fileName}`);
        } catch (error) {
          console.error(`[cascade-layers-polyfill] Error processing ${fileName}:`, error);
        }
      }
    },
  };
}

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
  plugins: [
    react(),
    tailwindcss(),
    // Only apply cascade-layers polyfill for mobile builds
    // This MUST run after tailwindcss() to transform the @layer rules it generates
    ...(isMobileBuild ? [cascadeLayersPolyfill()] : []),
  ],
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
  // Note: ports 1249-1548 are excluded by Windows (Hyper-V), so use 1549+
  server: {
    port: 1549,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1550,
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
    // Disable CSS code splitting to ensure all CSS (including Tailwind) ends up in one file
    // With multiple HTML entry points, Vite's default CSS code splitting can cause Tailwind
    // CSS to not be properly linked to the main index.html. Setting this to false ensures
    // a single CSS bundle that all entry points can use.
    cssCodeSplit: false,
    // Enable code splitting for dynamic imports
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        screenshotOverlay: fileURLToPath(new URL("./screenshot-overlay.html", import.meta.url)),
        pagePreviewWindow: fileURLToPath(new URL("./page-preview-window.html", import.meta.url)),
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
    // Target browsers that support Android WebView (API 30 = Chrome ~86)
    // "esnext" causes issues on older WebViews
    target: ["es2020", "chrome86", "safari14"],
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
