import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { workspaceRoute } from '../routes/workspace.js'

async function buildApp(opts: { id: string; name: string; directory: string; version: string }) {
  const app = Fastify()
  await app.register(workspaceRoute, opts)
  await app.ready()
  return app
}

describe('GET /workspace', () => {
  it('returns workspace identity info', async () => {
    const app = await buildApp({
      id: 'main', name: 'Main', directory: '/Users/user', version: '2026.401.1',
    })
    const res = await app.inject({ method: 'GET', url: '/workspace' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({
      id: 'main', name: 'Main', directory: '/Users/user', version: '2026.401.1',
    })
  })

  it('returns all four fields', async () => {
    const app = await buildApp({
      id: 'proj', name: 'My Project', directory: '/Users/user/proj', version: '1.0.0',
    })
    const res = await app.inject({ method: 'GET', url: '/workspace' })
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('name')
    expect(body).toHaveProperty('directory')
    expect(body).toHaveProperty('version')
  })
})
