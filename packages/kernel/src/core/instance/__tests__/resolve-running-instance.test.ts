import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { resolveRunningInstance } from '../instance-context.js'

// Mock fetch for health checks
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'viben-test-'))
}

function createInstanceDir(root: string, port?: number) {
  const dir = path.join(root, '.viben')
  fs.mkdirSync(dir, { recursive: true })
  if (port !== undefined) {
    fs.writeFileSync(path.join(dir, 'api.port'), String(port))
  }
  return dir
}

function mockHealthy(port: number) {
  mockFetch.mockImplementation((url: string, _opts?: RequestInit) => {
    if (url === `http://127.0.0.1:${port}/api/v1/system/health`) {
      return Promise.resolve({ ok: true })
    }
    return Promise.reject(new Error('Connection refused'))
  })
}

function mockMultiHealthy(ports: number[]) {
  const portSet = new Set(ports)
  mockFetch.mockImplementation((url: string, _opts?: RequestInit) => {
    for (const port of portSet) {
      if (url === `http://127.0.0.1:${port}/api/v1/system/health`) {
        return Promise.resolve({ ok: true })
      }
    }
    return Promise.reject(new Error('Connection refused'))
  })
}

describe('resolveRunningInstance', () => {
  let tmpRoot: string

  beforeEach(() => {
    tmpRoot = tmpDir()
    mockFetch.mockReset()
  })

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('finds instance in exact cwd', async () => {
    createInstanceDir(tmpRoot, 21420)
    mockHealthy(21420)

    const result = await resolveRunningInstance(tmpRoot)
    expect(result).toBe(path.join(tmpRoot, '.viben'))
  })

  it('walks up to find instance in parent directory', async () => {
    createInstanceDir(tmpRoot, 21420)
    mockHealthy(21420)

    const nested = path.join(tmpRoot, 'project', 'src', 'core')
    fs.mkdirSync(nested, { recursive: true })

    const result = await resolveRunningInstance(nested)
    expect(result).toBe(path.join(tmpRoot, '.viben'))
  })

  it('skips dead instances and continues walking up', async () => {
    // Parent has running instance on port 21420
    createInstanceDir(tmpRoot, 21420)
    // Child has dead instance (port file but not running)
    const child = path.join(tmpRoot, 'project')
    createInstanceDir(child, 99999)

    mockHealthy(21420) // only parent is healthy

    const nested = path.join(child, 'src')
    fs.mkdirSync(nested, { recursive: true })

    const result = await resolveRunningInstance(nested)
    expect(result).toBe(path.join(tmpRoot, '.viben'))
  })

  it('skips instance with no port file', async () => {
    createInstanceDir(tmpRoot, 21420)
    mockHealthy(21420)

    const child = path.join(tmpRoot, 'project')
    // Create .viben dir without port file
    fs.mkdirSync(path.join(child, '.viben'), { recursive: true })

    const result = await resolveRunningInstance(path.join(child, 'src'))
    // Should skip child (no port) and find parent
    expect(result).toBe(path.join(tmpRoot, '.viben'))
  })

  it('nearest running instance wins over parent', async () => {
    createInstanceDir(tmpRoot, 21420)
    const child = path.join(tmpRoot, 'project')
    createInstanceDir(child, 21421)

    mockMultiHealthy([21420, 21421])

    const result = await resolveRunningInstance(path.join(child, 'src'))
    expect(result).toBe(path.join(child, '.viben'))
  })

  it('returns null when no instance is running', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'))

    const result = await resolveRunningInstance(tmpRoot)
    expect(result).toBeNull()
  })

  it('returns null for empty directory tree', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'))

    const empty = path.join(tmpRoot, 'empty', 'deep', 'path')
    fs.mkdirSync(empty, { recursive: true })

    const result = await resolveRunningInstance(empty)
    expect(result).toBeNull()
  })
})
