import { describe, it, expect } from 'vitest';
import { EventBuffer } from '../event-buffer.js';

describe('EventBuffer', () => {
  it('stores events per session', () => {
    const buffer = new EventBuffer(100);
    buffer.push('sess_1', { id: 'evt_1', data: 'hello' });
    buffer.push('sess_1', { id: 'evt_2', data: 'world' });
    buffer.push('sess_2', { id: 'evt_3', data: 'other' });
    expect(buffer.getSince('sess_1', undefined)).toHaveLength(2);
  });

  it('returns events since a given ID', () => {
    const buffer = new EventBuffer(100);
    buffer.push('sess_1', { id: 'evt_1', data: 'a' });
    buffer.push('sess_1', { id: 'evt_2', data: 'b' });
    buffer.push('sess_1', { id: 'evt_3', data: 'c' });
    const events = buffer.getSince('sess_1', 'evt_1');
    expect(events).toHaveLength(2);
    expect(events![0].id).toBe('evt_2');
  });

  it('returns empty for unknown session', () => {
    const buffer = new EventBuffer(100);
    expect(buffer.getSince('unknown', undefined)).toHaveLength(0);
  });

  it('evicts oldest when full', () => {
    const buffer = new EventBuffer(3);
    buffer.push('sess_1', { id: 'evt_1', data: 'a' });
    buffer.push('sess_1', { id: 'evt_2', data: 'b' });
    buffer.push('sess_1', { id: 'evt_3', data: 'c' });
    buffer.push('sess_1', { id: 'evt_4', data: 'd' });
    const all = buffer.getSince('sess_1', undefined);
    expect(all).toHaveLength(3);
    expect(all![0].id).toBe('evt_2');
  });

  it('returns null when requested ID was evicted', () => {
    const buffer = new EventBuffer(2);
    buffer.push('sess_1', { id: 'evt_1', data: 'a' });
    buffer.push('sess_1', { id: 'evt_2', data: 'b' });
    buffer.push('sess_1', { id: 'evt_3', data: 'c' });
    expect(buffer.getSince('sess_1', 'evt_1')).toBeNull();
  });

  it('cleans up session buffer', () => {
    const buffer = new EventBuffer(100);
    buffer.push('sess_1', { id: 'evt_1', data: 'a' });
    buffer.cleanup('sess_1');
    expect(buffer.getSince('sess_1', undefined)).toHaveLength(0);
  });
});
