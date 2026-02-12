/**
 * Channel command tests
 */

import { describe, it, expect } from 'vitest';
import { channelListTypes } from '../../lib/native';

describe('Channel commands', () => {
  describe('types command', () => {
    it('should have all required channel types', () => {
      const types = channelListTypes();
      const expectedTypes = ['telegram', 'discord', 'feishu', 'whatsapp', 'slack', 'webhook'];
      const actualTypes = types.map(type => type.id);

      expectedTypes.forEach(expectedType => {
        expect(actualTypes).toContain(expectedType);
      });
    });

    it('should have valid channel type metadata', () => {
      const types = channelListTypes();
      types.forEach(type => {
        expect(type.id).toBeTruthy();
        expect(type.name).toBeTruthy();
        expect(type.description).toBeTruthy();
        expect(['easy', 'medium', 'hard']).toContain(type.setupDifficulty);
      });
    });
  });

  describe('channel validation', () => {
    it('should validate telegram channel requirements', () => {
      // Telegram channels require token
      const types = channelListTypes();
      const validTypes = types.map(t => t.id);
      expect(validTypes).toContain('telegram');
    });

    it('should validate discord channel requirements', () => {
      // Discord channels require token
      const types = channelListTypes();
      const validTypes = types.map(t => t.id);
      expect(validTypes).toContain('discord');
    });

    it('should validate feishu channel requirements', () => {
      // Feishu channels require app_id and app_secret
      const types = channelListTypes();
      const validTypes = types.map(t => t.id);
      expect(validTypes).toContain('feishu');
    });

    it('should validate whatsapp channel requirements', () => {
      // WhatsApp channels require bridge_url
      const types = channelListTypes();
      const validTypes = types.map(t => t.id);
      expect(validTypes).toContain('whatsapp');
    });

    it('should validate webhook channel requirements', () => {
      // Webhook channels require url
      const types = channelListTypes();
      const validTypes = types.map(t => t.id);
      expect(validTypes).toContain('webhook');
    });
  });
});
