import { describe, it, expect } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './json-test-utils.js'

describe('captureJsonOutput', () => {
  it('captures stdout and exit code from jsonSuccess', async () => {
    const { jsonSuccess } = await import('../../../output.js')
    const result = await captureJsonOutput(async () => {
      jsonSuccess({ test: true })
    })
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.success).toBe(true)
    expect(parsed.data.test).toBe(true)
  })

  it('captures stdout and exit code from jsonError', async () => {
    const { jsonError, ErrorCodes } = await import('../../../output.js')
    const result = await captureJsonOutput(async () => {
      jsonError(ErrorCodes.UNKNOWN_ERROR, 'test error')
    })
    expect(result.exitCode).toBe(1)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.success).toBe(false)
    expect(parsed.error.code).toBe('UNKNOWN_ERROR')
  })

  it('rethrows non-exit errors', async () => {
    await expect(captureJsonOutput(async () => {
      throw new Error('real error')
    })).rejects.toThrow('real error')
  })
})

describe('expectValidJsonSuccess', () => {
  it('returns data for valid success output', () => {
    const data = expectValidJsonSuccess('{"success":true,"data":{"x":1}}')
    expect(data).toEqual({ x: 1 })
  })

  it('throws for error output', () => {
    expect(() => expectValidJsonSuccess('{"success":false,"error":{"code":"X","message":"m"}}')).toThrow()
  })
})

describe('expectValidJsonError', () => {
  it('returns error for valid error output', () => {
    const err = expectValidJsonError('{"success":false,"error":{"code":"FOO","message":"bar"}}', 'FOO')
    expect(err).toEqual({ code: 'FOO', message: 'bar' })
  })

  it('throws when code does not match', () => {
    expect(() => expectValidJsonError('{"success":false,"error":{"code":"FOO","message":"bar"}}', 'BAR')).toThrow()
  })
})
