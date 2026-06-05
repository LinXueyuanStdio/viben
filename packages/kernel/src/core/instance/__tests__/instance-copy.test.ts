// src/core/__tests__/instance-copy.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { copyInstance } from '../instance-copy.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('copyInstance', () => {
  let srcDir: string
  let dstDir: string
  let baseDir: string

  beforeEach(() => {
    baseDir = path.join(os.tmpdir(), `test-copy-${Date.now()}`)
    srcDir = path.join(baseDir, 'src', '.viben')
    dstDir = path.join(baseDir, 'dst', '.viben')

    fs.mkdirSync(path.join(srcDir, 'plugins', 'data', '@viben', 'tunnel'), { recursive: true })
    fs.mkdirSync(path.join(srcDir, 'plugins', 'node_modules', 'some-plugin'), { recursive: true })
    fs.mkdirSync(path.join(srcDir, 'agents', 'cline'), { recursive: true })
    fs.mkdirSync(path.join(srcDir, 'bin'), { recursive: true })

    fs.writeFileSync(path.join(srcDir, 'config.json'), JSON.stringify({
      instanceName: 'Main',
      channels: { telegram: { botToken: 'secret' } },
      api: { port: 21420 },
    }))
    fs.writeFileSync(path.join(srcDir, 'plugins.json'), JSON.stringify({ installed: { '@viben/tunnel': {} } }))
    fs.writeFileSync(path.join(srcDir, 'plugins', 'package.json'), '{}')
    fs.writeFileSync(path.join(srcDir, 'plugins', 'node_modules', 'some-plugin', 'index.js'), 'module.exports = {}')
    fs.writeFileSync(path.join(srcDir, 'agents.json'), JSON.stringify({ version: 1, installed: {} }))
    fs.writeFileSync(path.join(srcDir, 'agents', 'cline', 'binary'), 'fake-binary')
    fs.writeFileSync(path.join(srcDir, 'bin', 'cloudflared'), 'fake-binary')
    fs.writeFileSync(path.join(srcDir, 'plugins', 'data', '@viben', 'tunnel', 'settings.json'),
      JSON.stringify({ provider: 'cloudflare', port: 3100, maxUserTunnels: 5 }))
  })

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true })
  })

  it('copies config.json with migrated sections and instanceName stripped', async () => {
    await copyInstance(srcDir, dstDir, {})
    const config = JSON.parse(fs.readFileSync(path.join(dstDir, 'config.json'), 'utf-8'))
    expect(config.instanceName).toBeUndefined()
    // Migrated plugin sections are stripped (plugins read from settings.json now)
    expect(config.api).toBeUndefined()
    // Plugin-owned channel fields stripped, core channel fields preserved
    expect(config.channels.telegram.botToken).toBeUndefined()
  })

  it('copies plugins.json', async () => {
    await copyInstance(srcDir, dstDir, {})
    expect(fs.existsSync(path.join(dstDir, 'plugins.json'))).toBe(true)
  })

  it('copies plugins/node_modules', async () => {
    await copyInstance(srcDir, dstDir, {})
    expect(fs.existsSync(path.join(dstDir, 'plugins', 'node_modules', 'some-plugin', 'index.js'))).toBe(true)
  })

  it('copies agents directory', async () => {
    await copyInstance(srcDir, dstDir, {})
    expect(fs.existsSync(path.join(dstDir, 'agents', 'cline', 'binary'))).toBe(true)
  })

  it('copies bin directory', async () => {
    await copyInstance(srcDir, dstDir, {})
    expect(fs.existsSync(path.join(dstDir, 'bin', 'cloudflared'))).toBe(true)
  })

  it('filters plugin settings by inheritableKeys', async () => {
    const inheritableMap = { '@viben/tunnel': ['provider', 'maxUserTunnels'] }
    await copyInstance(srcDir, dstDir, { inheritableKeys: inheritableMap })
    const settings = JSON.parse(fs.readFileSync(
      path.join(dstDir, 'plugins', 'data', '@viben', 'tunnel', 'settings.json'), 'utf-8'
    ))
    expect(settings.provider).toBe('cloudflare')
    expect(settings.maxUserTunnels).toBe(5)
    expect(settings.port).toBeUndefined()
  })

  it('does not copy sessions, logs, cache, PID, or runtime files', async () => {
    fs.writeFileSync(path.join(srcDir, 'sessions.json'), '{}')
    fs.mkdirSync(path.join(srcDir, 'logs'), { recursive: true })
    fs.writeFileSync(path.join(srcDir, 'viben.pid'), '12345')
    fs.writeFileSync(path.join(srcDir, 'api.port'), '21420')

    await copyInstance(srcDir, dstDir, {})
    expect(fs.existsSync(path.join(dstDir, 'sessions.json'))).toBe(false)
    expect(fs.existsSync(path.join(dstDir, 'logs'))).toBe(false)
    expect(fs.existsSync(path.join(dstDir, 'viben.pid'))).toBe(false)
    expect(fs.existsSync(path.join(dstDir, 'api.port'))).toBe(false)
  })

  it('calls onProgress callback', async () => {
    const progress: Array<{ step: string; status: string }> = []
    await copyInstance(srcDir, dstDir, {
      onProgress: (step, status) => progress.push({ step, status }),
    })
    expect(progress.length).toBeGreaterThan(0)
    expect(progress.some(p => p.step === 'Configuration')).toBe(true)
    expect(progress.some(p => p.step === 'Plugins')).toBe(true)
  })
})
