import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: true,
  treeshake: true,
  target: 'node18',
  outDir: 'dist',
  // Bundle workspace packages (@viben/*) since they are not published to npm separately.
  // All other dependencies listed in package.json are auto-externalized by tsup.
  noExternal: ['@viben/core', '@viben/api-client'],
  external: [
    'cli-progress',
    '@hypothesi/tauri-mcp-server',
  ],
  // Mark Node.js built-in modules as external
  // All packages in dependencies are auto-externalized by tsup
  platform: 'node',
});
