# viben provider

> 管理 Viben Provider。Provider 是模型调用能力的配置入口，覆盖 LLM Provider 和媒体生成 Provider。配置使用 file-native YAML，统一存储在 `~/.viben/providers.yaml`，CLI 命令是 MVP 验证入口，Gateway API 和 Desktop 设置页都必须复用 `packages/core/src/providers` 的统一实现。

## Provider 类型

Provider 类型分为两层：

- `type`: 供应商/协议类型，例如 `openai`、`anthropic`、`fal`、`elevenlabs`。
- `category`: 能力类别，取值为 `llm` 或 `media`。

| Type | Category | Description | Auth Methods | Surfaces |
|------|----------|-------------|--------------|----------|
| `openai` | `llm`, `media` | OpenAI API | API Key | `chat`, `image`, `speech` |
| `anthropic` | `llm` | Anthropic API | API Key | `chat` |
| `google` | `llm`, `media` | Google AI / Vertex | API Key, OAuth | `chat`, `image`, `video`, `music` |
| `azure` | `llm`, `media` | Azure OpenAI | API Key, Azure AD | `chat`, `image`, `speech` |
| `openrouter` | `llm`, `media` | OpenRouter | API Key | `chat`, `image`, `video` |
| `ollama` | `llm` | Ollama (local) | None | `chat` |
| `custom` | `llm` | Custom OpenAI-compatible chat API | API Key | `chat` |
| `volcengine` | `media` | Volcengine Ark / Doubao | API Key | `image`, `video`, `speech` |
| `grok` | `media` | xAI Grok Imagine / TTS | API Key / OAuth token | `image`, `video`, `speech` |
| `nanobanana` | `media` | Google Gemini image API / compatible gateway | API Key | `image` |
| `imagerouter` | `media` | OpenAI-compatible image/video router | API Key | `image`, `video` |
| `custom-image` | `media` | Custom OpenAI-compatible image API | API Key | `image` |
| `fal` | `media` | Fal.ai media models | API Key | `image`, `video` |
| `leonardo` | `media` | Leonardo.ai image API | API Key | `image` |
| `minimax` | `media` | MiniMax video / TTS | API Key | `video`, `speech` |
| `elevenlabs` | `media` | ElevenLabs voice / SFX | API Key | `speech`, `sfx` |
| `fishaudio` | `media` | FishAudio speech / clone | API Key | `speech` |
| `senseaudio` | `media` | SenseAudio image / TTS | API Key | `image`, `speech` |
| `aihubmix` | `media` | AIHubMix compatible aggregator | API Key | `image`, `speech` |
| `suno` | `media` | Suno music generation | API Key | `music` |
| `udio` | `media` | Udio music generation | API Key | `music` |

---

## 命令

```bash
# ============================================================
# Provider 管理
# ============================================================

# 列出所有 providers
viben provider list
viben provider list --category llm
viben provider list --category media
viben provider list --surface image
viben provider list --surface video
viben provider list --surface music
viben provider list --surface speech
viben provider list --json

# 创建 provider
viben provider create -n <name> -t <type> -c <config-file>
viben provider create -n <name> -t <type> --auth <auth-method>
viben provider create -n <name> -t <type> --api-key <key>
viben provider create -n <name> -t <type> --api-key <key> --base-url <url>
viben provider create -n <name> -t <type> --category media --surface image --surface video

# 简写 (自动生成名称)
viben provider create -t openai --api-key <key>
viben provider create -t anthropic --api-key <key>
viben provider create -t custom --api-key <key> --base-url https://api.example.com/v1
viben provider create -t fal --category media --api-key <key>
viben provider create -t elevenlabs --category media --api-key <key>

# 删除 provider
viben provider remove -n <name>

# 设置默认 provider
viben provider set-default -n <name>

# 查看 provider 状态 (连通性检查)
viben provider status
viben provider status -n <name>

# 查看 provider 详情
viben provider show -n <name>

# 更新 provider
viben provider update -n <name> --api-key <key>
viben provider update -n <name> --base-url <url>
viben provider update -n <name> --surface image --surface video

# 启用 / 禁用 provider
viben provider enable -n <name>
viben provider disable -n <name>
```

---

## Provider 配置

所有字段使用 snake_case。`providers.<id>.provider_type` 是持久化字段，CLI/API 输出中的 `type` 来自该字段。

```yaml
# ~/.viben/providers.yaml
version: 1

default: anthropic-main
defaults:
  llm: anthropic-main
  media:
    image: openai-media
    video: fal-media
    music: suno-media
    speech: elevenlabs-voice
    sfx: elevenlabs-voice

providers:
  anthropic-main:
    provider_type: anthropic
    category: llm
    surfaces:
      - chat
    api_key: "encrypted:sk-ant-xxx"

  openai-main:
    provider_type: openai
    category: llm
    surfaces:
      - chat
    api_key: "encrypted:sk-xxx"

  azure-gpt4:
    provider_type: azure
    category: llm
    surfaces:
      - chat
    api_key: "encrypted:xxx"
    base_url: "https://my-resource.openai.azure.com"
    api_version: "2024-02-15-preview"
    deployment: "gpt-4-turbo"

  local-ollama:
    provider_type: ollama
    category: llm
    surfaces:
      - chat
    base_url: "http://localhost:11434"

  custom-api:
    provider_type: custom
    category: llm
    surfaces:
      - chat
    api_key: "encrypted:xxx"
    base_url: "https://api.example.com/v1"

  openai-media:
    provider_type: openai
    category: media
    name: OpenAI Media
    api_key: "env:OPENAI_API_KEY"
    base_url: "https://api.openai.com/v1"
    surfaces:
      - image
      - speech
    enabled: true

  fal-media:
    provider_type: fal
    category: media
    name: Fal.ai
    api_key: "env:FAL_KEY"
    base_url: "https://fal.run"
    surfaces:
      - image
      - video
    supports_custom_model: true
    enabled: true

  elevenlabs-voice:
    provider_type: elevenlabs
    category: media
    name: ElevenLabs
    api_key: "env:ELEVENLABS_API_KEY"
    base_url: "https://api.elevenlabs.io"
    surfaces:
      - speech
      - sfx
    enabled: true
```

### Provider 字段

| Field | Required | Description |
|-------|----------|-------------|
| `provider_type` | Yes | 供应商/协议类型。旧配置中的 `type` 读取时兼容，写回时统一为 `provider_type`。 |
| `category` | No | `llm` 或 `media`。未设置时默认 `llm`。 |
| `name` | No | 展示名称。未设置时使用 provider id。 |
| `api_key` | No | 明文、`env:VAR_NAME` 或后续加密值。 |
| `base_url` | No | API endpoint。未设置时由 provider registry 提供默认值。 |
| `surfaces` | No | Provider 支持的能力面。LLM 默认为 `chat`，媒体 Provider 必须至少有一个媒体 surface。 |
| `supports_custom_model` | No | 是否允许在模型配置中写自定义 model id。 |
| `headers` | No | 额外请求头。 |
| `timeout` | No | 秒级请求超时。 |
| `max_retries` | No | 最大重试次数。 |
| `enabled` | No | 是否启用。默认为 `true`。 |
| `created_at` / `updated_at` | No | 由 core 写入。 |

---

## Core / CLI / Gateway 边界

- `packages/core/src/providers/index.ts` 是 Provider 配置的唯一实现入口，负责读取、校验、默认值、状态检查和 YAML 写回。
- `packages/core/src/providers/types.ts` 定义 Provider registry、ProviderEntry、ProviderCategory、ProviderSurface、ProviderType。
- `packages/core/src/cli/commands/provider.ts` 只做参数解析、输出格式化和调用 core，不直接读写 YAML。
- `packages/core/src/gateway/routes/providers.ts` 只做 HTTP 参数转换，API query/body/response 字段必须使用 snake_case。
- Desktop 设置页通过 Gateway client 调用 `/api/providers`，不能直接访问本地 YAML。
- `packages/core/src/providers/ops` 中已有 provider 实现需要并入统一 ProviderManager 或作为 ProviderManager 的内部 ops，不能成为第二套配置源。

---

## Gateway API

```http
GET /api/providers?category=media&surface=image
GET /api/providers/:id
POST /api/providers
PATCH /api/providers/:id
DELETE /api/providers/:id
PUT /api/providers/default
PUT /api/providers/defaults/media/:surface
POST /api/providers/:id/enable
POST /api/providers/:id/disable
POST /api/providers/:id/test
GET /api/providers/:id/models?surface=image
```

### `POST /api/providers` body

```json
{
  "type": "fal",
  "category": "media",
  "name": "Fal.ai",
  "api_key": "env:FAL_KEY",
  "base_url": "https://fal.run",
  "surfaces": ["image", "video"],
  "supports_custom_model": true,
  "set_as_default": false
}
```

### Provider response

```json
{
  "id": "fal-ai",
  "type": "fal",
  "category": "media",
  "name": "Fal.ai",
  "base_url": "https://fal.run",
  "surfaces": ["image", "video"],
  "supports_custom_model": true,
  "is_default": false,
  "enabled": true,
  "created_at": "2026-06-09T15:00:00.000Z",
  "updated_at": "2026-06-09T15:00:00.000Z"
}
```

---

## 输出示例

**`viben provider list` (Human)**:
```
Providers:
  anthropic-main*   llm     anthropic    chat             ✓ connected
  openai-main       llm     openai       chat             ✓ connected
  local-ollama      llm     ollama       chat             ○ not running
  openai-media      media   openai       image,speech     ✓ connected
  fal-media         media   fal          image,video      ✓ connected
  elevenlabs-voice  media   elevenlabs   speech,sfx       ✓ connected

* = default provider
```

**`viben provider list --category media --surface video` (Human)**:
```
Providers:
  fal-media     fal          image,video   ✓ connected
  openrouter    openrouter   image,video   ✓ connected
```

**`viben provider status` (Human)**:
```
Provider Status:
  anthropic-main   anthropic   ✓ connected   latency: 120ms
  openai-main      openai      ✓ connected   latency: 85ms
  azure-gpt4       azure       ✓ connected   latency: 150ms
  local-ollama     ollama      ✗ error       connection refused
  custom-api       custom      ✓ connected   latency: 200ms
```

---

## 环境变量

Provider 配置使用标准环境变量名称，用户可以：
1. 直接设置环境变量（推荐，不在配置文件中存储密钥）
2. 在配置文件中使用 `env:VAR_NAME` 引用环境变量
3. 在配置文件中使用 `encrypted:xxx` 存储加密值

### 支持的环境变量

| Provider | API Key | Base URL | 其他 |
|----------|---------|----------|------|
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` | - |
| `openai` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_ORG_ID` |
| `azure` | `AZURE_OPENAI_API_KEY` | `AZURE_OPENAI_ENDPOINT` | `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT` |
| `google` | `GOOGLE_API_KEY` | - | `GOOGLE_PROJECT_ID`, `GOOGLE_LOCATION` |
| `openrouter` | `OPENROUTER_API_KEY` | - | - |
| `ollama` | - | `OLLAMA_HOST` | - |
| `custom` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | - |
| `volcengine` | `ARK_API_KEY`, `VOLCENGINE_API_KEY` | `VOLCENGINE_BASE_URL` | - |
| `grok` | `XAI_API_KEY` | `XAI_BASE_URL` | - |
| `fal` | `FAL_KEY` | `FAL_BASE_URL` | - |
| `elevenlabs` | `ELEVENLABS_API_KEY` | `ELEVENLABS_BASE_URL` | - |
| `fishaudio` | `FISH_AUDIO_API_KEY` | `FISH_AUDIO_BASE_URL` | - |
| `senseaudio` | `SENSEAUDIO_API_KEY` | `SENSEAUDIO_BASE_URL` | - |
| `aihubmix` | `AIHUBMIX_API_KEY` | `AIHUBMIX_BASE_URL` | - |
| `suno` | `SUNO_API_KEY` | `SUNO_BASE_URL` | - |
| `udio` | `UDIO_API_KEY` | `UDIO_BASE_URL` | - |

### 环境变量优先级

Provider 配置读取顺序：
1. 命令行参数 (`--api-key`)
2. 配置文件中的显式值
3. Provider 特定环境变量 (如 `ANTHROPIC_API_KEY`)
4. 通用环境变量 (如 `OPENAI_API_KEY` for custom type)

### 快速配置示例

```bash
# 只需设置环境变量，无需编辑配置文件
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"

# 创建 provider (自动使用环境变量)
viben provider create -t anthropic
viben provider create -t openai

# 或显式指定 (会加密存储)
viben provider create -t anthropic --api-key "sk-ant-xxx"
```

---

## Acceptance Criteria

### Provider Management
- [ ] `viben provider list` 列出所有 providers
- [ ] `viben provider list --category media` 只列出媒体 Provider
- [ ] `viben provider list --surface image` 只列出支持图片生成的 Provider
- [ ] `viben provider create -n <name> -t <type>` 创建 provider
- [ ] `viben provider create -t fal --category media --surface image --surface video` 创建媒体 Provider
- [ ] `viben provider create -t <type> --api-key <key>` 快速创建
- [ ] `viben provider remove -n <name>` 删除 provider
- [ ] `viben provider set-default -n <name>` 设置默认 provider
- [ ] `viben provider status` 检查 provider 连通性
- [ ] 支持 provider 类型: openai, anthropic, google, azure, openrouter, ollama, custom
- [ ] 支持媒体 provider 类型: volcengine, grok, nanobanana, imagerouter, custom-image, fal, leonardo, minimax, elevenlabs, fishaudio, senseaudio, aihubmix, suno, udio
- [ ] 旧配置中的 `type` 字段读取兼容，写回统一为 `provider_type`
- [ ] Gateway API query/body/response 使用 snake_case
- [ ] Desktop 设置页只通过 Gateway API 配置 Provider

---

## Related Documents

- [model.md](./model.md) - Model 管理
- [agent.md](./agent.md) - Agent 管理
