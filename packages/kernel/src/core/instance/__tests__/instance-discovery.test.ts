import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { discoverRunningInstances } from '../instance-discovery.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createServer, type Server } from 'node:http'

describe('discoverRunningInstances', () => {
  let tmpDir: string
  let registryPath: string

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `test-discovery-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    registryPath = path.join(tmpDir, 'instances.json')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns empty array when registry file does not exist', async () => {
    const result = await discoverRunningInstances(path.join(tmpDir, 'nonexistent.json'))
    expect(result).toEqual([])
  })

  it('returns empty array when registry has no instances', async () => {
    fs.writeFileSync(registryPath, JSON.stringify({ version: 1, instances: {} }))
    const result = await discoverRunningInstances(registryPath)
    expect(result).toEqual([])
  })

  it('returns empty array when registry file is invalid JSON', async () => {
    fs.writeFileSync(registryPath, 'not json')
    const result = await discoverRunningInstances(registryPath)
    expect(result).toEqual([])
  })

  it('skips instances without api.port file', async () => {
    const instanceRoot = path.join(tmpDir, 'inst1')
    fs.mkdirSync(instanceRoot, { recursive: true })
    fs.writeFileSync(registryPath, JSON.stringify({
      version: 1,
      instances: { inst1: { id: 'inst1', root: instanceRoot } },
    }))
    const result = await discoverRunningInstances(registryPath)
    expect(result).toEqual([])
  })

  it('skips instances with invalid port in api.port', async () => {
    const instanceRoot = path.join(tmpDir, 'inst1')
    fs.mkdirSync(instanceRoot, { recursive: true })
    fs.writeFileSync(path.join(instanceRoot, 'api.port'), 'not-a-number')
    fs.writeFileSync(registryPath, JSON.stringify({
      version: 1,
      instances: { inst1: { id: 'inst1', root: instanceRoot } },
    }))
    const result = await discoverRunningInstances(registryPath)
    expect(result).toEqual([])
  })

  it('skips instances where health check fails (no server)', async () => {
    const instanceRoot = path.join(tmpDir, 'inst1')
    fs.mkdirSync(instanceRoot, { recursive: true })
    // Use a port that is very unlikely to have a running server
    fs.writeFileSync(path.join(instanceRoot, 'api.port'), '19999')
    fs.writeFileSync(registryPath, JSON.stringify({
      version: 1,
      instances: { inst1: { id: 'inst1', root: instanceRoot } },
    }))
    const result = await discoverRunningInstances(registryPath)
    expect(result).toEqual([])
  })

  it('discovers a running instance with health check', async () => {
    // Start a real HTTP server that responds to health check
    const server = await startHealthServer()
    const port = (server.address() as { port: number }).port

    const instanceRoot = path.join(tmpDir, 'inst1')
    fs.mkdirSync(instanceRoot, { recursive: true })
    fs.writeFileSync(path.join(instanceRoot, 'api.port'), String(port))
    fs.writeFileSync(registryPath, JSON.stringify({
      version: 1,
      instances: { inst1: { id: 'inst1', root: instanceRoot } },
    }))

    const result = await discoverRunningInstances(registryPath)
    expect(result).toEqual([
      { id: 'inst1', root: instanceRoot, name: 'inst1', port, running: true },
    ])

    await closeServer(server)
  })

  it('uses instanceName from config.json when available', async () => {
    const server = await startHealthServer()
    const port = (server.address() as { port: number }).port

    const instanceRoot = path.join(tmpDir, 'inst1')
    fs.mkdirSync(instanceRoot, { recursive: true })
    fs.writeFileSync(path.join(instanceRoot, 'api.port'), String(port))
    fs.writeFileSync(path.join(instanceRoot, 'config.json'), JSON.stringify({ instanceName: 'My Server' }))
    fs.writeFileSync(registryPath, JSON.stringify({
      version: 1,
      instances: { inst1: { id: 'inst1', root: instanceRoot } },
    }))

    const result = await discoverRunningInstances(registryPath)
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('My Server')

    await closeServer(server)
  })

  it('discovers multiple running instances', async () => {
    const server1 = await startHealthServer()
    const port1 = (server1.address() as { port: number }).port
    const server2 = await startHealthServer()
    const port2 = (server2.address() as { port: number }).port

    const root1 = path.join(tmpDir, 'inst1')
    const root2 = path.join(tmpDir, 'inst2')
    fs.mkdirSync(root1, { recursive: true })
    fs.mkdirSync(root2, { recursive: true })
    fs.writeFileSync(path.join(root1, 'api.port'), String(port1))
    fs.writeFileSync(path.join(root2, 'api.port'), String(port2))

    fs.writeFileSync(registryPath, JSON.stringify({
      version: 1,
      instances: {
        inst1: { id: 'inst1', root: root1 },
        inst2: { id: 'inst2', root: root2 },
      },
    }))

    const result = await discoverRunningInstances(registryPath)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id).sort()).toEqual(['inst1', 'inst2'])

    await closeServer(server1)
    await closeServer(server2)
  })
})

function startHealthServer(): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.url === '/api/v1/system/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok' }))
      } else {
        res.writeHead(404)
        res.end()
      }
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}
