import { describe, it, expect } from 'vitest'
import { applyMigrations } from '../config-migrations.js'

describe('Config Migrations', () => {
  describe('migration: add-instance-name', () => {
    it('adds instanceName "Main" when missing', () => {
      const raw: Record<string, unknown> = { defaultAgent: 'claude' }
      applyMigrations(raw)
      expect(raw.instanceName).toBe('Main')
    })

    it('does not overwrite existing instanceName', () => {
      const raw: Record<string, unknown> = { defaultAgent: 'claude', instanceName: 'My Instance' }
      applyMigrations(raw)
      expect(raw.instanceName).toBe('My Instance')
    })
  })
})
