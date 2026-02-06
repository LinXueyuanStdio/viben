import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  target: 'node18',
  outDir: 'dist',
  // Don't bundle dependencies - let Node.js resolve them at runtime
  external: ['commander', 'chalk', 'yaml'],
  // Mark Node.js built-in modules as external
  platform: 'node',
});
