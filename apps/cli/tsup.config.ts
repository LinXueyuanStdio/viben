import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  target: 'node18',
  outDir: 'dist',
  // Bundle workspace packages (@viben/*) since they are not published to npm separately.
  // All other dependencies listed in package.json are auto-externalized by tsup.
  noExternal: ['@viben/core', '@viben/api-client'],
  // Mark Node.js built-in modules as external
  // All packages in dependencies are auto-externalized by tsup
  platform: 'node',
});
