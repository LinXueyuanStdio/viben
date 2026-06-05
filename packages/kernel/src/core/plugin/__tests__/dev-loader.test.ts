import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { DevPluginLoader } from '../dev-loader.js'

describe('DevPluginLoader', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-loader-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('rejects for nonexistent plugin path', async () => {
    const loader = new DevPluginLoader(path.join(tmpDir, 'nonexistent'))
    await expect(loader.load()).rejects.toThrow('Plugin not found')
  })

  it('loads plugin from valid path', async () => {
    const distDir = path.join(tmpDir, 'dist')
    fs.mkdirSync(distDir, { recursive: true })
    fs.writeFileSync(
      path.join(distDir, 'index.js'),
      `export default { name: 'test-plugin', version: '1.0.0', setup: async () => {} };\n`,
    )

    const loader = new DevPluginLoader(tmpDir)
    const plugin = await loader.load()
    expect(plugin.name).toBe('test-plugin')
    expect(plugin.version).toBe('1.0.0')
    expect(typeof plugin.setup).toBe('function')
  })

  it('reloads plugin with new module', async () => {
    const distDir = path.join(tmpDir, 'dist')
    fs.mkdirSync(distDir, { recursive: true })

    // Write v1
    fs.writeFileSync(
      path.join(distDir, 'index.js'),
      `export default { name: 'test-plugin', version: '1.0.0', setup: async () => {} };\n`,
    )

    const loader = new DevPluginLoader(tmpDir)
    const v1 = await loader.load()
    expect(v1.version).toBe('1.0.0')

    // Small delay to ensure cache-busting timestamp differs
    await new Promise(resolve => setTimeout(resolve, 10))

    // Write v2
    fs.writeFileSync(
      path.join(distDir, 'index.js'),
      `export default { name: 'test-plugin', version: '2.0.0', setup: async () => {} };\n`,
    )

    const v2 = await loader.load()
    expect(v2.version).toBe('2.0.0')
  })

  it('rejects when only src/index.ts exists without dist build', async () => {
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir, { recursive: true })
    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export default {}')

    const loader = new DevPluginLoader(tmpDir)
    await expect(loader.load()).rejects.toThrow("Run 'npm run build' first")
  })

  it('rejects when plugin has no name or setup', async () => {
    const distDir = path.join(tmpDir, 'dist')
    fs.mkdirSync(distDir, { recursive: true })
    fs.writeFileSync(
      path.join(distDir, 'index.js'),
      `export default { version: '1.0.0' };\n`,
    )

    const loader = new DevPluginLoader(tmpDir)
    await expect(loader.load()).rejects.toThrow('Invalid plugin')
  })

  it('returns correct paths', () => {
    const loader = new DevPluginLoader(tmpDir)
    expect(loader.getPluginPath()).toBe(tmpDir)
    expect(loader.getDistPath()).toBe(path.join(tmpDir, 'dist'))
  })
})
