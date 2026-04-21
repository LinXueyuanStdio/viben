// apps/desktop/src/lib/voice/secure-config.ts
import { Store } from '@tauri-apps/plugin-store';
import { homeDir } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import * as yaml from 'js-yaml';
import type { VoiceConfig, VoiceConfigFile } from '@/types/voice';
import { DEFAULT_VOICE_CONFIG } from '@/types/voice';

const SECURE_STORE_PATH = '.voice-secrets.dat';
const CONFIG_FILE_NAME = 'voice.yaml';

let secureStore: Store | null = null;

/**
 * Construct path with proper separator.
 */
function joinPath(base: string, ...segments: string[]): string {
  const separator = base.endsWith('/') || base.endsWith('\\') ? '' : '/';
  return base + separator + segments.join('/');
}

async function getSecureStore(): Promise<Store> {
  if (!secureStore) {
    secureStore = await Store.load(SECURE_STORE_PATH);
  }
  return secureStore;
}

async function getConfigPath(): Promise<string> {
  const home = await homeDir();
  return joinPath(home, '.viben', CONFIG_FILE_NAME);
}

/** 保存 API Key (加密) */
export async function saveApiKey(key: string, value: string): Promise<void> {
  const store = await getSecureStore();
  await store.set(key, value);
  await store.save();
}

/** 读取 API Key (解密) */
export async function loadApiKey(key: string): Promise<string | null> {
  const store = await getSecureStore();
  return (await store.get<string>(key)) ?? null;
}

/** 保存普通配置到 YAML */
export async function saveVoiceConfig(config: VoiceConfig): Promise<void> {
  const configPath = await getConfigPath();
  const home = await homeDir();
  const vibenDir = joinPath(home, '.viben');

  if (!(await exists(vibenDir))) {
    await mkdir(vibenDir);
  }

  const fileConfig: VoiceConfigFile = {
    wake_word: config.wakeWord,
    wake_word_model_path: config.wakeWordModelPath ?? null,
    builtin_wake_word: config.builtinWakeWord ?? 'hey_jarvis',
    wake_word_threshold: config.wakeWordThreshold,
    auto_start_on_launch: config.autoStartOnLaunch,
    silence_timeout: config.silenceTimeout,
    enable_sound_effects: config.enableSoundEffects,
  };

  const content = yaml.dump(fileConfig, {
    indent: 2,
    lineWidth: -1,
  });
  await writeTextFile(configPath, content);

  // API Key 单独加密存储
  if (config.vocalBridgeApiKey) {
    await saveApiKey('vocal_bridge_api_key', config.vocalBridgeApiKey);
  }
}

/** 从 YAML 和安全存储加载配置 */
export async function loadVoiceConfig(): Promise<VoiceConfig> {
  const configPath = await getConfigPath();

  let fileConfig: Partial<VoiceConfigFile> = {};
  if (await exists(configPath)) {
    const content = await readTextFile(configPath);
    const loaded = yaml.load(content);
    // Validate parsed result is a non-null object
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
      fileConfig = loaded as VoiceConfigFile;
    }
  }

  const apiKey = await loadApiKey('vocal_bridge_api_key');

  return {
    vocalBridgeApiKey: apiKey ?? '',
    wakeWord: fileConfig.wake_word ?? DEFAULT_VOICE_CONFIG.wakeWord,
    wakeWordModelPath: fileConfig.wake_word_model_path ?? undefined,
    builtinWakeWord: fileConfig.builtin_wake_word ?? DEFAULT_VOICE_CONFIG.builtinWakeWord,
    wakeWordThreshold: fileConfig.wake_word_threshold ?? DEFAULT_VOICE_CONFIG.wakeWordThreshold,
    autoStartOnLaunch: fileConfig.auto_start_on_launch ?? DEFAULT_VOICE_CONFIG.autoStartOnLaunch,
    silenceTimeout: fileConfig.silence_timeout ?? DEFAULT_VOICE_CONFIG.silenceTimeout,
    enableSoundEffects: fileConfig.enable_sound_effects ?? DEFAULT_VOICE_CONFIG.enableSoundEffects,
  };
}
