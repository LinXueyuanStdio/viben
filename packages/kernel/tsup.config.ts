import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    index: 'src/index.ts',
    testing: 'src/testing.ts',
  },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  splitting: false,
  sourcemap: true,
  dts: true,
  clean: true,
  outDir: 'dist-publish/dist',
})
