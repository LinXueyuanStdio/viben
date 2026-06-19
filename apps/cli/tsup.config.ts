import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
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
  // Keep cli-progress external to avoid "Dynamic require of readline is not supported"
  // when bundling this CJS package into an ESM output.
  external: [
    'cli-progress',
    '@hypothesi/tauri-mcp-server',
    '@larksuiteoapi/node-sdk',
    'cloudflared',
    'node-notifier',
    'node-pty',
    'axios',
    'form-data',
    'follow-redirects',
    'socket.io',
    'socket.io-client',
  ],
  // Mark Node.js built-in modules as external
  // All packages in dependencies are auto-externalized by tsup
  platform: 'node',
});
