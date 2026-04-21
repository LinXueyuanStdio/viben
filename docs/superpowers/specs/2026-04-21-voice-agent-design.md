# 语音交互功能技术设计 (Spec)

> 版本: 1.1
> 日期: 2026-04-21
> 关联 PRD: 2026-04-21-voice-agent-prd.md

## 修订记录

| 版本 | 日期 | 修改内容 |
|-----|------|---------|
| 1.1 | 2026-04-21 | 根据 Review 意见更新：API Key 加密存储、400字符阈值、共享音频流、静默计时逻辑、新增 error 状态 |
| 1.0 | 2026-04-21 | 初始版本 |

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Desktop App (Tauri)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │           SharedAudioStream (AudioContext)           │   │
│  │           统一管理麦克风，分发给两个服务                  │   │
│  └───────────────┬─────────────────┬───────────────────┘   │
│                  │                 │                        │
│                  ▼                 ▼                        │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │  Porcupine      │    │  Vocal Bridge SDK            │   │
│  │  (Wake Word)    │───▶│  (WebRTC Voice Agent)        │   │
│  │  @picovoice/    │    │  @vocalbridgeai/sdk          │   │
│  │  porcupine-web  │    └──────────┬───────────────────┘   │
│  └─────────────────┘               │                        │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              voice-store (Zustand)                   │   │
│  │  - connectionState (含 error 状态)                   │   │
│  │  - wakeWordState                                     │   │
│  │  - userTranscript / agentResponse                    │   │
│  │  - config (API Key 通过 Tauri secure-storage 加密)    │   │
│  └─────────────────────────────────────────────────────┘   │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Overlay Layer (PixiJS Canvas)           │   │
│  │  - WaveLayer (多层炫彩波浪)                           │   │
│  │  - VoiceSubtitleLayer (用户字幕)                      │   │
│  │  - AgentPopupLayer (AI 回复弹窗)                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 2. 状态机

### 2.1 语音连接状态

```
              ┌──────────┐
              │   idle   │◀──────────────────────────────────┐
              └────┬─────┘                                    │
                   │ 唤醒词检测 / 测试按钮点击                   │
                   ▼                                          │
              ┌──────────┐         ┌───────┐                 │
              │connecting│────────▶│ error │─── 重试/取消 ───┤
              └────┬─────┘         └───────┘                 │
                   │ 连接成功 + 播放提示音                       │
                   ▼                                          │
              ┌──────────┐                                    │
     ┌───────│listening │◀────────────────┐                  │
     │       └────┬─────┘  (静默计时中)     │                  │
     │            │ 用户说话                │ Agent 说完        │
     │            ▼                        │                  │
     │       ┌──────────┐                  │                  │
     │       │processing│─── Agent 回复 ──▶┤                  │
     │       └────┬─────┘                  │                  │
     │            │ 超时(60s)              │                  │
     │            ▼                        │                  │
     │       ┌───────┐                ┌────┴────┐             │
     │       │ error │                │speaking │ (静默计时暂停)│
     │       └───┬───┘                └────┬────┘             │
     │           │                         │                  │
     └──── Escape / Agent退出 / 静默超时 ───┴──────────────────┘

注：静默计时仅在 listening 状态下进行，speaking/processing 状态暂停计时
```

### 2.2 波浪状态映射

| 语音状态 | 波浪状态 | 说明 |
|---------|---------|------|
| idle | idle | 无波浪 |
| connecting | idle | 无波浪 |
| listening | listening | 蓝色系波浪 |
| processing | listening | 保持蓝色系 |
| speaking | speaking-calm/excited/happy | 橙绿色系波浪 |

## 3. 文件结构

```
apps/desktop/src/
├── stores/
│   └── voice-store.ts              # 语音状态管理
│
├── hooks/
│   ├── use-voice-agent.ts          # Voice Agent 连接管理
│   ├── use-porcupine.ts            # 唤醒词检测
│   └── use-shared-audio.ts         # 共享音频流管理 (新增)
│
├── lib/
│   └── voice/
│       ├── index.ts                # 导出
│       ├── shared-audio-stream.ts  # 共享 AudioContext 管理 (新增)
│       ├── vocal-bridge-client.ts  # Vocal Bridge SDK 封装
│       ├── porcupine-engine.ts     # Porcupine 引擎封装
│       ├── audio-feedback.ts       # 提示音/音效管理
│       ├── markdown-renderer.ts    # Canvas Markdown 渲染器
│       └── secure-config.ts        # API Key 加密存储 (新增)
│
├── components/
│   ├── settings/
│   │   └── settings-voice.tsx      # 语音设置页组件
│   │
│   └── overlay/
│       └── layers/
│           ├── wave-layer.tsx            # 修改：支持凹形波浪
│           ├── voice-subtitle-layer.tsx  # 新增：语音字幕层
│           └── agent-popup-layer.tsx     # 新增：AI 弹窗层
│
├── pages/
│   └── settings.tsx                # 修改：添加 voice section
│
├── types/
│   └── voice.ts                    # 语音相关类型定义
│
└── assets/
    └── audio/
        ├── wake-up.ogg             # 唤醒提示音 (使用 ogg 格式)
        └── error.ogg               # 错误提示音
```

## 4. 类型定义

### 4.1 状态类型

```typescript
/** 语音连接状态 */
type VoiceConnectionState =
  | 'idle'        // 未连接
  | 'connecting'  // 正在连接
  | 'listening'   // 监听用户说话 (静默计时中)
  | 'processing'  // 等待 Agent 响应 (静默计时暂停)
  | 'speaking'    // Agent 正在说话 (静默计时暂停)
  | 'error';      // 错误状态

/** 唤醒词检测状态 */
type WakeWordState =
  | 'inactive'    // 未启动
  | 'loading'     // 加载模型中
  | 'listening'   // 正在监听唤醒词
  | 'detected';   // 检测到唤醒词
```

### 4.2 配置类型

```typescript
interface VoiceConfig {
  // API Keys
  vocalBridgeApiKey: string;
  porcupineAccessKey: string;

  // 唤醒词
  wakeWord: string;               // 默认 "你好微本"
  wakeWordModelPath?: string;     // 自定义模型路径
  builtinWakeWord?: string;       // 内置唤醒词 (开发阶段)

  // 行为配置
  autoStartOnLaunch: boolean;     // 启动时自动监听
  silenceTimeout: number;         // 静默超时秒数

  // 音效
  enableSoundEffects: boolean;
}
```

### 4.3 数据类型

```typescript
interface VoiceTranscript {
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
  isFinal: boolean;
}

interface AgentResponse {
  text: string;
  charCount: number;              // 字符数统计
  isStreaming: boolean;
  showPopup: boolean;             // ≥400 字符时为 true
  popupOpacity: number;           // 用户说话时降至 0.3
}
```

### 4.4 Store 类型

```typescript
interface VoiceState {
  connectionState: VoiceConnectionState;
  wakeWordState: WakeWordState;
  config: VoiceConfig;
  userTranscript: string;
  agentResponse: AgentResponse;
  error: string | null;
}

interface VoiceActions {
  // 连接控制
  connect: () => Promise<void>;
  disconnect: () => void;

  // 唤醒词
  startWakeWordDetection: () => Promise<void>;
  stopWakeWordDetection: () => void;

  // 配置
  setConfig: (config: Partial<VoiceConfig>) => void;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;

  // 字幕
  updateUserTranscript: (text: string, isFinal: boolean) => void;
  appendAgentResponse: (chunk: string) => void;
  clearAgentResponse: () => void;

  // 弹窗
  setPopupOpacity: (opacity: number) => void;
  hidePopup: () => void;

  // 错误
  setError: (error: string | null) => void;
}
```

## 5. Hook API

### 5.1 useVoiceAgent

```typescript
function useVoiceAgent(): {
  // 状态
  state: VoiceConnectionState;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;

  // 操作
  connect: () => Promise<void>;
  disconnect: () => void;

  // 数据
  userTranscript: string;
  agentResponse: AgentResponse;
}
```

### 5.2 usePorcupine

```typescript
function usePorcupine(): {
  // 状态
  state: WakeWordState;
  isListening: boolean;

  // 操作
  start: () => Promise<void>;
  stop: () => void;

  // 事件
  onWakeWordDetected: (callback: () => void) => void;
}
```

## 6. 组件设计

### 6.1 设置页 - SettingsVoice

**位置**: 新增独立 section，与 overlay、gateway 并列

**结构**:
- API 配置卡片
  - Vocal Bridge API Key (密码输入框)
  - Porcupine Access Key (密码输入框)
- 唤醒词设置卡片
  - 唤醒词选择 (下拉框)
  - 启动时自动监听 (开关)
  - 静默超时 (滑块，默认30秒)
- 测试卡片
  - 麦克风图标 + 状态文字
  - 测试按钮 (切换模式)

**按钮状态**:
| 状态 | 图标 | 文字 | 按钮 |
|-----|------|------|------|
| idle | 🎤 | 点击开始说话 | 开始测试 |
| connecting | ⏳ | 正在连接... | 取消 |
| listening | 🔴 | 正在监听... | 停止 |

### 6.2 Overlay - 波浪层

**修改现有 WaveLayer**:
- 支持凹形波浪（中央振幅小，两侧振幅大）
- 多层叠加（3-5层），不同颜色渐变
- 不同相位和速度产生涌动效果
- 可选粒子特效

**波浪形状示意**:
```
≋≋≋≋≋≋≋≋≋                                       ≋≋≋≋≋≋≋≋≋
≋≋≋≋≋≋≋                                           ≋≋≋≋≋≋≋
≋≋≋≋≋                 [字幕区域]                   ≋≋≋≋≋
≋≋≋≋                    清晰可读                    ≋≋≋≋
≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋
```

### 6.3 Overlay - 字幕层 (VoiceSubtitleLayer)

**渲染方式**: PixiJS Canvas (非 DOM)

**位置**: 屏幕顶部，波浪凹陷区域内

**元素**:
- 半透明圆角背景 (Graphics)
- 流式文字 (Text)
- 闪烁光标 (Graphics，500ms 闪烁)

### 6.4 Overlay - AI 弹窗层 (AgentPopupLayer)

**渲染方式**: PixiJS Canvas + @pixi/ui ScrollBox

**触发条件**: Agent 回复 ≥400 字符

**位置**: 用户字幕下方

**功能**:
- 流式 Markdown 渲染 (marked.js + 自定义 PixiJS renderer)
- 可滚动 (ScrollBox)
- 可选中复制
- 代码块高亮
- 链接可点击
- 闪烁光标（流式输出时）

**交互**:
- 点击弹窗外部消失
- 用户说话时透明度降至 30%
- 新内容自动滚动到底部

### 6.5 Canvas 层级结构

```
app.stage
├── WaveContainer (zIndex: 0)
│   ├── WaveLayer1 (蓝紫渐变，慢速)
│   ├── WaveLayer2 (青蓝渐变，中速)
│   ├── WaveLayer3 (紫粉渐变，快速)
│   └── ParticleContainer (可选)
├── SubtitleContainer (zIndex: 1)
│   ├── Background (半透明圆角矩形)
│   ├── Text (流式文字)
│   └── Cursor (闪烁光标)
└── AgentPopupContainer (zIndex: 2)
    └── ScrollBox
        ├── Background
        └── MarkdownContent
```

## 7. 数据流

### 7.0 共享音频流架构

Porcupine 和 Vocal Bridge 都需要麦克风访问，使用共享音频流避免资源竞争：

```
┌─────────────────────────────────────────────────────────┐
│                    SharedAudioStream                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │           AudioContext (单例)                    │   │
│  │           └── MediaStreamSource                  │   │
│  │                    │                             │   │
│  │         ┌─────────┴─────────┐                   │   │
│  │         ▼                   ▼                   │   │
│  │  ┌─────────────┐     ┌─────────────┐           │   │
│  │  │ ScriptNode  │     │ MediaStream │           │   │
│  │  │ (Porcupine) │     │ (VocalBridge)│           │   │
│  │  └─────────────┘     └─────────────┘           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

工作流程:
1. 应用启动时创建 SharedAudioStream 单例
2. 获取一次麦克风权限，创建 MediaStream
3. Porcupine 通过 ScriptProcessorNode 分析音频
4. Vocal Bridge 使用同一 MediaStream 建立 WebRTC 连接
5. 两个服务可同时运行，无需切换
```

### 7.1 唤醒词激活流程

```
Porcupine 检测到唤醒词
    │
    ▼
usePorcupine.onWakeWordDetected()
    │
    ▼
playSound('wake-up')
    │
    ▼
voiceStore.connect()
    │
    ├──▶ VocalBridge.connect()
    │
    ▼
connectionState: 'connecting' → 'listening'
    │
    ▼
waveStore.startListening()
```

### 7.2 字幕更新流程

```
Vocal Bridge SDK
vb.on('transcript', { role, text })
    │
    ├── role === 'user'
    │   └──▶ voiceStore.updateUserTranscript(text)
    │           └──▶ VoiceSubtitleLayer 更新
    │
    └── role === 'agent'
        └──▶ voiceStore.appendAgentResponse(text)
                │
                ├── charCount < 400: 仅累积
                │
                └── charCount ≥ 400: showPopup = true
                        └──▶ AgentPopupLayer 显示
```

### 7.3 退出流程

```
触发退出 (Escape / 超时 / Agent 判断)
    │
    ▼
voiceStore.disconnect()
    │
    ├──▶ VocalBridge.disconnect()
    │
    ├──▶ waveStore.stopSpeaking()
    │
    └──▶ clearAgentResponse()
            │
            ▼
connectionState: → 'idle'
```

## 8. 依赖项

### 8.1 新增 NPM 包

| 包名 | 版本 | 用途 |
|-----|------|------|
| @vocalbridgeai/sdk | ^1.0.0 | 语音服务 SDK |
| @picovoice/porcupine-web | ^3.0.6 | 唤醒词检测 |
| @pixi/ui | ^2.3.2 | Canvas UI 组件 |
| marked | ^12.0.0 | Markdown 解析 |
| @tauri-apps/plugin-store | ^2.0.0 | API Key 加密存储 |

### 8.2 现有依赖

- pixi.js (已有)
- zustand (已有)
- react (已有)

### 8.3 SDK 可用性验证

> **重要**: 在开发前需验证 @vocalbridgeai/sdk 的可用性。如果 SDK 不可用，需要：
> 1. 直接使用 LiveKit SDK (@livekit/client) 实现
> 2. 参考 Vocal Bridge Developer Guide 中的 Direct WebRTC Integration 方案

## 9. 配置存储

### 9.1 API Key 存储（加密）

**位置**: Tauri secure-storage (系统 Keychain / Credential Manager)

```typescript
// 使用 tauri-plugin-store 或 keytar 进行加密存储
import { Store } from '@tauri-apps/plugin-store';

const secureStore = new Store('.voice-secrets.dat');
await secureStore.set('vocal_bridge_api_key', apiKey);
await secureStore.set('porcupine_access_key', accessKey);
await secureStore.save();
```

### 9.2 普通配置（YAML）

**位置**: `~/.viben/voice.yaml`

```yaml
# API Key 不存储在此文件，使用 Tauri secure-storage

wake_word: "你好微本"
wake_word_model_path: null
builtin_wake_word: "hey google"  # 开发阶段

auto_start_on_launch: false
silence_timeout: 30

enable_sound_effects: true
```

## 10. 错误处理

| 错误 | 检测方式 | 处理 |
|-----|---------|------|
| API Key 未配置 | 启动时检查 | Toast 提示，引导到设置页 |
| 麦克风权限拒绝 | connect() 失败 | Toast 提示授权方式 |
| 网络连接失败 | SDK error 事件 | Toast + 错误音效 |
| Porcupine 加载失败 | start() 失败 | Toast 提示检查 Access Key |
| 语音服务超时 | 30s 无响应 | 自动重连或提示用户 |

## 11. 实现阶段

### 阶段 1: 基础框架

- [ ] 创建 voice-store.ts
- [ ] 创建 types/voice.ts
- [ ] 创建 settings-voice.tsx 基础 UI
- [ ] 添加 voice section 到 settings.tsx

### 阶段 2: Vocal Bridge 集成

- [ ] 创建 vocal-bridge-client.ts
- [ ] 创建 use-voice-agent.ts
- [ ] 实现连接/断开逻辑
- [ ] 实现字幕更新逻辑

### 阶段 3: 波浪联动

- [ ] 修改 wave-layer.tsx 支持凹形
- [ ] 实现多层波浪叠加
- [ ] 与 voice-store 状态联动

### 阶段 4: Canvas 字幕

- [ ] 创建 voice-subtitle-layer.tsx
- [ ] 实现流式文字渲染
- [ ] 实现闪烁光标

### 阶段 5: AI 弹窗

- [ ] 创建 agent-popup-layer.tsx
- [ ] 创建 markdown-renderer.ts
- [ ] 实现 ScrollBox 集成
- [ ] 实现流式 Markdown 渲染

### 阶段 6: 唤醒词

- [ ] 创建 porcupine-engine.ts
- [ ] 创建 use-porcupine.ts
- [ ] 集成内置唤醒词测试
- [ ] (后续) 训练"你好微本"模型

### 阶段 7: 音效与优化

- [ ] 创建 audio-feedback.ts
- [ ] 添加音效文件
- [ ] 错误处理完善
- [ ] 性能优化

## 12. 测试要点

### 12.1 单元测试

- voice-store 状态转换
- Markdown 解析器
- 字符数统计逻辑
- 静默计时逻辑（仅 listening 状态计时）

### 12.2 集成测试

- Vocal Bridge 连接/断开
- Porcupine 唤醒词检测
- 波浪状态联动
- 共享音频流资源管理

### 12.3 E2E 测试

- 完整语音对话流程
- 设置页配置保存/加载
- 多种退出方式
- API Key 加密存储验证

### 12.4 性能测试

- 波浪动画 60fps 验证
- 唤醒词检测延迟 < 500ms
- 语音转文字延迟 < 1s

### 12.5 边界场景测试

- 极长 Agent 回复（>10000 字符）
- 网络抖动/断开重连
- 快速连续唤醒
- 应用最小化时的行为
