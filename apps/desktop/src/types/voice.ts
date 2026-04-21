// apps/desktop/src/types/voice.ts

/** 语音连接状态 */
export type VoiceConnectionState =
  | 'idle'        // 未连接
  | 'connecting'  // 正在连接
  | 'listening'   // 监听用户说话 (静默计时中)
  | 'processing'  // 等待 Agent 响应 (静默计时暂停)
  | 'speaking'    // Agent 正在说话 (静默计时暂停)
  | 'error';      // 错误状态

/** 唤醒词检测状态 */
export type WakeWordState =
  | 'inactive'    // 未启动
  | 'loading'     // 加载模型中
  | 'listening'   // 正在监听唤醒词
  | 'detected';   // 检测到唤醒词

/** 语音配置 */
export interface VoiceConfig {
  // API Keys
  vocalBridgeApiKey: string;
  vocalBridgeAgentId: string;

  // 唤醒词
  wakeWord: string;
  wakeWordModelPath?: string;
  builtinWakeWord?: string;
  wakeWordThreshold: number;

  // 行为配置
  autoStartOnLaunch: boolean;
  silenceTimeout: number;

  // 音效
  enableSoundEffects: boolean;
}

/** Agent 回复数据 */
export interface AgentResponse {
  text: string;
  charCount: number;
  isStreaming: boolean;
  showPopup: boolean;
  popupOpacity: number;
}

/** 语音配置文件格式 (YAML) - API Key 不存储在此，使用 Tauri secure-storage */
export interface VoiceConfigFile {
  wake_word: string;
  wake_word_model_path?: string | null;
  builtin_wake_word?: string;
  wake_word_threshold: number;
  auto_start_on_launch: boolean;
  silence_timeout: number;
  enable_sound_effects: boolean;
}

/** 默认配置 */
export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  vocalBridgeApiKey: '',
  vocalBridgeAgentId: '',
  wakeWord: '你好微本',
  wakeWordModelPath: undefined,
  builtinWakeWord: 'hey_jarvis',
  wakeWordThreshold: 0.5,
  autoStartOnLaunch: false,
  silenceTimeout: 30,
  enableSoundEffects: true,
};