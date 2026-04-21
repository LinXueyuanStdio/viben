# 语音交互功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Viben Desktop 添加语音交互能力，支持唤醒词激活、实时语音对话、炫彩波浪动画和流式字幕显示。

**Architecture:** 使用 openWakeWord (WASM + ONNX) 进行本地唤醒词检测，Vocal Bridge SDK 处理 WebRTC 语音通信，SharedAudioStream 统一管理麦克风资源，voice-store 管理状态，PixiJS Canvas 渲染波浪和字幕，DOM + Streamdown 渲染 AI 弹窗。Python 训练项目位于 `backend/wakeword`，用于训练自定义唤醒词模型。

**Tech Stack:** openwakeword-wasm-browser, onnxruntime-web, Vocal Bridge SDK, Zustand, PixiJS, streamdown, Tauri secure-storage

**Spec:** `docs/superpowers/specs/2026-04-21-voice-agent-design.md`

---

## 文件结构

### 前端 (apps/desktop)

| 文件路径 | 职责 | 操作 |
|---------|------|------|
| `apps/desktop/src/types/voice.ts` | 语音相关类型定义 | 新建 |
| `apps/desktop/src/stores/voice-store.ts` | 语音状态管理 | 新建 |
| `apps/desktop/src/lib/voice/secure-config.ts` | API Key 加密存储 | 新建 |
| `apps/desktop/src/lib/voice/shared-audio-stream.ts` | 共享音频流管理 | 新建 |
| `apps/desktop/src/lib/voice/audio-feedback.ts` | 提示音播放 | 新建 |
| `apps/desktop/src/lib/voice/vocal-bridge-client.ts` | Vocal Bridge 封装 | 新建 |
| `apps/desktop/src/lib/voice/wake-word-engine.ts` | openWakeWord WASM 封装 | 新建 |
| `apps/desktop/src/lib/voice/index.ts` | 模块导出 | 新建 |
| `apps/desktop/src/hooks/use-shared-audio.ts` | 共享音频 Hook | 新建 |
| `apps/desktop/src/hooks/use-voice-agent.ts` | Voice Agent Hook | 新建 |
| `apps/desktop/src/hooks/use-wake-word.ts` | 唤醒词检测 Hook | 新建 |
| `apps/desktop/src/components/settings/settings-voice.tsx` | 语音设置页 | 新建 |
| `apps/desktop/src/pages/settings.tsx` | 添加 voice section | 修改 |
| `apps/desktop/src/components/overlay/layers/wave-layer.tsx` | 支持凹形多层波浪 | 修改 |
| `apps/desktop/src/components/overlay/layers/voice-subtitle-layer.tsx` | 语音字幕层 (Canvas) | 新建 |
| `apps/desktop/src/components/overlay/agent-popup.tsx` | AI 回复弹窗 (DOM + Streamdown) | 新建 |
| `apps/desktop/public/openwakeword/models/` | ONNX 模型文件目录 | 新建 |

### 后端训练 (backend/wakeword)

| 文件路径 | 职责 | 操作 |
|---------|------|------|
| `backend/wakeword/README.md` | 训练项目文档 | 新建 |
| `backend/wakeword/pyproject.toml` | Python 项目配置 | 新建 |
| `backend/wakeword/configs/ni_hao_wei_ben.yaml` | "你好微本"训练配置 | 新建 |
| `backend/wakeword/src/wakeword_trainer/__init__.py` | 模块入口 | 新建 |
| `backend/wakeword/src/wakeword_trainer/train.py` | 训练主脚本 | 新建 |
| `backend/wakeword/src/wakeword_trainer/generate.py` | 合成语音生成 | 新建 |
| `backend/wakeword/src/wakeword_trainer/export.py` | ONNX 导出 | 新建 |

---

## Task 1: 类型定义

**Files:**
- Create: `apps/desktop/src/types/voice.ts`

- [ ] **Step 1: 创建语音类型定义文件**

```typescript
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

/** 语音配置文件格式 (YAML) */
export interface VoiceConfigFile {
  wake_word: string;
  wake_word_model_path: string | null;
  builtin_wake_word: string;
  wake_word_threshold: number;
  auto_start_on_launch: boolean;
  silence_timeout: number;
  enable_sound_effects: boolean;
}

/** 默认配置 */
export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  vocalBridgeApiKey: '',
  wakeWord: '你好微本',
  wakeWordModelPath: undefined,
  builtinWakeWord: 'hey_jarvis',
  wakeWordThreshold: 0.5,
  autoStartOnLaunch: false,
  silenceTimeout: 30,
  enableSoundEffects: true,
};
```

- [ ] **Step 2: 验证文件创建**

Run: `cat apps/desktop/src/types/voice.ts | head -20`
Expected: 显示文件前 20 行

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/types/voice.ts
git commit -m "feat(voice): add voice type definitions"
```

---

## Task 2: Voice Store 状态管理

**Files:**
- Create: `apps/desktop/src/stores/voice-store.ts`

- [ ] **Step 1: 创建 voice-store**

```typescript
// apps/desktop/src/stores/voice-store.ts
import { create } from "zustand";
import type {
  VoiceConnectionState,
  WakeWordState,
  VoiceConfig,
  AgentResponse,
  DEFAULT_VOICE_CONFIG,
} from "@/types/voice";

interface VoiceState {
  // 连接状态
  connectionState: VoiceConnectionState;
  wakeWordState: WakeWordState;

  // 配置
  config: VoiceConfig;
  configLoaded: boolean;

  // 数据
  userTranscript: string;
  agentResponse: AgentResponse;
  error: string | null;

  // 静默计时
  silenceStartTime: number | null;
}

interface VoiceActions {
  // 状态控制
  setConnectionState: (state: VoiceConnectionState) => void;
  setWakeWordState: (state: WakeWordState) => void;
  setError: (error: string | null) => void;

  // 配置
  setConfig: (config: Partial<VoiceConfig>) => void;
  setConfigLoaded: (loaded: boolean) => void;

  // 字幕
  updateUserTranscript: (text: string) => void;
  clearUserTranscript: () => void;

  // Agent 回复
  appendAgentResponse: (chunk: string) => void;
  clearAgentResponse: () => void;
  setPopupOpacity: (opacity: number) => void;

  // 静默计时
  startSilenceTimer: () => void;
  resetSilenceTimer: () => void;

  // 重置
  reset: () => void;
}

const initialAgentResponse: AgentResponse = {
  text: '',
  charCount: 0,
  isStreaming: false,
  showPopup: false,
  popupOpacity: 1,
};

const initialState: VoiceState = {
  connectionState: 'idle',
  wakeWordState: 'inactive',
  config: DEFAULT_VOICE_CONFIG,
  configLoaded: false,
  userTranscript: '',
  agentResponse: initialAgentResponse,
  error: null,
  silenceStartTime: null,
};

export const useVoiceStore = create<VoiceState & { actions: VoiceActions }>((set, get) => ({
  ...initialState,

  actions: {
    setConnectionState: (connectionState) => set({ connectionState }),
    setWakeWordState: (wakeWordState) => set({ wakeWordState }),
    setError: (error) => set({ error }),

    setConfig: (config) => set((s) => ({
      config: { ...s.config, ...config },
    })),
    setConfigLoaded: (configLoaded) => set({ configLoaded }),

    updateUserTranscript: (text) => set({ userTranscript: text }),
    clearUserTranscript: () => set({ userTranscript: '' }),

    appendAgentResponse: (chunk) => set((s) => {
      const newText = s.agentResponse.text + chunk;
      const charCount = newText.length;
      return {
        agentResponse: {
          ...s.agentResponse,
          text: newText,
          charCount,
          isStreaming: true,
          showPopup: charCount >= 400,
        },
      };
    }),

    clearAgentResponse: () => set({ agentResponse: initialAgentResponse }),

    setPopupOpacity: (opacity) => set((s) => ({
      agentResponse: { ...s.agentResponse, popupOpacity: opacity },
    })),

    startSilenceTimer: () => set({ silenceStartTime: Date.now() }),
    resetSilenceTimer: () => set({ silenceStartTime: null }),

    reset: () => set(initialState),
  },
}));
```

- [ ] **Step 2: 验证 store 创建**

Run: `cat apps/desktop/src/stores/voice-store.ts | head -30`
Expected: 显示 import 和接口定义

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/stores/voice-store.ts
git commit -m "feat(voice): add voice store for state management"
```

---

## Task 3: 安全配置存储

**Files:**
- Create: `apps/desktop/src/lib/voice/secure-config.ts`

- [ ] **Step 1: 创建安全配置模块**

```typescript
// apps/desktop/src/lib/voice/secure-config.ts
import { Store } from '@tauri-apps/plugin-store';
import { homeDir, join } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { VoiceConfig, VoiceConfigFile, DEFAULT_VOICE_CONFIG } from '@/types/voice';

const SECURE_STORE_PATH = '.voice-secrets.dat';
const CONFIG_FILE_NAME = 'voice.yaml';

let secureStore: Store | null = null;

async function getSecureStore(): Promise<Store> {
  if (!secureStore) {
    secureStore = new Store(SECURE_STORE_PATH);
  }
  return secureStore;
}

async function getConfigPath(): Promise<string> {
  const home = await homeDir();
  return join(home, '.viben', CONFIG_FILE_NAME);
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
  const dir = configPath.replace(/\/[^/]+$/, '');

  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
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

  await writeTextFile(configPath, stringifyYaml(fileConfig));

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
    fileConfig = parseYaml(content) as VoiceConfigFile;
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
```

- [ ] **Step 2: 验证文件创建**

Run: `cat apps/desktop/src/lib/voice/secure-config.ts | head -20`
Expected: 显示 import 和常量定义

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/lib/voice/secure-config.ts
git commit -m "feat(voice): add secure config storage with Tauri"
```

---

## Task 4: 共享音频流管理

**Files:**
- Create: `apps/desktop/src/lib/voice/shared-audio-stream.ts`

- [ ] **Step 1: 创建共享音频流类**

```typescript
// apps/desktop/src/lib/voice/shared-audio-stream.ts

type AudioFrameCallback = (audioData: Float32Array) => void;

/**
 * 共享音频流管理器 (单例)
 * 统一管理麦克风访问，支持多个消费者
 */
class SharedAudioStream {
  private static instance: SharedAudioStream | null = null;

  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;

  private frameCallbacks: Set<AudioFrameCallback> = new Set();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): SharedAudioStream {
    if (!SharedAudioStream.instance) {
      SharedAudioStream.instance = new SharedAudioStream();
    }
    return SharedAudioStream.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.audioContext = new AudioContext({ sampleRate: 16000 });

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // 80ms 帧 @ 16kHz = 1280 samples
    this.processorNode = this.audioContext.createScriptProcessor(1280, 1, 1);
    this.processorNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const audioData = new Float32Array(inputData);

      for (const callback of this.frameCallbacks) {
        callback(audioData);
      }
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);

    this.isInitialized = true;
  }

  /** 获取原始 MediaStream (用于 WebRTC) */
  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  /** 订阅音频帧 (用于唤醒词检测) */
  subscribe(callback: AudioFrameCallback): () => void {
    this.frameCallbacks.add(callback);
    return () => this.frameCallbacks.delete(callback);
  }

  async destroy(): Promise<void> {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.frameCallbacks.clear();
    this.isInitialized = false;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}

export const sharedAudioStream = SharedAudioStream.getInstance();
```

- [ ] **Step 2: 验证文件创建**

Run: `cat apps/desktop/src/lib/voice/shared-audio-stream.ts | head -20`
Expected: 显示类型定义和类声明

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/lib/voice/shared-audio-stream.ts
git commit -m "feat(voice): add shared audio stream manager"
```

---

## Task 5: 音效反馈模块

**Files:**
- Create: `apps/desktop/src/lib/voice/audio-feedback.ts`
- Create: `apps/desktop/src/assets/audio/wake-up.ogg` (占位)
- Create: `apps/desktop/src/assets/audio/error.ogg` (占位)

- [ ] **Step 1: 创建音效播放模块**

```typescript
// apps/desktop/src/lib/voice/audio-feedback.ts

type SoundType = 'wake-up' | 'error';

const SOUND_PATHS: Record<SoundType, string> = {
  'wake-up': '/assets/audio/wake-up.ogg',
  'error': '/assets/audio/error.ogg',
};

const audioCache: Map<SoundType, HTMLAudioElement> = new Map();

/** 预加载音效 */
export async function preloadSounds(): Promise<void> {
  const loadSound = async (type: SoundType): Promise<void> => {
    const audio = new Audio(SOUND_PATHS[type]);
    audio.preload = 'auto';
    await new Promise<void>((resolve, reject) => {
      audio.oncanplaythrough = () => resolve();
      audio.onerror = () => reject(new Error(`Failed to load sound: ${type}`));
    });
    audioCache.set(type, audio);
  };

  await Promise.all([
    loadSound('wake-up'),
    loadSound('error'),
  ]);
}

/** 播放音效 */
export function playSound(type: SoundType): void {
  const audio = audioCache.get(type);
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(console.error);
  } else {
    // 未预加载时直接创建
    const newAudio = new Audio(SOUND_PATHS[type]);
    newAudio.play().catch(console.error);
  }
}

/** 检查是否已预加载 */
export function isSoundLoaded(type: SoundType): boolean {
  return audioCache.has(type);
}
```

- [ ] **Step 2: 创建音效占位文件目录**

Run: `mkdir -p apps/desktop/src/assets/audio && touch apps/desktop/src/assets/audio/.gitkeep`
Expected: 目录创建成功

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/lib/voice/audio-feedback.ts apps/desktop/src/assets/audio/.gitkeep
git commit -m "feat(voice): add audio feedback module"
```

---

## Task 6: openWakeWord 引擎封装

**Files:**
- Create: `apps/desktop/src/lib/voice/wake-word-engine.ts`

- [ ] **Step 1: 安装依赖**

Run: `cd apps/desktop && pnpm add onnxruntime-web`
Expected: 依赖安装成功

- [ ] **Step 2: 创建唤醒词引擎封装**

```typescript
// apps/desktop/src/lib/voice/wake-word-engine.ts
import * as ort from 'onnxruntime-web';

export interface WakeWordDetection {
  keyword: string;
  score: number;
  timestamp: number;
}

export type WakeWordCallback = (detection: WakeWordDetection) => void;

interface ModelConfig {
  name: string;
  path: string;
  threshold: number;
}

const BASE_MODELS_PATH = '/openwakeword/models';

/**
 * openWakeWord 引擎封装
 * 基于 onnxruntime-web 运行 ONNX 模型
 */
export class WakeWordEngine {
  private melSession: ort.InferenceSession | null = null;
  private embeddingSession: ort.InferenceSession | null = null;
  private vadSession: ort.InferenceSession | null = null;
  private keywordSessions: Map<string, ort.InferenceSession> = new Map();

  private activeKeywords: Set<string> = new Set();
  private callbacks: Set<WakeWordCallback> = new Set();
  private isLoaded = false;

  private melBuffer: Float32Array[] = [];
  private embeddingBuffer: Float32Array[] = [];

  /** 加载基础模型 */
  async load(): Promise<void> {
    if (this.isLoaded) return;

    // 配置 ONNX Runtime 使用 WASM
    ort.env.wasm.wasmPaths = '/openwakeword/ort/';

    // 加载基础模型
    this.melSession = await ort.InferenceSession.create(
      `${BASE_MODELS_PATH}/melspectrogram.onnx`
    );
    this.embeddingSession = await ort.InferenceSession.create(
      `${BASE_MODELS_PATH}/embedding_model.onnx`
    );
    this.vadSession = await ort.InferenceSession.create(
      `${BASE_MODELS_PATH}/silero_vad.onnx`
    );

    this.isLoaded = true;
  }

  /** 加载唤醒词模型 */
  async loadKeyword(name: string, modelPath?: string): Promise<void> {
    if (!this.isLoaded) {
      throw new Error('Base models not loaded. Call load() first.');
    }

    const path = modelPath ?? `${BASE_MODELS_PATH}/${name}.onnx`;
    const session = await ort.InferenceSession.create(path);
    this.keywordSessions.set(name, session);
  }

  /** 设置激活的唤醒词 */
  setActiveKeywords(keywords: string[]): void {
    this.activeKeywords = new Set(keywords);
  }

  /** 处理音频帧 (80ms @ 16kHz = 1280 samples) */
  async processFrame(audioData: Float32Array, threshold = 0.5): Promise<void> {
    if (!this.isLoaded || !this.melSession || !this.embeddingSession) return;

    // 1. 计算 Mel 频谱图
    const melTensor = new ort.Tensor('float32', audioData, [1, audioData.length]);
    const melResult = await this.melSession.run({ audio: melTensor });
    const melOutput = melResult.output as ort.Tensor;

    this.melBuffer.push(new Float32Array(melOutput.data as Float32Array));
    if (this.melBuffer.length > 76) this.melBuffer.shift(); // 保持窗口大小

    if (this.melBuffer.length < 76) return; // 需要足够的上下文

    // 2. 计算嵌入向量
    const melInput = this.concatenateMelFrames();
    const embTensor = new ort.Tensor('float32', melInput, [1, 76, 32]);
    const embResult = await this.embeddingSession.run({ input: embTensor });
    const embOutput = embResult.output as ort.Tensor;

    this.embeddingBuffer.push(new Float32Array(embOutput.data as Float32Array));
    if (this.embeddingBuffer.length > 16) this.embeddingBuffer.shift();

    if (this.embeddingBuffer.length < 16) return;

    // 3. 对每个激活的唤醒词运行检测
    const embInput = this.concatenateEmbeddings();

    for (const keyword of this.activeKeywords) {
      const session = this.keywordSessions.get(keyword);
      if (!session) continue;

      const kwTensor = new ort.Tensor('float32', embInput, [1, 16, 96]);
      const kwResult = await session.run({ input: kwTensor });
      const score = (kwResult.output as ort.Tensor).data[0] as number;

      if (score >= threshold) {
        const detection: WakeWordDetection = {
          keyword,
          score,
          timestamp: Date.now(),
        };
        this.notifyCallbacks(detection);
      }
    }
  }

  private concatenateMelFrames(): Float32Array {
    const totalLength = this.melBuffer.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const arr of this.melBuffer) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  private concatenateEmbeddings(): Float32Array {
    const totalLength = this.embeddingBuffer.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const arr of this.embeddingBuffer) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  /** 订阅唤醒词检测事件 */
  onDetection(callback: WakeWordCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyCallbacks(detection: WakeWordDetection): void {
    for (const callback of this.callbacks) {
      callback(detection);
    }
  }

  /** 销毁引擎 */
  async destroy(): Promise<void> {
    for (const session of this.keywordSessions.values()) {
      await session.release();
    }
    this.keywordSessions.clear();

    if (this.melSession) await this.melSession.release();
    if (this.embeddingSession) await this.embeddingSession.release();
    if (this.vadSession) await this.vadSession.release();

    this.melSession = null;
    this.embeddingSession = null;
    this.vadSession = null;
    this.isLoaded = false;
    this.callbacks.clear();
  }

  get loaded(): boolean {
    return this.isLoaded;
  }
}

export const wakeWordEngine = new WakeWordEngine();
```

- [ ] **Step 3: 验证文件创建**

Run: `cat apps/desktop/src/lib/voice/wake-word-engine.ts | head -30`
Expected: 显示 import 和接口定义

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/lib/voice/wake-word-engine.ts
git commit -m "feat(voice): add openWakeWord engine wrapper"
```

---

## Task 7: Vocal Bridge 客户端封装

**Files:**
- Create: `apps/desktop/src/lib/voice/vocal-bridge-client.ts`

- [ ] **Step 1: 安装 Vocal Bridge SDK**

Run: `cd apps/desktop && pnpm add @vocalbridgeai/sdk`
Expected: 依赖安装成功

- [ ] **Step 2: 创建 Vocal Bridge 客户端封装**

```typescript
// apps/desktop/src/lib/voice/vocal-bridge-client.ts
import { VocalBridge, ConnectionState, VocalBridgeError } from '@vocalbridgeai/sdk';

export interface VocalBridgeConfig {
  apiKey: string;
  agentId?: string;
  tokenUrl?: string;
}

export interface TranscriptEvent {
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
}

export type VocalBridgeState =
  | 'disconnected'
  | 'connecting'
  | 'waiting_for_agent'
  | 'connected'
  | 'error';

type StateCallback = (state: VocalBridgeState) => void;
type TranscriptCallback = (event: TranscriptEvent) => void;
type ErrorCallback = (error: VocalBridgeError) => void;

/**
 * Vocal Bridge SDK 封装
 * 基于官方 @vocalbridgeai/sdk
 */
export class VocalBridgeClient {
  private config: VocalBridgeConfig | null = null;
  private vb: VocalBridge | null = null;
  private state: VocalBridgeState = 'disconnected';

  private stateCallbacks: Set<StateCallback> = new Set();
  private transcriptCallbacks: Set<TranscriptCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();

  /** 配置客户端 */
  configure(config: VocalBridgeConfig): void {
    this.config = config;
  }

  /** 连接到 Voice Agent */
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('Config not set. Call configure() first.');
    }

    // 创建 SDK 实例
    // 生产环境推荐使用 tokenUrl，由后端代理 API Key
    // 原型阶段可直接用 apiKey（会暴露给浏览器，不安全）
    this.vb = new VocalBridge({
      auth: this.config.tokenUrl
        ? { tokenUrl: this.config.tokenUrl }
        : { apiKey: this.config.apiKey, agentId: this.config.agentId },
      participantName: 'Viben User',
      autoPlayAudio: true,
      debug: false,
    });

    // 监听连接状态
    this.vb.on('connectionStateChanged', (sdkState: ConnectionState) => {
      const stateMap: Record<string, VocalBridgeState> = {
        disconnected: 'disconnected',
        connecting: 'connecting',
        waiting_for_agent: 'waiting_for_agent',
        connected: 'connected',
      };
      this.setState(stateMap[sdkState] ?? 'disconnected');
    });

    // 监听转写文本（SDK 自动处理 send_transcript 事件）
    this.vb.on('transcript', (entry: { role: 'user' | 'agent'; text: string; timestamp: number }) => {
      this.notifyTranscript({
        role: entry.role,
        text: entry.text,
        timestamp: entry.timestamp,
      });
    });

    // 监听错误
    this.vb.on('error', (err: VocalBridgeError) => {
      this.setState('error');
      this.notifyError(err);
    });

    // 连接（SDK 自动请求麦克风权限）
    await this.vb.connect();
  }

  /** 断开连接 */
  async disconnect(): Promise<void> {
    if (this.vb) {
      await this.vb.disconnect();
      this.vb = null;
    }
    this.setState('disconnected');
  }

  /** 静音/取消静音 */
  async toggleMicrophone(): Promise<void> {
    await this.vb?.toggleMicrophone();
  }

  /** 设置麦克风状态 */
  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    await this.vb?.setMicrophoneEnabled(enabled);
  }

  /** 发送自定义动作到 Agent */
  async sendAction(action: string, payload?: Record<string, unknown>): Promise<void> {
    await this.vb?.sendAction(action, payload);
  }

  /** 获取当前状态 */
  getState(): VocalBridgeState {
    return this.state;
  }

  /** 获取对话历史 */
  getTranscript(): TranscriptEvent[] {
    return this.vb?.transcript ?? [];
  }

  /** 清除对话历史 */
  clearTranscript(): void {
    this.vb?.clearTranscript();
  }

  /** 订阅状态变化 */
  onStateChange(callback: StateCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  /** 订阅转写文本 */
  onTranscript(callback: TranscriptCallback): () => void {
    this.transcriptCallbacks.add(callback);
    return () => this.transcriptCallbacks.delete(callback);
  }

  /** 订阅错误 */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  private setState(state: VocalBridgeState): void {
    if (this.state === state) return;
    this.state = state;
    for (const callback of this.stateCallbacks) {
      callback(state);
    }
  }

  private notifyTranscript(event: TranscriptEvent): void {
    for (const callback of this.transcriptCallbacks) {
      callback(event);
    }
  }

  private notifyError(error: VocalBridgeError): void {
    for (const callback of this.errorCallbacks) {
      callback(error);
    }
  }
}

export const vocalBridgeClient = new VocalBridgeClient();
```

- [ ] **Step 3: 验证文件创建**

Run: `cat apps/desktop/src/lib/voice/vocal-bridge-client.ts | head -30`
Expected: 显示接口定义和类声明

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/lib/voice/vocal-bridge-client.ts
git commit -m "feat(voice): add Vocal Bridge client wrapper"
```

---

## Task 8: use-shared-audio Hook

**Files:**
- Create: `apps/desktop/src/hooks/use-shared-audio.ts`

- [ ] **Step 1: 创建共享音频 Hook**

```typescript
// apps/desktop/src/hooks/use-shared-audio.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { sharedAudioStream } from '@/lib/voice/shared-audio-stream';

type AudioFrameCallback = (audioData: Float32Array) => void;

interface UseSharedAudioReturn {
  isInitialized: boolean;
  isInitializing: boolean;
  error: Error | null;
  initialize: () => Promise<void>;
  destroy: () => Promise<void>;
  subscribe: (callback: AudioFrameCallback) => () => void;
  getMediaStream: () => MediaStream | null;
}

/**
 * 共享音频流 Hook
 * 管理麦克风访问，支持多个消费者（唤醒词检测、Vocal Bridge）
 */
export function useSharedAudio(): UseSharedAudioReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // 同步初始状态
    setIsInitialized(sharedAudioStream.initialized);

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const initialize = useCallback(async () => {
    if (sharedAudioStream.initialized || isInitializing) return;

    setIsInitializing(true);
    setError(null);

    try {
      await sharedAudioStream.initialize();
      if (mountedRef.current) {
        setIsInitialized(true);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
      throw err;
    } finally {
      if (mountedRef.current) {
        setIsInitializing(false);
      }
    }
  }, [isInitializing]);

  const destroy = useCallback(async () => {
    await sharedAudioStream.destroy();
    if (mountedRef.current) {
      setIsInitialized(false);
    }
  }, []);

  const subscribe = useCallback((callback: AudioFrameCallback) => {
    return sharedAudioStream.subscribe(callback);
  }, []);

  const getMediaStream = useCallback(() => {
    return sharedAudioStream.getMediaStream();
  }, []);

  return {
    isInitialized,
    isInitializing,
    error,
    initialize,
    destroy,
    subscribe,
    getMediaStream,
  };
}
```

- [ ] **Step 2: 验证文件创建**

Run: `cat apps/desktop/src/hooks/use-shared-audio.ts | head -20`
Expected: 显示 import 和接口定义

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/hooks/use-shared-audio.ts
git commit -m "feat(voice): add use-shared-audio hook"
```

---

## Task 9: use-wake-word Hook

**Files:**
- Create: `apps/desktop/src/hooks/use-wake-word.ts`

- [ ] **Step 1: 创建唤醒词检测 Hook**

```typescript
// apps/desktop/src/hooks/use-wake-word.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { wakeWordEngine, WakeWordDetection } from '@/lib/voice/wake-word-engine';
import { useSharedAudio } from './use-shared-audio';

type WakeWordState = 'inactive' | 'loading' | 'listening' | 'detected';
type DetectionCallback = (detection: WakeWordDetection) => void;

interface UseWakeWordOptions {
  threshold?: number;
  autoStart?: boolean;
}

interface UseWakeWordReturn {
  state: WakeWordState;
  isListening: boolean;
  activeKeywords: string[];
  start: () => Promise<void>;
  stop: () => void;
  setActiveKeywords: (keywords: string[]) => void;
  loadKeyword: (name: string, modelPath?: string) => Promise<void>;
}

/**
 * 唤醒词检测 Hook
 * 基于 openWakeWord ONNX 引擎
 */
export function useWakeWord(
  onDetected: DetectionCallback,
  options: UseWakeWordOptions = {}
): UseWakeWordReturn {
  const { threshold = 0.5, autoStart = false } = options;

  const [state, setState] = useState<WakeWordState>('inactive');
  const [activeKeywords, setActiveKeywordsState] = useState<string[]>([]);

  const sharedAudio = useSharedAudio();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const detectionUnsubRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  // 清理
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      unsubscribeRef.current?.();
      detectionUnsubRef.current?.();
    };
  }, []);

  // 订阅检测事件
  useEffect(() => {
    detectionUnsubRef.current = wakeWordEngine.onDetection((detection) => {
      if (mountedRef.current) {
        setState('detected');
        onDetected(detection);
        // 检测后短暂进入 detected 状态，然后恢复 listening
        setTimeout(() => {
          if (mountedRef.current && state === 'detected') {
            setState('listening');
          }
        }, 1000);
      }
    });

    return () => {
      detectionUnsubRef.current?.();
    };
  }, [onDetected, state]);

  // 自动启动
  useEffect(() => {
    if (autoStart && state === 'inactive') {
      start();
    }
  }, [autoStart]);

  const start = useCallback(async () => {
    if (state === 'listening' || state === 'loading') return;

    setState('loading');

    try {
      // 初始化音频流
      if (!sharedAudio.isInitialized) {
        await sharedAudio.initialize();
      }

      // 加载引擎
      if (!wakeWordEngine.loaded) {
        await wakeWordEngine.load();
      }

      // 订阅音频帧
      unsubscribeRef.current = sharedAudio.subscribe((audioData) => {
        wakeWordEngine.processFrame(audioData, threshold);
      });

      if (mountedRef.current) {
        setState('listening');
      }
    } catch (err) {
      console.error('[useWakeWord] Failed to start:', err);
      if (mountedRef.current) {
        setState('inactive');
      }
      throw err;
    }
  }, [state, sharedAudio, threshold]);

  const stop = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setState('inactive');
  }, []);

  const setActiveKeywords = useCallback((keywords: string[]) => {
    setActiveKeywordsState(keywords);
    wakeWordEngine.setActiveKeywords(keywords);
  }, []);

  const loadKeyword = useCallback(async (name: string, modelPath?: string) => {
    await wakeWordEngine.loadKeyword(name, modelPath);
  }, []);

  return {
    state,
    isListening: state === 'listening',
    activeKeywords,
    start,
    stop,
    setActiveKeywords,
    loadKeyword,
  };
}
```

- [ ] **Step 2: 验证文件创建**

Run: `cat apps/desktop/src/hooks/use-wake-word.ts | head -20`
Expected: 显示 import 和类型定义

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/hooks/use-wake-word.ts
git commit -m "feat(voice): add use-wake-word hook"
```

---

## Task 10: use-voice-agent Hook

**Files:**
- Create: `apps/desktop/src/hooks/use-voice-agent.ts`

- [ ] **Step 1: 创建语音 Agent Hook**

```typescript
// apps/desktop/src/hooks/use-voice-agent.ts
import { useCallback, useEffect, useRef } from 'react';
import { useVoiceStore } from '@/stores/voice-store';
import { vocalBridgeClient, TranscriptEvent, VocalBridgeState } from '@/lib/voice/vocal-bridge-client';
import { playSound } from '@/lib/voice/audio-feedback';
import { useWave } from './use-wave';

interface UseVoiceAgentReturn {
  // 状态
  state: VocalBridgeState;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;

  // 操作
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMicrophone: () => Promise<void>;

  // 数据
  userTranscript: string;
  agentResponse: { text: string; charCount: number; showPopup: boolean };
}

/**
 * Voice Agent Hook
 * 管理与 Vocal Bridge 的连接和状态
 */
export function useVoiceAgent(): UseVoiceAgentReturn {
  const store = useVoiceStore();
  const wave = useWave();
  const mountedRef = useRef(true);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { connectionState, userTranscript, agentResponse, config } = store;

  // 清理
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSilenceTimer();
    };
  }, []);

  // 监听 Vocal Bridge 状态变化
  useEffect(() => {
    const unsubState = vocalBridgeClient.onStateChange((state) => {
      if (!mountedRef.current) return;

      switch (state) {
        case 'connecting':
          store.actions.setConnectionState('connecting');
          break;
        case 'connected':
        case 'waiting_for_agent':
          store.actions.setConnectionState('listening');
          wave.startListening();
          startSilenceTimer();
          break;
        case 'disconnected':
          store.actions.setConnectionState('idle');
          wave.stopSpeaking();
          clearSilenceTimer();
          break;
        case 'error':
          store.actions.setConnectionState('error');
          wave.stopSpeaking();
          clearSilenceTimer();
          break;
      }
    });

    const unsubTranscript = vocalBridgeClient.onTranscript((event: TranscriptEvent) => {
      if (!mountedRef.current) return;

      if (event.role === 'user') {
        store.actions.updateUserTranscript(event.text);
        // 用户说话时重置静默计时
        resetSilenceTimer();
        // 弹窗降低透明度
        store.actions.setPopupOpacity(0.3);
      } else {
        store.actions.appendAgentResponse(event.text);
        // Agent 说话时切换波浪状态
        store.actions.setConnectionState('speaking');
        wave.startSpeaking('calm');
        // 暂停静默计时
        clearSilenceTimer();
      }
    });

    const unsubError = vocalBridgeClient.onError((err) => {
      if (!mountedRef.current) return;
      console.error('[useVoiceAgent] Error:', err);
      store.actions.setError(err.message);
      if (config.enableSoundEffects) {
        playSound('error');
      }
    });

    return () => {
      unsubState();
      unsubTranscript();
      unsubError();
    };
  }, [store, wave, config.enableSoundEffects]);

  // 静默计时器
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    // 仅在 listening 状态下计时
    if (connectionState !== 'listening') return;

    silenceTimerRef.current = setTimeout(() => {
      if (mountedRef.current && connectionState === 'listening') {
        console.log('[useVoiceAgent] Silence timeout, disconnecting...');
        disconnect();
      }
    }, config.silenceTimeout * 1000);
  }, [config.silenceTimeout, connectionState]);

  const resetSilenceTimer = useCallback(() => {
    if (connectionState === 'listening') {
      startSilenceTimer();
    }
  }, [connectionState, startSilenceTimer]);

  // 连接
  const connect = useCallback(async () => {
    if (connectionState !== 'idle') return;

    // 配置客户端
    vocalBridgeClient.configure({
      apiKey: config.vocalBridgeApiKey,
    });

    store.actions.setConnectionState('connecting');
    store.actions.clearAgentResponse();
    store.actions.updateUserTranscript('');

    try {
      await vocalBridgeClient.connect();
      if (config.enableSoundEffects) {
        playSound('wake-up');
      }
    } catch (err) {
      store.actions.setConnectionState('error');
      store.actions.setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [connectionState, config, store]);

  // 断开
  const disconnect = useCallback(async () => {
    clearSilenceTimer();
    await vocalBridgeClient.disconnect();
    store.actions.setConnectionState('idle');
    store.actions.hidePopup();
    wave.stopSpeaking();
  }, [store, wave, clearSilenceTimer]);

  // 切换麦克风
  const toggleMicrophone = useCallback(async () => {
    await vocalBridgeClient.toggleMicrophone();
  }, []);

  return {
    state: connectionState as VocalBridgeState,
    isConnected: connectionState === 'listening' || connectionState === 'speaking' || connectionState === 'processing',
    isListening: connectionState === 'listening',
    isSpeaking: connectionState === 'speaking',
    connect,
    disconnect,
    toggleMicrophone,
    userTranscript,
    agentResponse,
  };
}
```

- [ ] **Step 2: 验证文件创建**

Run: `cat apps/desktop/src/hooks/use-voice-agent.ts | head -30`
Expected: 显示 import 和接口定义

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/hooks/use-voice-agent.ts
git commit -m "feat(voice): add use-voice-agent hook"
```

---

## Task 11: 语音设置页组件

**Files:**
- Create: `apps/desktop/src/components/settings/settings-voice.tsx`

- [ ] **Step 1: 创建语音设置组件**

```typescript
// apps/desktop/src/components/settings/settings-voice.tsx
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVoiceStore } from '@/stores/voice-store';
import { useVoiceAgent } from '@/hooks/use-voice-agent';
import { Loader2, Save, RotateCcw, Mic, MicOff, Square } from 'lucide-react';

// 设置项组件
interface SettingsItemProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function SettingsItem({ title, description, children }: SettingsItemProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
      <div className="flex-1 pr-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-base font-semibold text-foreground mt-6 mb-2 first:mt-0">
      {title}
    </h3>
  );
}

export function SettingsVoice() {
  const { t } = useTranslation();
  const store = useVoiceStore();
  const voiceAgent = useVoiceAgent();

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { config } = store;

  // 加载配置
  useEffect(() => {
    setIsLoading(true);
    store.actions.loadConfig()
      .then(() => {
        setApiKey(config.vocalBridgeApiKey || '');
        setHasChanges(false);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // 保存配置
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      store.actions.setConfig({ vocalBridgeApiKey: apiKey });
      await store.actions.saveConfig();
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [apiKey, store.actions]);

  // 重置
  const handleReset = useCallback(() => {
    setApiKey('');
    store.actions.setConfig({
      wakeWord: '你好微本',
      autoStartOnLaunch: false,
      silenceTimeout: 30,
      enableSoundEffects: true,
    });
    setHasChanges(true);
  }, [store.actions]);

  // 测试连接
  const handleTestToggle = useCallback(async () => {
    if (voiceAgent.isConnected) {
      voiceAgent.disconnect();
    } else {
      await voiceAgent.connect();
    }
  }, [voiceAgent]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold font-serif mb-1">
            {t('settings.sections.voice')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('settings.voice.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('common.reset')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            size="sm"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t('common.save')}
          </Button>
        </div>
      </div>

      {/* API 配置卡片 */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <SectionHeader title={t('settings.voice.api.title')} />

        <SettingsItem
          title={t('settings.voice.api.vocalBridgeKey')}
          description={t('settings.voice.api.vocalBridgeKeyDesc')}
        >
          <div className="flex items-center gap-2">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setHasChanges(true);
              }}
              placeholder="vb_..."
              className="w-48"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? '隐藏' : '显示'}
            </Button>
          </div>
        </SettingsItem>
      </div>

      {/* 唤醒词设置卡片 */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <SectionHeader title={t('settings.voice.wakeWord.title')} />

        <SettingsItem
          title={t('settings.voice.wakeWord.word')}
          description={t('settings.voice.wakeWord.wordDesc')}
        >
          <Select
            value={config.wakeWord}
            onValueChange={(value) => {
              store.actions.setConfig({ wakeWord: value });
              setHasChanges(true);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="你好微本">你好微本</SelectItem>
              <SelectItem value="hey_jarvis">Hey Jarvis</SelectItem>
            </SelectContent>
          </Select>
        </SettingsItem>

        <SettingsItem
          title={t('settings.voice.wakeWord.autoStart')}
          description={t('settings.voice.wakeWord.autoStartDesc')}
        >
          <Switch
            checked={config.autoStartOnLaunch}
            onCheckedChange={(checked) => {
              store.actions.setConfig({ autoStartOnLaunch: checked });
              setHasChanges(true);
            }}
          />
        </SettingsItem>

        <SettingsItem
          title={t('settings.voice.wakeWord.silenceTimeout')}
          description={t('settings.voice.wakeWord.silenceTimeoutDesc')}
        >
          <div className="flex items-center gap-3">
            <Slider
              value={[config.silenceTimeout]}
              onValueChange={([val]) => {
                store.actions.setConfig({ silenceTimeout: val });
                setHasChanges(true);
              }}
              min={10}
              max={120}
              step={5}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground w-10 text-right">
              {config.silenceTimeout}s
            </span>
          </div>
        </SettingsItem>
      </div>

      {/* 测试卡片 */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <SectionHeader title={t('settings.voice.test.title')} />

        <div className="flex flex-col items-center py-6 gap-4">
          {/* 状态图标 */}
          <div className="relative">
            {voiceAgent.isListening ? (
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                <Mic className="w-8 h-8 text-red-500" />
              </div>
            ) : voiceAgent.state === 'connecting' ? (
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <MicOff className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* 状态文字 */}
          <p className="text-sm text-muted-foreground">
            {voiceAgent.isListening
              ? t('settings.voice.test.listening')
              : voiceAgent.state === 'connecting'
                ? t('settings.voice.test.connecting')
                : t('settings.voice.test.idle')}
          </p>

          {/* 用户字幕 */}
          {voiceAgent.userTranscript && (
            <p className="text-sm text-foreground bg-muted px-3 py-1 rounded">
              {voiceAgent.userTranscript}
            </p>
          )}

          {/* 测试按钮 */}
          <Button
            onClick={handleTestToggle}
            disabled={voiceAgent.state === 'connecting' || !apiKey}
            variant={voiceAgent.isConnected ? 'destructive' : 'default'}
          >
            {voiceAgent.isConnected ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                {t('settings.voice.test.stop')}
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                {t('settings.voice.test.start')}
              </>
            )}
          </Button>

          {!apiKey && (
            <p className="text-xs text-destructive">
              {t('settings.voice.test.noApiKey')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证文件创建**

Run: `cat apps/desktop/src/components/settings/settings-voice.tsx | head -30`
Expected: 显示 import 和组件声明

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/components/settings/settings-voice.tsx
git commit -m "feat(voice): add settings-voice component"
```

---

## Task 12: 修改 settings.tsx 添加语音设置

**Files:**
- Modify: `apps/desktop/src/pages/settings.tsx`

- [ ] **Step 1: 添加 import**

在文件顶部 import 区域，找到：
```typescript
import { SettingsOverlay } from "@/components/settings/settings-overlay";
```

在其下方添加：
```typescript
import { SettingsVoice } from "@/components/settings/settings-voice";
```

- [ ] **Step 2: 添加 voice 到 SettingsSection 类型**

找到：
```typescript
type SettingsSection = "general" | "account" | "shortcuts" | "notifications" | "gateway" | "channels" | "executors" | "model" | "agents" | "mcp" | "skills" | "sandbox" | "environment" | "terminalFonts" | "overlay" | "storage" | "developer" | "about";
```

修改为：
```typescript
type SettingsSection = "general" | "account" | "shortcuts" | "notifications" | "gateway" | "channels" | "executors" | "model" | "agents" | "mcp" | "skills" | "sandbox" | "environment" | "terminalFonts" | "overlay" | "voice" | "storage" | "developer" | "about";
```

- [ ] **Step 3: 添加 Mic icon import**

在 lucide-react import 中添加 `Mic`：

找到：
```typescript
import { LogOut, Apple, Rocket, Cat, Boxes, Wrench, SquareTerminal, PanelLeftClose } from "lucide-react";
```

修改为：
```typescript
import { LogOut, Apple, Rocket, Cat, Boxes, Wrench, SquareTerminal, PanelLeftClose, Mic } from "lucide-react";
```

- [ ] **Step 4: 添加 SECTIONS 配置**

在 SECTIONS 数组中，找到：
```typescript
  { id: "overlay", labelKey: "settings.sections.overlay", icon: Layers },
  { id: "storage", labelKey: "settings.sections.storage", icon: HardDrive },
```

修改为：
```typescript
  { id: "overlay", labelKey: "settings.sections.overlay", icon: Layers },
  { id: "voice", labelKey: "settings.sections.voice", icon: Mic },
  { id: "storage", labelKey: "settings.sections.storage", icon: HardDrive },
```

- [ ] **Step 5: 添加 renderSection case**

在 renderSection 函数中，找到：
```typescript
      case "overlay":
        return <SettingsOverlay key="overlay" />;
      case "storage":
```

修改为：
```typescript
      case "overlay":
        return <SettingsOverlay key="overlay" />;
      case "voice":
        return <SettingsVoice key="voice" />;
      case "storage":
```

- [ ] **Step 6: 验证修改**

Run: `grep -n "voice" apps/desktop/src/pages/settings.tsx`
Expected: 显示 4 处 voice 相关代码

- [ ] **Step 7: 提交**

```bash
git add apps/desktop/src/pages/settings.tsx
git commit -m "feat(voice): add voice section to settings page"
```

---

## Task 13: 修改波浪层支持凹形

**Files:**
- Modify: `apps/desktop/src/components/overlay/layers/wave-layer.tsx`

- [ ] **Step 1: 修改波浪绘制逻辑添加凹形支持**

找到现有的波浪绘制循环：
```typescript
        for (let x = 0; x <= width; x += 4) {
          const normalizedX = x / width;
          const wave1 = Math.sin((normalizedX * params.frequency * Math.PI * 2) + t + layerOffset);
          const wave2 = Math.sin((normalizedX * params.frequency * 1.5 * Math.PI * 2) + t * 1.3 + layerOffset);
          const combined = (wave1 + wave2 * 0.5) / 1.5;
          const y = height * 0.5 + combined * params.amplitude;

          graphics.lineTo(x, y);
        }
```

替换为：
```typescript
        for (let x = 0; x <= width; x += 4) {
          const normalizedX = x / width;
          const wave1 = Math.sin((normalizedX * params.frequency * Math.PI * 2) + t + layerOffset);
          const wave2 = Math.sin((normalizedX * params.frequency * 1.5 * Math.PI * 2) + t * 1.3 + layerOffset);
          const combined = (wave1 + wave2 * 0.5) / 1.5;

          // 凹形包络函数：中央振幅小，两侧振幅大
          // 使用二次曲线: 1 - 4*(x-0.5)^2 使得中央(x=0.5)时乘数为0
          // 反转得到凹形: 4*(x-0.5)^2
          const concaveFactor = config.concave
            ? Math.max(0.1, 4 * Math.pow(normalizedX - 0.5, 2))
            : 1;

          const y = height * 0.5 + combined * params.amplitude * concaveFactor;

          graphics.lineTo(x, y);
        }
```

- [ ] **Step 2: 验证修改**

Run: `grep -n "concave" apps/desktop/src/components/overlay/layers/wave-layer.tsx`
Expected: 显示凹形相关代码

- [ ] **Step 3: 添加 concave 配置到 WaveConfig 类型**

在 `apps/desktop/src/types/overlay.ts` 中找到 WaveConfig 接口，添加：
```typescript
export interface WaveConfig {
  // ... 现有字段
  concave?: boolean;  // 是否使用凹形波浪（语音交互时使用）
}
```

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/components/overlay/layers/wave-layer.tsx apps/desktop/src/types/overlay.ts
git commit -m "feat(voice): add concave wave shape support"
```

---

## Task 14: 语音字幕层

**Files:**
- Create: `apps/desktop/src/components/overlay/layers/voice-subtitle-layer.tsx`

- [ ] **Step 1: 创建字幕层组件**

```typescript
// apps/desktop/src/components/overlay/layers/voice-subtitle-layer.tsx
import { useEffect, useRef } from 'react';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useOverlayContext } from '../overlay-provider';
import { useVoiceStore } from '@/stores/voice-store';
import { PixiZIndex } from '@/types/overlay';

const SUBTITLE_CONFIG = {
  paddingX: 24,
  paddingY: 12,
  borderRadius: 12,
  backgroundColor: 0x000000,
  backgroundAlpha: 0.6,
  fontSize: 18,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  textColor: 0xffffff,
  maxWidth: 600,
  topMargin: 60,
  cursorBlinkInterval: 500,
};

export function VoiceSubtitleLayer(): null {
  const { app, isReady } = useOverlayContext();
  const { connectionState, userTranscript } = useVoiceStore();

  const containerRef = useRef<Container | null>(null);
  const bgRef = useRef<Graphics | null>(null);
  const textRef = useRef<Text | null>(null);
  const cursorRef = useRef<Graphics | null>(null);
  const cursorVisibleRef = useRef(true);
  const blinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 初始化容器
  useEffect(() => {
    if (!app || !isReady) return;

    const container = new Container();
    container.zIndex = PixiZIndex.StatusWave + 1; // 在波浪之上
    container.visible = false;
    app.stage.addChild(container);
    containerRef.current = container;

    // 背景
    const bg = new Graphics();
    container.addChild(bg);
    bgRef.current = bg;

    // 文字
    const textStyle = new TextStyle({
      fontFamily: SUBTITLE_CONFIG.fontFamily,
      fontSize: SUBTITLE_CONFIG.fontSize,
      fill: SUBTITLE_CONFIG.textColor,
      wordWrap: true,
      wordWrapWidth: SUBTITLE_CONFIG.maxWidth - SUBTITLE_CONFIG.paddingX * 2,
    });
    const text = new Text({ text: '', style: textStyle });
    container.addChild(text);
    textRef.current = text;

    // 光标
    const cursor = new Graphics();
    cursor.rect(0, 0, 2, SUBTITLE_CONFIG.fontSize);
    cursor.fill({ color: SUBTITLE_CONFIG.textColor });
    container.addChild(cursor);
    cursorRef.current = cursor;

    return () => {
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
      }
      container.destroy({ children: true });
      containerRef.current = null;
      bgRef.current = null;
      textRef.current = null;
      cursorRef.current = null;
    };
  }, [app, isReady]);

  // 更新字幕内容
  useEffect(() => {
    const container = containerRef.current;
    const bg = bgRef.current;
    const text = textRef.current;
    const cursor = cursorRef.current;

    if (!container || !bg || !text || !cursor) return;

    const isActive = connectionState === 'listening' || connectionState === 'processing' || connectionState === 'speaking';

    if (!isActive || !userTranscript) {
      container.visible = false;
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
      return;
    }

    container.visible = true;
    text.text = userTranscript;

    // 计算尺寸
    const textWidth = Math.min(text.width, SUBTITLE_CONFIG.maxWidth - SUBTITLE_CONFIG.paddingX * 2);
    const textHeight = text.height;
    const boxWidth = textWidth + SUBTITLE_CONFIG.paddingX * 2;
    const boxHeight = textHeight + SUBTITLE_CONFIG.paddingY * 2;

    // 绘制背景
    bg.clear();
    bg.roundRect(0, 0, boxWidth, boxHeight, SUBTITLE_CONFIG.borderRadius);
    bg.fill({ color: SUBTITLE_CONFIG.backgroundColor, alpha: SUBTITLE_CONFIG.backgroundAlpha });

    // 定位文字
    text.x = SUBTITLE_CONFIG.paddingX;
    text.y = SUBTITLE_CONFIG.paddingY;

    // 定位光标
    cursor.x = text.x + text.width + 4;
    cursor.y = text.y;

    // 居中容器
    const screenWidth = window.innerWidth;
    container.x = (screenWidth - boxWidth) / 2;
    container.y = SUBTITLE_CONFIG.topMargin;

    // 启动光标闪烁
    if (!blinkIntervalRef.current) {
      blinkIntervalRef.current = setInterval(() => {
        cursorVisibleRef.current = !cursorVisibleRef.current;
        if (cursorRef.current) {
          cursorRef.current.visible = cursorVisibleRef.current;
        }
      }, SUBTITLE_CONFIG.cursorBlinkInterval);
    }
  }, [connectionState, userTranscript]);

  return null;
}
```

- [ ] **Step 2: 在 OverlayProvider 中添加字幕层**

在 `apps/desktop/src/components/overlay/overlay-provider.tsx` 中，首先添加 import：
```typescript
import { VoiceSubtitleLayer } from './layers/voice-subtitle-layer';
```

然后在 OverlayProvider 组件的 children 渲染前添加：
```typescript
// 在 return 语句中
return (
  <OverlayContext.Provider value={value}>
    <VoiceSubtitleLayer />
    {children}
  </OverlayContext.Provider>
);
```

- [ ] **Step 3: 验证文件创建**

Run: `cat apps/desktop/src/components/overlay/layers/voice-subtitle-layer.tsx | head -30`
Expected: 显示 import 和常量定义

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/components/overlay/layers/voice-subtitle-layer.tsx apps/desktop/src/components/overlay/overlay-provider.tsx
git commit -m "feat(voice): add voice subtitle layer"
```

---

## Task 15: Agent 弹窗组件 (DOM + Streamdown)

**Files:**
- Create: `apps/desktop/src/components/overlay/agent-popup.tsx`

- [ ] **Step 1: 安装 streamdown 依赖**

Run: `cd apps/desktop && pnpm add streamdown`
Expected: 依赖安装成功

- [ ] **Step 2: 创建 Agent 弹窗组件**

```typescript
// apps/desktop/src/components/overlay/agent-popup.tsx
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Streamdown } from 'streamdown';
import { useVoiceStore } from '@/stores/voice-store';
import { cn } from '@/lib/utils';

const POPUP_CONFIG = {
  maxWidth: 500,
  maxHeight: 400,
  topMargin: 140, // 字幕下方
  charThreshold: 400, // ≥400 字符时显示弹窗
};

/**
 * Agent 弹窗组件
 * 使用 DOM + Streamdown 实现流式 Markdown 渲染
 * 通过 React Portal 渲染到 body，保持在 Overlay Canvas 之上
 */
export function AgentPopup(): React.ReactElement | null {
  const { connectionState, agentResponse, actions } = useVoiceStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isActive = connectionState === 'speaking' || connectionState === 'processing';
  const shouldShow = agentResponse.showPopup && agentResponse.charCount >= POPUP_CONFIG.charThreshold;

  // 点击外部关闭
  useEffect(() => {
    if (!shouldShow) return;

    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        actions.hidePopup();
      }
    };

    // 延迟添加监听器，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [shouldShow, actions]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current && agentResponse.isStreaming) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agentResponse.text, agentResponse.isStreaming]);

  if (!isActive || !shouldShow) {
    return null;
  }

  const popup = (
    <div
      ref={containerRef}
      className={cn(
        'fixed z-[9999] left-1/2 -translate-x-1/2',
        'bg-[#1a1a1a]/95 backdrop-blur-sm',
        'rounded-xl shadow-2xl border border-white/10',
        'transition-opacity duration-200',
      )}
      style={{
        top: POPUP_CONFIG.topMargin,
        maxWidth: POPUP_CONFIG.maxWidth,
        width: '90vw',
        opacity: agentResponse.popupOpacity,
      }}
    >
      {/* 内容区域 */}
      <div
        ref={scrollRef}
        className="overflow-y-auto overflow-x-hidden p-5"
        style={{ maxHeight: POPUP_CONFIG.maxHeight }}
      >
        <div className="prose prose-invert prose-sm max-w-none">
          <Streamdown
            text={agentResponse.text}
            mode={agentResponse.isStreaming ? 'typewriter' : 'static'}
            className="text-white/90 leading-relaxed"
          />
        </div>

        {/* 流式输出时的闪烁光标 */}
        {agentResponse.isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-white/80 ml-1 animate-pulse" />
        )}
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}
```

- [ ] **Step 3: 在 OverlayProvider 中添加弹窗组件**

在 `apps/desktop/src/components/overlay/overlay-provider.tsx` 中添加 import：
```typescript
import { AgentPopup } from './agent-popup';
```

然后在 VoiceSubtitleLayer 后添加：
```typescript
return (
  <OverlayContext.Provider value={value}>
    <VoiceSubtitleLayer />
    <AgentPopup />
    {children}
  </OverlayContext.Provider>
);
```

- [ ] **Step 4: 添加 hidePopup action 到 voice-store**

在 `apps/desktop/src/stores/voice-store.ts` 的 VoiceActions 接口中确认有：
```typescript
hidePopup: () => void;
```

在 actions 实现中添加：
```typescript
hidePopup: () => set((s) => ({
  agentResponse: { ...s.agentResponse, showPopup: false },
})),
```

- [ ] **Step 5: 验证文件创建**

Run: `cat apps/desktop/src/components/overlay/agent-popup.tsx | head -30`
Expected: 显示 import 和常量定义

- [ ] **Step 6: 提交**

```bash
git add apps/desktop/src/components/overlay/agent-popup.tsx apps/desktop/src/components/overlay/overlay-provider.tsx apps/desktop/src/stores/voice-store.ts
git commit -m "feat(voice): add agent popup with Streamdown"
```

---

## Task 16: (已合并到 Task 15)

> 注：原 Task 16 的 Canvas 弹窗实现已被 Task 15 的 DOM + Streamdown 实现替代。
> 此任务保留编号以保持计划结构一致性，无需执行。

---

## Task 17: 部署 ONNX 模型文件

**Files:**
- Create: `apps/desktop/public/openwakeword/models/` 目录
- Create: `apps/desktop/public/openwakeword/ort/` 目录

- [ ] **Step 1: 创建目录结构**

Run: `mkdir -p apps/desktop/public/openwakeword/models apps/desktop/public/openwakeword/ort`
Expected: 目录创建成功

- [ ] **Step 2: 下载 onnxruntime-web WASM 文件**

从 npm 包复制 WASM 文件：
```bash
cd apps/desktop
cp node_modules/onnxruntime-web/dist/*.wasm public/openwakeword/ort/
```

- [ ] **Step 3: 下载 openWakeWord 基础模型**

从 openWakeWord releases 下载基础模型：
```bash
cd apps/desktop/public/openwakeword/models

# Mel spectrogram 模型
curl -L -o melspectrogram.onnx "https://github.com/dscripka/openWakeWord/releases/download/v0.5.0/melspectrogram.onnx"

# Embedding 模型
curl -L -o embedding_model.onnx "https://github.com/dscripka/openWakeWord/releases/download/v0.5.0/embedding_model.onnx"

# 内置唤醒词 hey_jarvis（开发测试用）
curl -L -o hey_jarvis_v0.1.onnx "https://github.com/dscripka/openWakeWord/releases/download/v0.5.0/hey_jarvis_v0.1.onnx"
```

- [ ] **Step 4: 创建占位文件**

```bash
# 为自定义唤醒词创建占位
touch apps/desktop/public/openwakeword/models/.gitkeep
```

- [ ] **Step 5: 添加 .gitignore 规则**

在 `apps/desktop/.gitignore` 中添加（避免提交大型模型文件）：
```
# openWakeWord ONNX models (downloaded at build time)
public/openwakeword/models/*.onnx
public/openwakeword/ort/*.wasm
!public/openwakeword/models/.gitkeep
!public/openwakeword/ort/.gitkeep
```

- [ ] **Step 6: 创建下载脚本**

创建 `apps/desktop/scripts/download-wakeword-models.sh`：
```bash
#!/bin/bash
# 下载 openWakeWord 模型文件

MODELS_DIR="public/openwakeword/models"
ORT_DIR="public/openwakeword/ort"

mkdir -p "$MODELS_DIR" "$ORT_DIR"

# 复制 onnxruntime WASM
cp node_modules/onnxruntime-web/dist/*.wasm "$ORT_DIR/"

# 下载基础模型
curl -L -o "$MODELS_DIR/melspectrogram.onnx" \
  "https://github.com/dscripka/openWakeWord/releases/download/v0.5.0/melspectrogram.onnx"

curl -L -o "$MODELS_DIR/embedding_model.onnx" \
  "https://github.com/dscripka/openWakeWord/releases/download/v0.5.0/embedding_model.onnx"

# 下载 hey_jarvis 模型（开发测试用）
curl -L -o "$MODELS_DIR/hey_jarvis_v0.1.onnx" \
  "https://github.com/dscripka/openWakeWord/releases/download/v0.5.0/hey_jarvis_v0.1.onnx"

echo "Models downloaded successfully!"
```

- [ ] **Step 7: 添加 npm script**

在 `apps/desktop/package.json` 的 scripts 中添加：
```json
"download:wakeword-models": "bash scripts/download-wakeword-models.sh"
```

- [ ] **Step 8: 提交**

```bash
git add apps/desktop/public/openwakeword apps/desktop/scripts/download-wakeword-models.sh apps/desktop/.gitignore apps/desktop/package.json
git commit -m "feat(voice): add openWakeWord model download scripts"
```

---

## Task 18: Python 唤醒词训练项目

**Files:**
- Create: `backend/wakeword/` 目录结构

- [ ] **Step 1: 创建项目目录结构**

```bash
mkdir -p backend/wakeword/{configs,src/wakeword_trainer,models,data}
touch backend/wakeword/README.md
touch backend/wakeword/pyproject.toml
touch backend/wakeword/configs/hey_jarvis.yaml
touch backend/wakeword/configs/ni_hao_wei_ben.yaml
touch backend/wakeword/src/wakeword_trainer/__init__.py
touch backend/wakeword/src/wakeword_trainer/train.py
touch backend/wakeword/src/wakeword_trainer/generate.py
touch backend/wakeword/src/wakeword_trainer/export.py
touch backend/wakeword/models/.gitkeep
touch backend/wakeword/data/.gitkeep
```

- [ ] **Step 2: 创建 pyproject.toml**

```toml
# backend/wakeword/pyproject.toml
[project]
name = "wakeword-trainer"
version = "0.1.0"
description = "Custom wake word training for Viben"
requires-python = ">=3.9"

dependencies = [
    "openwakeword>=0.6.0",
    "piper-tts>=1.0.0",
    "torch>=2.0.0",
    "torchaudio>=2.0.0",
    "onnx>=1.14.0",
    "speechbrain>=0.5.0",
    "numpy>=1.24.0",
    "pyyaml>=6.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "black>=23.0.0",
    "ruff>=0.1.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]
```

- [ ] **Step 3: 创建配置文件 ni_hao_wei_ben.yaml**

```yaml
# backend/wakeword/configs/ni_hao_wei_ben.yaml
model_name: "ni_hao_wei_ben"
target_phrase: "你好微本"

# TTS 配置 (使用中文 Piper 模型)
tts:
  model: "zh_CN-huayan-medium"
  num_samples: 5000

# 训练配置
training:
  epochs: 100
  batch_size: 64
  learning_rate: 0.001
  validation_split: 0.1

# 数据增强
augmentation:
  noise_snr_range: [5, 20]
  speed_range: [0.9, 1.1]
  reverb: true
  pitch_shift_range: [-2, 2]

# 导出配置
export:
  output_dir: "../../apps/desktop/public/openwakeword/models"
  threshold: 0.5
```

- [ ] **Step 4: 创建训练入口 train.py**

```python
# backend/wakeword/src/wakeword_trainer/train.py
"""
openWakeWord 自定义唤醒词训练入口
"""
import argparse
from pathlib import Path
import yaml

from .generate import generate_synthetic_audio
from .export import export_onnx_model


def load_config(config_path: str) -> dict:
    """加载 YAML 配置文件"""
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def train_model(config: dict, skip_generate: bool = False) -> None:
    """训练唤醒词模型"""
    model_name = config['model_name']
    target_phrase = config['target_phrase']

    print(f"Training wake word model: {model_name}")
    print(f"Target phrase: {target_phrase}")

    # Step 1: 生成合成语音
    if not skip_generate:
        print("\n[1/3] Generating synthetic audio...")
        generate_synthetic_audio(
            phrase=target_phrase,
            num_samples=config['tts']['num_samples'],
            model=config['tts']['model'],
            output_dir=Path(f"data/{model_name}"),
            augmentation=config['augmentation'],
        )
    else:
        print("\n[1/3] Skipping audio generation (--skip-generate)")

    # Step 2: 训练模型
    print("\n[2/3] Training model...")
    # 这里调用 openWakeWord 的训练 API
    # 实际实现需要参考 openWakeWord 文档
    train_config = config['training']
    print(f"  Epochs: {train_config['epochs']}")
    print(f"  Batch size: {train_config['batch_size']}")
    print(f"  Learning rate: {train_config['learning_rate']}")

    # TODO: 实际训练逻辑
    # from openwakeword.training import train_custom_model
    # train_custom_model(...)

    # Step 3: 导出 ONNX
    print("\n[3/3] Exporting ONNX model...")
    export_config = config['export']
    export_onnx_model(
        model_name=model_name,
        output_dir=Path(export_config['output_dir']),
        threshold=export_config['threshold'],
    )

    print(f"\n✅ Training complete! Model saved to: {export_config['output_dir']}/{model_name}.onnx")


def main():
    parser = argparse.ArgumentParser(description='Train custom wake word model')
    parser.add_argument('--config', required=True, help='Path to config YAML file')
    parser.add_argument('--skip-generate', action='store_true', help='Skip audio generation')
    args = parser.parse_args()

    config = load_config(args.config)
    train_model(config, skip_generate=args.skip_generate)


if __name__ == '__main__':
    main()
```

- [ ] **Step 5: 创建合成语音生成 generate.py**

```python
# backend/wakeword/src/wakeword_trainer/generate.py
"""
使用 Piper TTS 生成合成语音用于训练
"""
from pathlib import Path
from typing import Optional
import subprocess


def generate_synthetic_audio(
    phrase: str,
    num_samples: int,
    model: str,
    output_dir: Path,
    augmentation: Optional[dict] = None,
) -> None:
    """
    使用 Piper TTS 生成合成语音

    Args:
        phrase: 目标唤醒词
        num_samples: 生成样本数量
        model: Piper TTS 模型名称
        output_dir: 输出目录
        augmentation: 数据增强配置
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"  Phrase: {phrase}")
    print(f"  Model: {model}")
    print(f"  Samples: {num_samples}")
    print(f"  Output: {output_dir}")

    # TODO: 实际的 Piper TTS 调用
    # 需要安装 piper-tts 并下载中文模型
    #
    # 示例命令:
    # echo "你好微本" | piper --model zh_CN-huayan-medium --output_file sample_0001.wav
    #
    # 实际实现需要:
    # 1. 循环生成多个样本
    # 2. 每个样本使用不同的语速/音调变化
    # 3. 添加噪声和混响增强

    if augmentation:
        print(f"  Augmentation: {augmentation}")

    print("  [Mock] Audio generation not implemented yet")
```

- [ ] **Step 6: 创建 ONNX 导出 export.py**

```python
# backend/wakeword/src/wakeword_trainer/export.py
"""
导出训练好的模型为 ONNX 格式
"""
from pathlib import Path


def export_onnx_model(
    model_name: str,
    output_dir: Path,
    threshold: float = 0.5,
) -> None:
    """
    导出模型为 ONNX 格式

    Args:
        model_name: 模型名称
        output_dir: 输出目录
        threshold: 推荐检测阈值
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{model_name}.onnx"

    print(f"  Model: {model_name}")
    print(f"  Output: {output_path}")
    print(f"  Threshold: {threshold}")

    # TODO: 实际的 ONNX 导出逻辑
    # 需要使用 torch.onnx.export 或 onnx 库
    #
    # 示例:
    # import torch
    # torch.onnx.export(
    #     model,
    #     dummy_input,
    #     str(output_path),
    #     opset_version=13,
    #     input_names=['input'],
    #     output_names=['output'],
    # )

    print("  [Mock] ONNX export not implemented yet")
```

- [ ] **Step 7: 创建 __init__.py**

```python
# backend/wakeword/src/wakeword_trainer/__init__.py
"""Wake word trainer for Viben"""
from .train import train_model, load_config
from .generate import generate_synthetic_audio
from .export import export_onnx_model

__all__ = [
    'train_model',
    'load_config',
    'generate_synthetic_audio',
    'export_onnx_model',
]
```

- [ ] **Step 8: 创建 README.md**

```markdown
# Viben Wake Word Trainer

使用 openWakeWord 训练自定义唤醒词模型。

## 安装

\`\`\`bash
cd backend/wakeword
pip install -e .
\`\`\`

## 使用

### 训练"你好微本"模型

\`\`\`bash
python -m wakeword_trainer.train --config configs/ni_hao_wei_ben.yaml
\`\`\`

### 分步执行

\`\`\`bash
# 1. 生成合成语音
python -m wakeword_trainer.generate --config configs/ni_hao_wei_ben.yaml

# 2. 训练模型（跳过生成）
python -m wakeword_trainer.train --config configs/ni_hao_wei_ben.yaml --skip-generate

# 3. 导出 ONNX
python -m wakeword_trainer.export --config configs/ni_hao_wei_ben.yaml
\`\`\`

## 配置说明

参见 `configs/ni_hao_wei_ben.yaml` 中的注释。

## 依赖

- Python 3.9+
- openWakeWord
- Piper TTS (中文模型)
- PyTorch
- ONNX
```

- [ ] **Step 9: 提交**

```bash
git add backend/wakeword
git commit -m "feat(voice): add Python wake word training project"
```

---

## Task 19: 添加翻译文案

**Files:**
- Modify: `apps/desktop/src/i18n/locales/zh-CN.json`
- Modify: `apps/desktop/src/i18n/locales/en.json`

- [ ] **Step 1: 添加中文翻译**

在 `apps/desktop/src/i18n/locales/zh-CN.json` 中，找到 `settings.sections` 对象，添加：

```json
"voice": "语音交互"
```

然后在 `settings` 对象中添加 `voice` 子对象：

```json
"voice": {
  "description": "配置语音助手和唤醒词检测",
  "api": {
    "title": "API 配置",
    "vocalBridgeKey": "Vocal Bridge API Key",
    "vocalBridgeKeyDesc": "用于连接语音服务的 API 密钥"
  },
  "wakeWord": {
    "title": "唤醒词设置",
    "word": "唤醒词",
    "wordDesc": "说出这个词来激活语音助手",
    "autoStart": "启动时自动监听",
    "autoStartDesc": "应用启动后自动开始监听唤醒词",
    "silenceTimeout": "静默超时",
    "silenceTimeoutDesc": "无语音输入后自动退出的时间"
  },
  "test": {
    "title": "测试语音功能",
    "idle": "点击开始说话",
    "connecting": "正在连接...",
    "listening": "正在监听...",
    "start": "开始测试",
    "stop": "停止",
    "noApiKey": "请先配置 API Key"
  }
}
```

- [ ] **Step 2: 添加英文翻译**

在 `apps/desktop/src/i18n/locales/en.json` 中添加对应的英文：

```json
"voice": "Voice"
```

在 `settings` 中：

```json
"voice": {
  "description": "Configure voice assistant and wake word detection",
  "api": {
    "title": "API Configuration",
    "vocalBridgeKey": "Vocal Bridge API Key",
    "vocalBridgeKeyDesc": "API key for connecting to voice service"
  },
  "wakeWord": {
    "title": "Wake Word Settings",
    "word": "Wake Word",
    "wordDesc": "Say this word to activate voice assistant",
    "autoStart": "Auto-start on launch",
    "autoStartDesc": "Start listening for wake word when app launches",
    "silenceTimeout": "Silence Timeout",
    "silenceTimeoutDesc": "Time before auto-disconnect when no speech"
  },
  "test": {
    "title": "Test Voice Function",
    "idle": "Click to start speaking",
    "connecting": "Connecting...",
    "listening": "Listening...",
    "start": "Start Test",
    "stop": "Stop",
    "noApiKey": "Please configure API Key first"
  }
}
```

- [ ] **Step 3: 验证翻译添加**

Run: `grep -A5 '"voice"' apps/desktop/src/i18n/locales/zh-CN.json | head -10`
Expected: 显示语音设置的翻译

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/i18n/locales/zh-CN.json apps/desktop/src/i18n/locales/en.json
git commit -m "feat(voice): add i18n translations for voice settings"
```

---

## Task 20: 创建 lib/voice/index.ts 导出

**Files:**
- Create: `apps/desktop/src/lib/voice/index.ts`

- [ ] **Step 1: 创建导出文件**

```typescript
// apps/desktop/src/lib/voice/index.ts

// 共享音频流
export { sharedAudioStream } from './shared-audio-stream';
export type { SharedAudioStream } from './shared-audio-stream';

// 唤醒词引擎
export { wakeWordEngine, WakeWordEngine } from './wake-word-engine';
export type { WakeWordDetection, WakeWordCallback } from './wake-word-engine';

// Vocal Bridge 客户端
export { vocalBridgeClient, VocalBridgeClient } from './vocal-bridge-client';
export type {
  VocalBridgeConfig,
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
```

- [ ] **Step 2: 验证文件创建**

Run: `cat apps/desktop/src/lib/voice/index.ts`
Expected: 显示所有导出

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/lib/voice/index.ts
git commit -m "feat(voice): add lib/voice index exports"
```

---

## 自检清单

完成所有 Task 后，运行以下检查：

- [ ] **类型检查**: `cd apps/desktop && pnpm typecheck`
- [ ] **Lint 检查**: `cd apps/desktop && pnpm lint`
- [ ] **构建测试**: `cd apps/desktop && pnpm build`

---

## 执行摘要

本计划包含 20 个任务，按以下顺序执行：

| 阶段 | Task | 描述 |
|-----|------|------|
| 基础 | 1-3 | 类型定义、Store、安全配置 |
| 音频 | 4-6 | 共享音频流、音效、唤醒词引擎 |
| SDK | 7 | Vocal Bridge 客户端封装 |
| Hooks | 8-10 | 共享音频、唤醒词、语音 Agent Hook |
| UI | 11-12 | 设置页组件、路由集成 |
| Overlay | 13-15 | 凹形波浪、字幕层、弹窗层 (DOM + Streamdown) |
| 部署 | 17-18 | ONNX 模型、Python 训练项目 |
| 收尾 | 19-20 | 翻译文案、导出文件 |
