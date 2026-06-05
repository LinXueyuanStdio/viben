import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenStore } from '../auth/token-store.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('TokenStore', () => {
  let store: TokenStore;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'token-store-'));
    store = new TokenStore(join(tmpDir, 'tokens.json'));
    await store.load();
  });

  afterEach(async () => {
    store.destroy();
    await store.flush();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a token with generated ID', () => {
    const token = store.create({ role: 'admin', name: 'test-token', expire: '24h' });
    expect(token.id).toMatch(/^tok_/);
    expect(token.name).toBe('test-token');
    expect(token.role).toBe('admin');
    expect(token.revoked).toBe(false);
  });

  it('refresh deadline is 7 days from creation', () => {
    const token = store.create({ role: 'admin', name: 'test', expire: '24h' });
    const created = new Date(token.createdAt).getTime();
    const deadline = new Date(token.refreshDeadline).getTime();
    expect(deadline - created).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('gets a token by ID', () => {
    const created = store.create({ role: 'viewer', name: 'get-test', expire: '1h' });
    const found = store.get(created.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
  });

  it('returns undefined for unknown token ID', () => {
    expect(store.get('tok_nonexistent')).toBeUndefined();
  });

  it('revokes a token', () => {
    const token = store.create({ role: 'admin', name: 'revoke-test', expire: '24h' });
    store.revoke(token.id);
    expect(store.get(token.id)!.revoked).toBe(true);
  });

  it('lists all non-revoked tokens', () => {
    store.create({ role: 'admin', name: 'tok-1', expire: '24h' });
    store.create({ role: 'viewer', name: 'tok-2', expire: '24h' });
    const tok3 = store.create({ role: 'operator', name: 'tok-3', expire: '24h' });
    store.revoke(tok3.id);
    expect(store.list()).toHaveLength(2);
  });

  it('updates lastUsedAt', () => {
    const token = store.create({ role: 'admin', name: 'used-test', expire: '24h' });
    expect(token.lastUsedAt).toBeUndefined();
    store.updateLastUsed(token.id);
    expect(store.get(token.id)!.lastUsedAt).toBeDefined();
  });

  it('persists to disk and loads back', async () => {
    store.create({ role: 'admin', name: 'persist-test', expire: '24h' });
    await store.save();
    const store2 = new TokenStore(join(tmpDir, 'tokens.json'));
    await store2.load();
    expect(store2.list()).toHaveLength(1);
    expect(store2.list()[0].name).toBe('persist-test');
  });

  it('cleanup removes tokens past refresh deadline', () => {
    const token = store.create({ role: 'admin', name: 'expired', expire: '24h' });
    const stored = store.get(token.id)!;
    (stored as any).refreshDeadline = new Date(Date.now() - 1000).toISOString();
    store.cleanup();
    expect(store.get(token.id)).toBeUndefined();
  });
});
