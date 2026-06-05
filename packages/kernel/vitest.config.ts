import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@viben/plugin-sdk/testing': path.resolve(__dirname, '../kernel-sdk/src/testing/test-context.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
