/** Parameters collected from the user and used across all template generators. */
export interface TemplateParams {
  pluginName: string
  description: string
  author: string
  license: string
  /** Current CLI version — used to pin the viben engine constraint and SDK version. */
  cliVersion: string
}

/**
 * Generate package.json for a new plugin.
 *
 * The `engines.viben` field declares the minimum Viben CLI version required.
 * The `peerDependencies` entry on `@viben/kernel` is what npm uses for compatibility
 * warnings. Plugin SDK is a devDependency (types only, not bundled).
 */
export function generatePackageJson(params: TemplateParams): string {
  const packageJson = {
    name: params.pluginName,
    version: '0.1.0',
    description: params.description || '',
    type: 'module',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      dev: 'tsc --watch',
      test: 'vitest',
      prepublishOnly: 'npm run build',
    },
    author: params.author || '',
    license: params.license,
    keywords: ['viben', 'viben-plugin'],
    engines: {
      viben: `>=${params.cliVersion}`,
    },
    peerDependencies: {
      '@viben/kernel': `>=${params.cliVersion}`,
    },
    devDependencies: {
      '@viben/plugin-sdk': params.cliVersion,
      typescript: '^5.9.3',
      vitest: '^4.0.18',
    },
  }
  return JSON.stringify(packageJson, null, 2) + '\n'
}
