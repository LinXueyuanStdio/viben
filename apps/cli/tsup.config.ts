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
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  noExternal: ['@viben/core', '@viben/api-client'],
  external: [
    'cli-progress',
    '@hypothesi/tauri-mcp-server',
  ],
  platform: 'node',
});
