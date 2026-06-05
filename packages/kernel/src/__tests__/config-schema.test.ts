import { describe, it, expect } from 'vitest'
import { ConfigSchema, ConfigManager } from '../core/config/config.js'

describe('ConfigSchema - runMode and autoStart', () => {
  const baseConfig = {
    defaultAgent: 'claude',
  }

  it('defaults runMode to foreground', () => {
    const result = ConfigSchema.parse(baseConfig)
    expect(result.runMode).toBe('foreground')
  })

  it('defaults autoStart to false', () => {
    const result = ConfigSchema.parse(baseConfig)
    expect(result.autoStart).toBe(false)
  })

  it('accepts runMode daemon', () => {
    const result = ConfigSchema.parse({ ...baseConfig, runMode: 'daemon' })
    expect(result.runMode).toBe('daemon')
  })

  it('accepts autoStart true', () => {
    const result = ConfigSchema.parse({ ...baseConfig, autoStart: true })
    expect(result.autoStart).toBe(true)
  })

  it('rejects invalid runMode', () => {
    expect(() => ConfigSchema.parse({ ...baseConfig, runMode: 'invalid' })).toThrow()
  })
})

describe('ConfigManager.get() immutability', () => {
  it('returns a clone — mutating result does not affect internal config', async () => {
    const mgr = new ConfigManager()
    // Manually set config via private field for isolated unit test
    ;(mgr as any).config = ConfigSchema.parse({
      defaultAgent: 'claude',
    })

    const config1 = mgr.get()
    config1.defaultAgent = 'MUTATED'

    const config2 = mgr.get()
    expect(config2.defaultAgent).toBe('claude')
  })
})

describe('ConfigSchema — removed legacy fields', () => {
  it('strips channels field from parsed output', () => {
    const result = ConfigSchema.safeParse({
      defaultAgent: 'claude',
      channels: { telegram: { botToken: 'tok', chatId: 0, enabled: true } },
    })
    expect(result.success).toBe(true)
    expect((result.data as any).channels).toBeUndefined()
  })

  it('strips top-level security field from parsed output', () => {
    const result = ConfigSchema.safeParse({
      defaultAgent: 'claude',
      security: { allowedUserIds: [], maxConcurrentSessions: 5 },
    })
    expect(result.success).toBe(true)
    expect((result.data as any).security).toBeUndefined()
  })

  it('strips tunnel field from parsed output', () => {
    const result = ConfigSchema.safeParse({
      defaultAgent: 'claude',
      tunnel: { enabled: true, port: 3100 },
    })
    expect(result.success).toBe(true)
    expect((result.data as any).tunnel).toBeUndefined()
  })
})

describe('ConfigSchema — core fields', () => {
  it('parses outputMode correctly', () => {
    const result = ConfigSchema.safeParse({ defaultAgent: 'claude', outputMode: 'high' })
    expect(result.success).toBe(true)
    expect(result.data!.outputMode).toBe('high')
  })

  it('parses agentSwitch.labelHistory correctly', () => {
    const result = ConfigSchema.safeParse({
      defaultAgent: 'claude',
      agentSwitch: { labelHistory: false },
    })
    expect(result.success).toBe(true)
    expect(result.data!.agentSwitch.labelHistory).toBe(false)
  })

  it('defaults agentSwitch.labelHistory to true', () => {
    const result = ConfigSchema.safeParse({ defaultAgent: 'claude' })
    expect(result.success).toBe(true)
    expect(result.data!.agentSwitch.labelHistory).toBe(true)
  })
})
