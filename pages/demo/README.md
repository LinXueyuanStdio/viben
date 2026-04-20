# 问财语音助手 Demo

自然对话的语音助手演示，支持唤醒词检测、声纹采集、实时字幕。

## 功能特性

### 1. 冷启动声纹采集
- 首次使用时录制3句话
- 声纹数据存储在 localStorage
- 用于后续用户身份识别

### 2. 低成本唤醒词监听
- 使用 Web Speech API（系统级语音识别）
- 唤醒词: "你好问财"
- 检测到唤醒词后播放随机打招呼短语（50种变体）

### 3. 语音对话
- 使用 Vocal Bridge SDK 进行 AI 语音对话
- 实时字幕渲染（用户和 Agent）
- 支持打断
- 说"退下"、"不聊了"等退出对话
- 3分钟无活动自动回到监听状态

## 快速开始

### 1. 配置 API Key

复制 `.env.example` 为 `.env` 并填写你的 Vocal Bridge 凭证:

```bash
cp .env.example .env
```

编辑 `.env`:
```
VOCAL_BRIDGE_API_KEY=vb_your_api_key_here
VOCAL_BRIDGE_AGENT_ID=your-agent-uuid-here
```

> 获取 API Key: https://vocalbridgeai.com/dashboard

### 2. 启动服务器

```bash
./serve.sh
```

或者:
```bash
python3 -m http.server 8080
```

### 3. 打开浏览器

访问 http://localhost:8080

**浏览器要求**: Chrome 或 Safari（需要支持 Web Speech API）

## 使用流程

```
1. 配置 API Key → 页面右上角输入
2. 声纹采集 → 按提示录制3句话
3. 待机监听 → 说"你好问财"
4. 语音对话 → 与 AI 自由交流
5. 结束对话 → 说"退下"或等待超时
```

## 技术架构

| 功能 | 技术方案 |
|------|---------|
| 唤醒词检测 | Web Speech API (SpeechRecognition) |
| 打招呼 TTS | Web Speech API (SpeechSynthesis) |
| AI 语音对话 | Vocal Bridge SDK + WebRTC |
| 声纹存储 | localStorage (Base64) |

## 状态机

```
INIT → CONFIG → COLD_START → LISTENING ⇄ ACTIVE ⇄ SPEAKING
                                ↑                      ↓
                                └──────────────────────┘
                                   (退出或超时)
```

## 自定义配置

修改 `index.html` 中的 `CONFIG` 对象:

```javascript
const CONFIG = {
  wakeWord: '你好问财',           // 唤醒词
  exitPhrases: ['退下', '不聊了'], // 退出短语
  idleTimeout: 3 * 60 * 1000,     // 超时时间 (ms)
};
```

## 注意事项

1. **麦克风权限**: 首次使用需要授权麦克风
2. **HTTPS**: 生产环境需要 HTTPS（localhost 例外）
3. **浏览器**: 仅支持 Chrome/Safari
4. **网络**: 需要稳定网络连接 Vocal Bridge 服务
