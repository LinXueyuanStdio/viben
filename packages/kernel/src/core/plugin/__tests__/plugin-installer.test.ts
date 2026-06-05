import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { importFromDir, installNpmPlugin } from '../plugin-installer.js'

describe('importFromDir', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-installer-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  async function createFakePackage(
    name: string,
    pkgJson: Record<string, any>,
    entryContent = 'export const loaded = true;\n',
  ) {
    const pkgDir = path.join(tmpDir, 'node_modules', ...name.split('/'))
    await fs.mkdir(pkgDir, { recursive: true })
    await fs.writeFile(path.join(pkgDir, 'package.json'), JSON.stringify(pkgJson))

    const entry = pkgJson.exports?.['.']?.import
      ?? pkgJson.exports?.['.']
      ?? pkgJson.main
      ?? 'index.js'
    const entryResolved = typeof entry === 'string' ? entry : 'index.js'
    const entryPath = path.join(pkgDir, entryResolved)
    await fs.mkdir(path.dirname(entryPath), { recursive: true })
    await fs.writeFile(entryPath, entryContent)
  }

  it('resolves ESM package via exports["."].import', async () => {
    await createFakePackage('test-esm', {
      name: 'test-esm',
      type: 'module',
      exports: { '.': { import: './dist/index.js' } },
    })

    const mod = await importFromDir('test-esm', tmpDir)
    expect(mod.loaded).toBe(true)
  })

  it('resolves package via exports["."] string shorthand', async () => {
    await createFakePackage('test-shorthand', {
      name: 'test-shorthand',
      exports: { '.': './lib/main.js' },
    })

    const mod = await importFromDir('test-shorthand', tmpDir)
    expect(mod.loaded).toBe(true)
  })

  it('resolves package via main field', async () => {
    await createFakePackage('test-main', {
      name: 'test-main',
      main: './lib/index.js',
    })

    const mod = await importFromDir('test-main', tmpDir)
    expect(mod.loaded).toBe(true)
  })

  it('falls back to index.js when no exports or main', async () => {
    await createFakePackage('test-fallback', {
      name: 'test-fallback',
    })

    const mod = await importFromDir('test-fallback', tmpDir)
    expect(mod.loaded).toBe(true)
  })

  it('resolves scoped packages', async () => {
    await createFakePackage('@viben/plugin-discord', {
      name: '@viben/plugin-discord',
      exports: { '.': { import: './dist/index.js' } },
    })

    const mod = await importFromDir('@viben/plugin-discord', tmpDir)
    expect(mod.loaded).toBe(true)
  })

  it('throws descriptive error when package.json missing', async () => {
    await expect(importFromDir('nonexistent', tmpDir)).rejects.toThrow(
      /Cannot read package\.json for "nonexistent"/,
    )
  })

  it('throws descriptive error when entry point missing', async () => {
    const pkgDir = path.join(tmpDir, 'node_modules', 'bad-entry')
    await fs.mkdir(pkgDir, { recursive: true })
    await fs.writeFile(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'bad-entry', main: './missing.js' }),
    )

    await expect(importFromDir('bad-entry', tmpDir)).rejects.toThrow(
      /Entry point "\.\/missing\.js" not found for "bad-entry"/,
    )
  })
})

describe('installNpmPlugin — --ignore-scripts flag', () => {
  it("includes --ignore-scripts flag in npm install command", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      new URL("../plugin-installer.ts", import.meta.url).pathname.replace("__tests__/", ""),
      "utf-8",
    );
    // Verify --ignore-scripts is present in execFile/exec npm install calls
    expect(source).toContain("--ignore-scripts");
    // Verify execFile is used instead of exec (no shell injection)
    expect(source).toContain("execFileAsync");
  });
});

describe('installNpmPlugin — package name validation', () => {
  // Shell injection attempts must be rejected before any exec
  const maliciousNames = [
    'foo; rm -rf /',
    '$(whoami)',
    'foo`id`bar',
    'foo && bar',
    'foo | bar',
    'foo > /tmp/out',
    '../../../etc/passwd',
    'foo\nbar',
  ]

  for (const name of maliciousNames) {
    it(`rejects shell metacharacter input: ${JSON.stringify(name)}`, async () => {
      await expect(installNpmPlugin(name, '/tmp/nonexistent-plugins-dir')).rejects.toThrow(
        'Invalid package name',
      )
    })
  }

  // Valid names should NOT throw "Invalid package name" — they may fail further down the stack
  // (e.g., npm install) but validation itself must pass.
  const validNames = [
    'my-viben-plugin',
    'my.plugin',
    '@scope/my-plugin',
    '@viben/telegram',
    'my-plugin@4.17.21',
    '@scope/pkg@^1.0.0',
    'MY-PLUGIN',
  ]

  for (const name of validNames) {
    it(`accepts valid npm package name: ${JSON.stringify(name)}`, async () => {
      // These will throw because the plugins dir doesn't exist or npm install fails,
      // but the error must NOT be "Invalid package name"
      const result = await installNpmPlugin(name, '/tmp/nonexistent-plugins-dir').catch((e: Error) => e)
      if (result instanceof Error) {
        expect(result.message).not.toContain('Invalid package name')
      }
      // If it resolved (unlikely in test env), validation definitely passed
    })
  }
})
