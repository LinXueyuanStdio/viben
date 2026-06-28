import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@viben/editor",
        replacement: path.resolve(__dirname, "../src"),
      },
      // Resolve @yoopta/* workspace packages (package-level only, not subpath
      // exports like @yoopta/ui/slash-command-menu). This ensures Vite can find
      // these transitive deps of @viben/editor when processing source files
      // through the alias above.
      {
        find: /^@yoopta\/([^/]+)$/,
        replacement: path.resolve(__dirname, "../node_modules/@yoopta/$1"),
      },
    ],
  },
  server: {
    port: 3457,
    open: false,
  },
});
