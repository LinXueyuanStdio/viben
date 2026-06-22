import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@viben/features": new URL("../src/index.ts", import.meta.url).pathname,
      "@viben/protocol": new URL("../../protocol/src/index.ts", import.meta.url).pathname
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5179
  }
});
