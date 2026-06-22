# viben provider

> 管理 Viben Provider。Provider 是模型调用能力的配置入口，覆盖 LLM Provider 和媒体生成 Provider。配置使用 file-native YAML，Provider 和 Model 统一存储在 `~/.viben/models.yaml`，CLI 命令是 MVP 验证入口，Gateway API 和 Desktop 设置页都必须复用 `packages/core/src/providers` 的统一实现。

## Provider 类型

Provider 标识分为三层，不能混用：

- `provider_id`: Provider 实例 ID，也是 `models.yaml` 的顶层 key，例如 `openai-main`、`anthropic-main`。
- `type`: Provider 协议/API 格式，例如 `openai`、`openai-responses`、`anthropic`、`fal`、`elevenlabs`。`type` 不是 Provider ID，不能作为 `provider_id` fallback。
- `category`: 能力类别，取值为 `llm` 或 `media`。

`type` 必须非空。`openai` 和 `anthropic` 默认表示 chat/completion 兼容接口；`openai-responses` 表示 OpenAI Responses API 格式。

| Type | Default Category | Description | Default Base URL | API Key Env |
|------|------------------|-------------|------------------|-------------|
| `openai` | `llm` | OpenAI chat/completion compatible API | `https://api.openai.com/v1` | `OPENAI_API_KEY` |
| `openai-responses` | `llm` | OpenAI Responses API | `https://api.openai.com/v1` | `OPENAI_API_KEY` |
| `anthropic` | `llm` | Anthropic API | `https://api.anthropic.com/v1` | `ANTHROPIC_API_KEY` |
| `azure` | `llm` | Azure OpenAI | 自定义 endpoint | `AZURE_OPENAI_API_KEY` |
| `ollama` | `llm` | Ollama local API | `http://localhost:11434` | - |
| `openrouter` | `llm` | OpenRouter | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` |
| `google` | `llm` | Google Generative Language API | `https://generativelanguage.googleapis.com/v1beta` | `GOOGLE_API_KEY` |
| `volcengine` | `media` | Volcengine Ark / Doubao | `https://ark.cn-beijing.volces.com/api/v3` | `ARK_API_KEY` |
| `grok` | `media` | xAI Grok media API | `https://api.x.ai/v1` | `XAI_API_KEY` |
| `nanobanana` | `media` | Google Gemini image API / compatible gateway | `https://generativelanguage.googleapis.com` | `GEMINI_API_KEY` |
| `imagerouter` | `media` | ImageRouter compatible API | `https://api.imagerouter.io/v1/openai` | `IMAGEROUTER_API_KEY` |
| `fal` | `media` | Fal.ai media models | `https://fal.run` | `FAL_KEY` |
| `leonardo` | `media` | Leonardo.ai image API | `https://cloud.leonardo.ai/api/rest/v1` | `LEONARDO_API_KEY` |
| `minimax` | `media` | MiniMax video / TTS | `https://api.minimaxi.chat/v1` | `MINIMAX_API_KEY` |
| `elevenlabs` | `media` | ElevenLabs voice / SFX | `https://api.elevenlabs.io` | `ELEVENLABS_API_KEY` |
| `fishaudio` | `media` | FishAudio speech / clone | `https://api.fish.audio` | `FISH_AUDIO_API_KEY` |
| `senseaudio` | `media` | SenseAudio image / TTS | `https://api.senseaudio.cn` | `SENSEAUDIO_API_KEY` |
| `aihubmix` | `media` | AIHubMix compatible aggregator | `https://aihubmix.com/v1` | `AIHUBMIX_API_KEY` |
| `suno` | `media` | Suno music generation | 自定义 endpoint | `SUNO_API_KEY` |
| `udio` | `media` | Udio music generation | 自定义 endpoint | `UDIO_API_KEY` |

实现不会按 `type` 强制固定 `surfaces`。合法 surface 为 `chat`、`image`、`video`、`music`、`speech`、`sfx`；未显式传入时，`llm` 默认 `chat`，`media` 默认空数组，Desktop 可按页面上下文补充展示。

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
viben provider create -n <name> -t <type> --timeout 60 --max-retries 2 --default

# 简写 (自动生成名称)
viben provider create -t openai --api-key <key>
viben provider create -t openai-responses --api-key <key>
viben provider create -t anthropic --api-key <key>
viben provider create -t fal --category media --api-key <key>
viben provider create -t elevenlabs --category media --api-key <key>

# 删除 provider
viben provider remove -n <name>
viben provider rm -n <name>

# 设置默认 provider
viben provider set-default -n <name>

# 查看 provider 状态 (连通性检查)
viben provider status
viben provider status -n <name>

# 查看 provider 详情
viben provider show -n <name>

# 更新 provider
viben provider update -n <name> --type openai-responses
viben provider update -n <name> --category media
viben provider update -n <name> --api-key <key>
viben provider update -n <name> --base-url <url>
viben provider update -n <name> --display-name "OpenAI Responses"
viben provider update -n <name> --surface image --surface video
viben provider update -n <name> --timeout 60 --max-retries 2

# 启用 / 禁用 provider
viben provider enable -n <name>
viben provider disable -n <name>

# 查看支持的 provider type、默认 base URL 和 API key 环境变量
viben provider types
```

说明：

- `provider create` 不传 `-t/--type` 时默认 `openai`；不传 `-n/--name` 时使用 `${type}-${Date.now()}` 生成名称，并由 core slug 化为 provider id。
- `--config` 和 `--auth` 当前只是保留参数，CLI 声明了选项但不会写入 ProviderManager；文档不能把它们描述为已实现的配置文件导入或 OAuth/Azure AD 鉴权。
- `provider status` 当前是配置可用性检查，不是实际联网测速。对需要 API key 的类型会检查 key 是否存在，通过后返回 connected；`ollama` 等不需要 key 的类型不会因缺少 key 失败。

---

## Provider 配置

所有字段使用 snake_case。Provider 和它下属的模型只写入 `~/.viben/models.yaml`；不再读取或写入 `~/.viben/providers.yaml`。顶层 key 必须是 `provider_id`，Provider 节点内的 `id` 必须与顶层 key 一致，`type` 必须非空。

```yaml
# ~/.viben/models.yaml
anthropic-main:
  id: anthropic-main
  type: anthropic
  name: Anthropic
  category: llm
  base_url: https://api.anthropic.com/v1
  api_key: "sk-ant-xxx"
  surfaces:
    - chat
  is_default: true
  enabled: true
  models:
    claude-sonnet-4-5:
      name: Claude Sonnet 4.5
      enabled: true
      category: llm
      surface: chat

openai-main:
  id: openai-main
  type: openai-responses
  name: OpenAI Responses
  category: llm
  base_url: https://api.openai.com/v1
  api_key: "sk-xxx"
  surfaces:
    - chat
  enabled: true
  models:
    gpt-5:
      name: GPT-5
      enabled: true
      category: llm
      surface: chat

fal-media:
  id: fal-media
  type: fal
  name: Fal.ai
  category: media
  base_url: https://fal.run
  api_key: "fal-key"
  surfaces:
    - image
    - video
  supports_custom_model: true
  enabled: true
  models:
    flux-pro-ultra:
      name: Flux Pro Ultra
      enabled: true
      category: media
      surface: image
```

### Provider 字段

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Provider 实例 ID。必须与 `models.yaml` 顶层 key 一致。 |
| `type` | Yes | Provider 协议/API 格式。不能为空，不能 fallback 到 `provider_id`，也不能把 `provider_id` 当 `type`。 |
| `category` | No | `llm` 或 `media`。未设置时默认 `llm`。 |
| `name` | No | 展示名称。未设置时使用 provider id。 |
| `api_key` | No | API key。读取路径兼容旧 `apiKey`，写回必须统一为 `api_key`。当前 YAML 不实现 `env:` 运行时解析；CLI create 未传 key 时会尝试从对应环境变量读取并写入该字段。 |
| `base_url` | No | API endpoint。未设置时由 provider registry 提供默认值。 |
| `api_version` / `deployment` | No | Azure 等 provider 的补充字段。 |
| `surfaces` | No | Provider 支持的能力面。合法值为 `chat`、`image`、`video`、`music`、`speech`、`sfx`。 |
| `supports_custom_model` | No | 是否允许在模型配置中写自定义 model id。 |
| `headers` | No | 额外请求头。 |
| `timeout` | No | 秒级请求超时。 |
| `max_retries` | No | 最大重试次数。 |
| `is_default` | No | Provider 默认标记。模型默认值持久化已移除，不要与模型默认混用。 |
| `enabled` | No | 是否启用。默认为 `true`。 |
| `created_at` / `updated_at` | No | 由 core 写入。 |
| `models` | Yes | 该 Provider 下配置过的模型。模型以 `model_id` 为 key，value 必须是对象，写入 `name`、`enabled`、`config` 等字段。 |

历史兼容：

- 读取旧 `provider_type` 时会规范化为 `type`，写回只保留 `type`。
- 读取旧 `apiKey` 时会规范化为 `api_key`，写回只保留 `api_key`。
- 不存在 `custom` 或 `custom-image` Provider type；OpenAI 兼容接口应使用已有协议 type 和明确的 Provider 实例 ID。

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
GET /api/providers/default
PUT /api/providers/default
POST /api/providers/reload
GET /api/providers?category=media&surface=image
POST /api/providers
GET /api/providers/:id
PATCH /api/providers/:id
DELETE /api/providers/:id
POST /api/providers/:id/enable
POST /api/providers/:id/disable
POST /api/providers/:id/test
GET /api/providers/:id/discover-models
GET /api/providers/:id/models
POST /api/providers/:provider_id/models/:model_id/enable
POST /api/providers/:provider_id/models/:model_id/disable
GET /api/providers/api-keys
POST /api/providers/validate-key
GET /api/providers/api-keys/all
```

Gateway 契约使用 `type`，不是 `provider_type`。Desktop hook 可以把 response 的 `type` 映射为 UI 内部的 `provider_type` 字段，但 Gateway body/response 和 YAML 都不能把 `provider_type` 当新契约。

### `POST /api/providers` body

```json
{
  "type": "fal",
  "category": "media",
  "name": "Fal.ai",
  "api_key": "fal-key",
  "base_url": "https://fal.run",
  "surfaces": ["image", "video"],
  "supports_custom_model": true,
  "set_as_default": false
}
```

`PATCH /api/providers/:id` 支持更新 `type`、`category`、`name`、`api_key`、`base_url`、`timeout`、`max_retries`、`surfaces` 等字段。`POST /api/providers/:id/enable|disable` 会写入配置文件中的 `enabled`，不是只改 UI 状态。

`GET /api/providers/:id/discover-models` 只返回从 Provider API 发现的模型，不写入 `models.yaml`，也不带用户启用状态。当前支持真实发现的类型包括 `openai`、`openai-responses`、`ollama`、`openrouter`、`google`；`anthropic`、`azure` 返回空列表，媒体类 Provider 当前返回 unsupported。用户在 Desktop 点击模型 toggle 后，才通过 provider-scoped enable API 把对应模型写入 `models.yaml`。

`GET /api/providers/:id/models` 返回已配置到该 `provider_id` 下的 models，不读取 `surface` query 做过滤。过滤可以在 Desktop 根据模型 `surface` 字段完成。

API key 端点：

- `GET /api/providers/api-keys`: 返回按 provider type 推断的 key 配置状态。
- `POST /api/providers/validate-key`: body 使用 `{ "provider_id": "...", "api_key": "..." }`，用于验证指定 Provider 的 key。
- `GET /api/providers/api-keys/all`: 返回所有 Provider 的 key 状态。

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
  anthropic-main   anthropic          ✓ connected   latency: -
  openai-main      openai-responses   ✓ connected   latency: -
  azure-gpt4       azure              ✗ error       API key not configured
  local-ollama     ollama             ✓ connected   latency: -
```

---

## 环境变量

CLI 创建 Provider 时，如果没有传 `--api-key`，会按 provider type 读取标准环境变量，并把读取到的值写入 `api_key`。当前 YAML 读取路径不会解析 `env:VAR_NAME`，也不会自动解密 `encrypted:xxx`；这些字符串只会作为普通 `api_key` 值保存。

### 支持的环境变量

| Provider | API Key | Base URL | 其他 |
|----------|---------|----------|------|
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` | - |
| `openai` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_ORG_ID` |
| `openai-responses` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | - |
| `azure` | `AZURE_OPENAI_API_KEY` | `AZURE_OPENAI_ENDPOINT` | `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT` |
| `google` | `GOOGLE_API_KEY` | - | `GOOGLE_PROJECT_ID`, `GOOGLE_LOCATION` |
| `openrouter` | `OPENROUTER_API_KEY` | - | - |
| `ollama` | - | `OLLAMA_HOST` | - |
| `volcengine` | `ARK_API_KEY` | `VOLCENGINE_BASE_URL` | - |
| `grok` | `XAI_API_KEY` | `XAI_BASE_URL` | - |
| `nanobanana` | `GEMINI_API_KEY` | - | - |
| `imagerouter` | `IMAGEROUTER_API_KEY` | - | - |
| `fal` | `FAL_KEY` | `FAL_BASE_URL` | - |
| `leonardo` | `LEONARDO_API_KEY` | - | - |
| `minimax` | `MINIMAX_API_KEY` | - | - |
| `elevenlabs` | `ELEVENLABS_API_KEY` | `ELEVENLABS_BASE_URL` | - |
| `fishaudio` | `FISH_AUDIO_API_KEY` | `FISH_AUDIO_BASE_URL` | - |
| `senseaudio` | `SENSEAUDIO_API_KEY` | `SENSEAUDIO_BASE_URL` | - |
| `aihubmix` | `AIHUBMIX_API_KEY` | `AIHUBMIX_BASE_URL` | - |
| `suno` | `SUNO_API_KEY` | `SUNO_BASE_URL` | - |
| `udio` | `UDIO_API_KEY` | `UDIO_BASE_URL` | - |

### 环境变量优先级

Provider create 的 key 来源顺序：
1. 命令行参数 (`--api-key`)
2. Provider type 对应环境变量（如 `ANTHROPIC_API_KEY`）
3. 未找到 key 时仍可创建 Provider，但 status 可能显示 key 缺失

### 快速配置示例

```bash
# 只需设置环境变量，无需编辑配置文件
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"

# 创建 provider (自动使用环境变量)
viben provider create -t anthropic
viben provider create -t openai

# 或显式指定
viben provider create -t anthropic --api-key "sk-ant-xxx"
```

---

## Acceptance Criteria

### Provider Management
- [x] `viben provider list` 列出所有 providers
- [x] `viben provider list --category media` 只列出媒体 Provider
- [x] `viben provider list --surface image` 只列出支持图片生成的 Provider
- [x] `viben provider create -n <name> -t <type>` 创建 provider
- [x] `viben provider create -t fal --category media --surface image --surface video` 创建媒体 Provider
- [x] `viben provider create -t <type> --api-key <key>` 快速创建
- [x] `viben provider remove -n <name>` 删除 provider
- [x] `viben provider rm -n <name>` 删除 provider
- [x] `viben provider set-default -n <name>` 设置默认 provider
- [x] `viben provider status` 检查 provider 配置可用性
- [x] `viben provider types` 输出 type、默认 base URL、API key 环境变量
- [x] 支持 provider 类型: openai, openai-responses, anthropic, google, azure, openrouter, ollama
- [x] 支持媒体 provider 类型: volcengine, grok, nanobanana, imagerouter, fal, leonardo, minimax, elevenlabs, fishaudio, senseaudio, aihubmix, suno, udio
- [x] 不支持 `custom` 和 `custom-image` provider type
- [x] 旧配置中的 `provider_type` 字段读取兼容，写回统一为 `type`
- [x] 旧配置中的 `apiKey` 字段读取兼容，写回统一为 `api_key`
- [x] Provider 与 Model 统一写入 `~/.viben/models.yaml`，不再写入 `providers.yaml`
- [x] Gateway API query/body/response 使用 snake_case
- [x] Gateway 覆盖 default、reload、discover models、provider-scoped model enable/disable、API key endpoints
- [x] Discover models 未启用前不写入 YAML，启用后写入对应 `provider_id.models[model_id]`
- [x] Desktop 设置页只通过 Gateway API 配置 Provider

---

## Related Documents

- [model.md](./model.md) - Model 管理
- [agent.md](./agent.md) - Agent 管理
