/**
 * Generate tsconfig.json for a new plugin.
 *
 * Uses NodeNext module resolution (required for ESM with .js imports),
 * strict mode, and targets ES2022 — matching the Viben core configuration.
 * Tests are excluded from the build output (compiled separately by vitest).
 */
export function generateTsconfig(): string {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      declaration: true,
      outDir: 'dist',
      rootDir: 'src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ['src'],
    exclude: ['node_modules', 'dist', 'src/**/__tests__'],
  }
  return JSON.stringify(tsconfig, null, 2) + '\n'
}
