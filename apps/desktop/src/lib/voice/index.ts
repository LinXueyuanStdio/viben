// apps/desktop/src/lib/voice/index.ts

// 共享音频流
export { sharedAudioStream } from './shared-audio-stream';

// 唤醒词 (Rust backend via Tauri commands)
export type { WakeWordDetectionEvent } from '@/hooks/use-wake-word';

// Vocal Bridge 客户端
export { vocalBridgeClient, VocalBridgeClient } from './vocal-bridge-client';
export type {
  VocalBridgeState,
  TranscriptEvent,
} from './vocal-bridge-client';

// 音效
export { playSound, preloadSounds, isSoundLoaded } from './audio-feedback';

// 安全配置
export {
  saveApiKey,
  loadApiKey,
  saveVoiceConfig,
  loadVoiceConfig,
} from './secure-config';
