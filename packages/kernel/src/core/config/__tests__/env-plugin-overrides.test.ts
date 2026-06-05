import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../config.js';

describe('applyEnvToPluginSettings', () => {
  const mockSettingsManager = () => ({
    updatePluginSettings: vi.fn().mockResolvedValue(undefined),
    loadSettings: vi.fn().mockResolvedValue({}),
  });

  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = {};
    for (const key of [
      'VIBEN_TUNNEL_ENABLED', 'VIBEN_TUNNEL_PORT', 'VIBEN_TUNNEL_PROVIDER',
      'VIBEN_API_PORT', 'VIBEN_SPEECH_STT_PROVIDER', 'VIBEN_SPEECH_GROQ_API_KEY',
      'VIBEN_TELEGRAM_BOT_TOKEN', 'VIBEN_TELEGRAM_CHAT_ID',
      'VIBEN_DISCORD_BOT_TOKEN', 'VIBEN_DISCORD_GUILD_ID',
      'VIBEN_SLACK_BOT_TOKEN', 'VIBEN_SLACK_APP_TOKEN', 'VIBEN_SLACK_SIGNING_SECRET',
    ]) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('writes tunnel env vars to tunnel plugin settings', async () => {
    process.env.VIBEN_TUNNEL_ENABLED = 'false';
    process.env.VIBEN_TUNNEL_PROVIDER = 'ngrok';

    const sm = mockSettingsManager();
    const cm = new ConfigManager('/tmp/nonexistent-config.json');
    await cm.applyEnvToPluginSettings(sm as any);

    expect(sm.updatePluginSettings).toHaveBeenCalledWith(
      '@viben/tunnel',
      { enabled: false },
    );
    expect(sm.updatePluginSettings).toHaveBeenCalledWith(
      '@viben/tunnel',
      { provider: 'ngrok' },
    );
  });

  it('transforms string to number for port env vars', async () => {
    process.env.VIBEN_API_PORT = '8080';

    const sm = mockSettingsManager();
    const cm = new ConfigManager('/tmp/nonexistent-config.json');
    await cm.applyEnvToPluginSettings(sm as any);

    expect(sm.updatePluginSettings).toHaveBeenCalledWith(
      '@viben/api-server',
      { port: 8080 },
    );
  });

  it('does not write when env var is not set', async () => {
    const sm = mockSettingsManager();
    const cm = new ConfigManager('/tmp/nonexistent-config.json');
    await cm.applyEnvToPluginSettings(sm as any);

    expect(sm.updatePluginSettings).not.toHaveBeenCalled();
  });

  it('writes telegram env vars with correct transforms', async () => {
    process.env.VIBEN_TELEGRAM_BOT_TOKEN = 'my-token';
    process.env.VIBEN_TELEGRAM_CHAT_ID = '-1001234';

    const sm = mockSettingsManager();
    const cm = new ConfigManager('/tmp/nonexistent-config.json');
    await cm.applyEnvToPluginSettings(sm as any);

    expect(sm.updatePluginSettings).toHaveBeenCalledWith(
      '@viben/telegram',
      { botToken: 'my-token' },
    );
    expect(sm.updatePluginSettings).toHaveBeenCalledWith(
      '@viben/telegram',
      { chatId: -1001234 },
    );
  });

  it('writes discord env vars to discord plugin settings', async () => {
    process.env.VIBEN_DISCORD_BOT_TOKEN = 'discord-bot-token';
    process.env.VIBEN_DISCORD_GUILD_ID = 'my-guild-id';

    const sm = mockSettingsManager();
    const cm = new ConfigManager('/tmp/nonexistent-config.json');
    await cm.applyEnvToPluginSettings(sm as any);

    expect(sm.updatePluginSettings).toHaveBeenCalledWith(
      '@viben/discord-adapter',
      { botToken: 'discord-bot-token' },
    );
    expect(sm.updatePluginSettings).toHaveBeenCalledWith(
      '@viben/discord-adapter',
      { guildId: 'my-guild-id' },
    );
  });

  it('writes slack env vars to slack plugin settings', async () => {
    process.env.VIBEN_SLACK_BOT_TOKEN = 'xoxb-slack-bot-token';
    process.env.VIBEN_SLACK_APP_TOKEN = 'xapp-slack-app-token';
    process.env.VIBEN_SLACK_SIGNING_SECRET = 'slack-signing-secret';

    const sm = mockSettingsManager();
    const cm = new ConfigManager('/tmp/nonexistent-config.json');
    await cm.applyEnvToPluginSettings(sm as any);

    expect(sm.updatePluginSettings).toHaveBeenCalledWith(
      '@viben/slack-adapter',
      { botToken: 'xoxb-slack-bot-token' },
    );
    expect(sm.updatePluginSettings).toHaveBeenCalledWith(
      '@viben/slack-adapter',
      { appToken: 'xapp-slack-app-token' },
    );
    expect(sm.updatePluginSettings).toHaveBeenCalledWith(
      '@viben/slack-adapter',
      { signingSecret: 'slack-signing-secret' },
    );
  });
});
