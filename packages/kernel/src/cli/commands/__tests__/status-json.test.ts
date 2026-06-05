import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess } from './helpers/json-test-utils.js'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

describe('status --json', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-status-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('outputs JSON with instance info when daemon is not running', async () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ instanceName: 'test' }))

    const { cmdStatus } = await import('../status.js')
    const result = await captureJsonOutput(async () => {
      await cmdStatus(['--json'], tmpDir)
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('name')
    expect(data).toHaveProperty('status')
    expect(data.status).toBe('offline')
    expect(data.pid).toBeNull()
  })
})
