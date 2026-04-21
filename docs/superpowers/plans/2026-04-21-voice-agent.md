# 语音交互功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Viben Desktop 添加语音交互能力，支持唤醒词激活、实时语音对话、炫彩波浪动画和流式字幕显示。

**Architecture:** 使用 openWakeWord (WASM + ONNX) 进行本地唤醒词检测，Vocal Bridge SDK 处理 WebRTC 语音通信，SharedAudioStream 统一管理麦克风资源，voice-store 管理状态，PixiJS Canvas 渲染波浪和字幕。Python 训练项目位于 `backend/wakeword`，用于训练自定义唤醒词模型。

**Tech Stack:** openwakeword-wasm-browser, onnxruntime-web, Vocal Bridge SDK, Zustand, PixiJS, @pixi/ui, marked.js, Tauri secure-storage

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
| `apps/desktop/src/components/overlay/layers/voice-subtitle-layer.tsx` | 语音字幕层 | 新建 |
| `apps/desktop/src/lib/voice/markdown-renderer.ts` | Canvas Markdown 渲染 | 新建 |
| `apps/desktop/src/components/overlay/layers/agent-popup-layer.tsx` | AI 回复弹窗 | 新建 |
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
