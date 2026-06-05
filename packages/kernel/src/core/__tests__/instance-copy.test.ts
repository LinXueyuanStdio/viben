import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { copyInstance } from '../instance/instance-copy.js';

describe('copyInstance', () => {
  let srcDir: string;
  let dstDir: string;

  beforeEach(() => {
    srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-copy-src-'));
    dstDir = path.join(os.tmpdir(), `viben-copy-dst-${Date.now()}`);
  });

  afterEach(() => {
    fs.rmSync(srcDir, { recursive: true, force: true });
    if (fs.existsSync(dstDir)) {
      fs.rmSync(dstDir, { recursive: true, force: true });
    }
  });

  it('strips migrated plugin sections from config.json', async () => {
    fs.writeFileSync(path.join(srcDir, 'config.json'), JSON.stringify({
      instanceName: 'Original',
      defaultAgent: 'claude',
      workspace: { baseDir: '~/workspace' },
      logging: { level: 'info' },
      security: { allowedUserIds: ['123'], maxConcurrentSessions: 10 },
      tunnel: { enabled: true, provider: 'viben', port: 3100 },
      api: { port: 21420, host: '127.0.0.1' },
      speech: { stt: { provider: 'groq' } },
      usage: { enabled: true },
    }));

    await copyInstance(srcDir, dstDir, { inheritableKeys: {} });

    const copied = JSON.parse(fs.readFileSync(path.join(dstDir, 'config.json'), 'utf-8'));
    expect(copied.instanceName).toBeUndefined();
    expect(copied.security).toBeUndefined();
    expect(copied.tunnel).toBeUndefined();
    expect(copied.api).toBeUndefined();
    expect(copied.speech).toBeUndefined();
    expect(copied.usage).toBeUndefined();
    expect(copied.defaultAgent).toBe('claude');
    expect(copied.workspace?.baseDir).toBeUndefined();
    expect(copied.logging.level).toBe('info');
  });

  it('strips plugin-owned channel fields but keeps core channel fields', async () => {
    fs.writeFileSync(path.join(srcDir, 'config.json'), JSON.stringify({
      defaultAgent: 'claude',
      channels: {
        telegram: { enabled: true, botToken: 'secret', chatId: 123, outputMode: 'high' },
        discord: { enabled: false, botToken: 'discord-token', outputMode: 'low' },
      },
    }));

    await copyInstance(srcDir, dstDir, { inheritableKeys: {} });

    const copied = JSON.parse(fs.readFileSync(path.join(dstDir, 'config.json'), 'utf-8'));
    expect(copied.channels.telegram.outputMode).toBe('high');
    expect(copied.channels.telegram.enabled).toBe(true);
    expect(copied.channels.telegram.botToken).toBeUndefined();
    expect(copied.channels.telegram.chatId).toBeUndefined();
    expect(copied.channels.discord.outputMode).toBe('low');
    expect(copied.channels.discord.botToken).toBeUndefined();
  });

  it('handles config.json with no migrated sections', async () => {
    fs.writeFileSync(path.join(srcDir, 'config.json'), JSON.stringify({
      defaultAgent: 'claude',
      logging: { level: 'warn' },
    }));

    await copyInstance(srcDir, dstDir, { inheritableKeys: {} });

    const copied = JSON.parse(fs.readFileSync(path.join(dstDir, 'config.json'), 'utf-8'));
    expect(copied.defaultAgent).toBe('claude');
    expect(copied.logging.level).toBe('warn');
  });

  it('handles missing config.json gracefully', async () => {
    await copyInstance(srcDir, dstDir, { inheritableKeys: {} });
    expect(fs.existsSync(path.join(dstDir, 'config.json'))).toBe(false);
  });

  it('handles empty channels object', async () => {
    fs.writeFileSync(path.join(srcDir, 'config.json'), JSON.stringify({
      defaultAgent: 'claude',
      channels: {},
    }));

    await copyInstance(srcDir, dstDir, { inheritableKeys: {} });

    const copied = JSON.parse(fs.readFileSync(path.join(dstDir, 'config.json'), 'utf-8'));
    expect(copied.channels).toEqual({});
  });

  it('copies plugin settings filtered by inheritableKeys', async () => {
    fs.writeFileSync(path.join(srcDir, 'config.json'), JSON.stringify({ defaultAgent: 'claude' }));
    const pluginDir = path.join(srcDir, 'plugins', 'data', '@viben', 'security');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'settings.json'), JSON.stringify({
      allowedUserIds: ['123'],
      maxConcurrentSessions: 10,
      sessionTimeoutMinutes: 30,
    }));

    await copyInstance(srcDir, dstDir, {
      inheritableKeys: { '@viben/security': ['allowedUserIds', 'maxConcurrentSessions'] },
    });

    const copiedSettings = JSON.parse(fs.readFileSync(
      path.join(dstDir, 'plugins', 'data', '@viben', 'security', 'settings.json'), 'utf-8',
    ));
    expect(copiedSettings.allowedUserIds).toEqual(['123']);
    expect(copiedSettings.maxConcurrentSessions).toBe(10);
    expect(copiedSettings.sessionTimeoutMinutes).toBeUndefined();
  });
});
