import { describe, it, expect } from 'vitest';
import { getRoleScopes, hasScope, ROLES, isValidRole } from '../auth/roles.js';

describe('roles', () => {
  it('admin has wildcard scope', () => {
    expect(getRoleScopes('admin')).toEqual(['*']);
  });

  it('operator has session and agent scopes but not config:write', () => {
    const scopes = getRoleScopes('operator');
    expect(scopes).toContain('sessions:read');
    expect(scopes).toContain('sessions:write');
    expect(scopes).toContain('sessions:prompt');
    expect(scopes).toContain('sessions:permission');
    expect(scopes).toContain('agents:read');
    expect(scopes).toContain('commands:execute');
    expect(scopes).toContain('system:health');
    expect(scopes).not.toContain('config:write');
    expect(scopes).not.toContain('system:admin');
    expect(scopes).not.toContain('auth:manage');
  });

  it('viewer has read-only scopes', () => {
    const scopes = getRoleScopes('viewer');
    expect(scopes).toContain('sessions:read');
    expect(scopes).toContain('agents:read');
    expect(scopes).toContain('system:health');
    expect(scopes).not.toContain('sessions:write');
    expect(scopes).not.toContain('sessions:prompt');
  });

  it('hasScope checks wildcard', () => {
    expect(hasScope(['*'], 'anything:here')).toBe(true);
  });

  it('hasScope checks exact match', () => {
    expect(hasScope(['sessions:read', 'agents:read'], 'sessions:read')).toBe(true);
    expect(hasScope(['sessions:read'], 'sessions:write')).toBe(false);
  });

  it('isValidRole validates role names', () => {
    expect(isValidRole('admin')).toBe(true);
    expect(isValidRole('operator')).toBe(true);
    expect(isValidRole('viewer')).toBe(true);
    expect(isValidRole('superadmin')).toBe(false);
  });
});
