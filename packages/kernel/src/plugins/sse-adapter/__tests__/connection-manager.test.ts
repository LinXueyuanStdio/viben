import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionManager } from '../connection-manager.js';
import type { ServerResponse } from 'node:http';

function mockResponse(): ServerResponse {
  return {
    write: vi.fn().mockReturnValue(true),
    end: vi.fn(),
    on: vi.fn(),
    writableEnded: false,
  } as any;
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => { manager = new ConnectionManager(); });

  it('adds connection and retrieves by session', () => {
    const res = mockResponse();
    const conn = manager.addConnection('sess_1', 'tok_1', res);
    expect(conn.id).toBeDefined();
    expect(manager.getConnectionsBySession('sess_1')).toHaveLength(1);
  });

  it('supports multiple connections per session', () => {
    manager.addConnection('sess_1', 'tok_1', mockResponse());
    manager.addConnection('sess_1', 'tok_2', mockResponse());
    expect(manager.getConnectionsBySession('sess_1')).toHaveLength(2);
  });

  it('removes a connection', () => {
    const conn = manager.addConnection('sess_1', 'tok_1', mockResponse());
    manager.removeConnection(conn.id);
    expect(manager.getConnectionsBySession('sess_1')).toHaveLength(0);
  });

  it('broadcasts to session connections only', () => {
    const res1 = mockResponse();
    const res2 = mockResponse();
    manager.addConnection('sess_1', 'tok_1', res1);
    manager.addConnection('sess_2', 'tok_2', res2);
    manager.broadcast('sess_1', 'event: test\ndata: hello\n\n');
    expect(res1.write).toHaveBeenCalled();
    expect(res2.write).not.toHaveBeenCalled();
  });

  it('disconnects by token', () => {
    const res1 = mockResponse();
    const res2 = mockResponse();
    manager.addConnection('sess_1', 'tok_1', res1);
    manager.addConnection('sess_2', 'tok_1', res2);
    manager.addConnection('sess_3', 'tok_2', mockResponse());
    manager.disconnectByToken('tok_1');
    expect(res1.end).toHaveBeenCalled();
    expect(res2.end).toHaveBeenCalled();
    expect(manager.getConnectionsBySession('sess_1')).toHaveLength(0);
    expect(manager.getConnectionsBySession('sess_3')).toHaveLength(1);
  });

  it('returns empty for unknown session', () => {
    expect(manager.getConnectionsBySession('unknown')).toHaveLength(0);
  });
});
