import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@viben/editor": path.resolve(__dirname, "../src"),
    },
  },
  server: {
    port: 3457,
    open: false,
  },
});
