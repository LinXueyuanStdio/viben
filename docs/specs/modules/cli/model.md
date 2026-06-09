# viben model

> 管理 Viben models、别名、回退链和模型能力。Model 是具体可调用模型的配置入口，覆盖 LLM 模型和媒体生成模型。配置使用 file-native YAML，统一存储在 `~/.viben/models.yaml`，CLI 命令是 MVP 验证入口，Gateway API 和 Desktop 设置页都必须复用 `packages/core/src/models` 的统一实现。

## Model 类别和媒体 Surface

Model 使用统一 schema，通过字段区分能力：

- `category`: `llm` 或 `media`。
- `surface`: `chat`、`image`、`video`、`music`、`speech`、`sfx`。
- `capabilities`: 更细粒度能力标签，例如 `t2i`、`i2i`、`inpaint`、`t2v`、`i2v`、`tts`、`voice_clone`。

媒体模型指生成图片、生成视频、生成音乐、生成声音、生成音效等多媒体生成模型，不包含普通文本聊天模型。

## 命令

```bash
# ============================================================
# Model 管理
# ============================================================

# 列出可用 models
viben model list
viben model list --provider <provider-name>
viben model list --category llm
viben model list --category media
viben model list --surface image
viben model list --surface video
viben model list --surface music
viben model list --surface speech
viben model list --json

# 查看 model 详情
viben model show -n <model>

# 查看 model 状态
viben model status

# 设置默认 model
viben model set-default -n <model>
viben model set-default -n <model> --surface image
viben model set-default -n <model> --surface video
viben model set-default -n <model> --surface music
viben model set-default -n <model> --surface speech

# 创建自定义 model
viben model create -n <model> --provider <provider-name> --category media --surface image
viben model create -n <model> --provider <provider-name> --category media --surface video --capability t2v --capability i2v

# 启用 / 禁用 model
viben model enable -n <model>
viben model disable -n <model>

# ============================================================
# Model Alias (别名)
# ============================================================

# 列出别名
viben model alias list

# 创建别名
viben model alias create -n <name> -m <model>
viben model alias create -n fast -m claude-3-5-haiku-latest
viben model alias create -n smart -m claude-sonnet-4-20250514
viben model alias create -n best -m claude-opus-4-20250514

# 删除别名
viben model alias remove -n <name>

# 解析别名
viben model alias resolve -n <name>

# ============================================================
# Model Fallback (回退链)
# ============================================================

# 列出回退链
viben model fallback list

# 设置回退链 (支持空格或逗号分隔)
viben model fallback set <models...>
viben model fallback set claude-sonnet-4-20250514 gpt-4-turbo claude-3-5-haiku-latest

# 添加到回退链
viben model fallback add -n <model>

# 从回退链移除
viben model fallback remove -n <model>

# 清空回退链
viben model fallback clear

# ============================================================
# Model Config (模型特定配置)
# ============================================================

# 查看模型配置
viben model config show -n <model>

# 设置模型配置
viben model config set -n <model> --temperature <value> --max-tokens <value>

# 删除模型配置
viben model config remove -n <model>

# ============================================================
# Model Providers
# ============================================================

# 列出可用 providers
viben model providers
viben model providers --category media
viben model providers --surface image
```

---

## Model 配置

所有字段使用 snake_case。旧配置中的 `model_config` 继续读取兼容，写回时可以保留 `model_config` 命名；自定义模型必须写入 `custom_models`。

```yaml
# ~/.viben/models.yaml
version: 1

default: claude-sonnet-4-20250514
defaults:
  llm: claude-sonnet-4-20250514
  media:
    image: gpt-image-2
    video: doubao-seedance-2-0-260128
    music: suno-v5
    speech: elevenlabs-v3
    sfx: elevenlabs-sfx

# 模型别名
aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  best: claude-opus-4-20250514
  gpt: gpt-4-turbo
  image: gpt-image-2
  video: doubao-seedance-2-0-260128
  voice: elevenlabs-v3

# 回退链 (按顺序尝试)
fallbacks:
  - claude-sonnet-4-20250514
  - gpt-4-turbo
  - claude-3-5-haiku-latest
fallbacks_by_surface:
  image:
    - gpt-image-2
    - flux-dev-fal
  video:
    - doubao-seedance-2-0-260128
    - veo-3-fal
  speech:
    - elevenlabs-v3
    - fish-speech-2

# 模型特定配置
model_config:
  claude-sonnet-4-20250514:
    provider: anthropic-main
    max_tokens: 8192
    temperature: 0.7

  gpt-4-turbo:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  gpt-image-2:
    provider: openai-media
    category: media
    surface: image
    size: 1024x1024

  doubao-seedance-2-0-260128:
    provider: volcengine-media
    category: media
    surface: video
    duration_seconds: 8
    aspect_ratio: "16:9"

  elevenlabs-v3:
    provider: elevenlabs-voice
    category: media
    surface: speech
    voice_id: default

custom_models:
  fal-custom-video:
    name: Fal Custom Video
    provider: fal-media
    category: media
    surface: video
    capabilities:
      - t2v
      - i2v
    enabled: true
    created_at: "2026-06-09T15:00:00.000Z"
    updated_at: "2026-06-09T15:00:00.000Z"

disabled_models:
  - old-image-model
```

---

## Model 字段

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | 模型稳定 ID。内置模型由 registry 提供，自定义模型由用户指定。 |
| `name` | Yes | 展示名称。 |
| `provider` | Yes | Provider id 或 provider type。新实现中自定义模型应优先保存 provider id。 |
| `category` | No | `llm` 或 `media`。未设置时默认 `llm`。 |
| `surface` | No | `chat`、`image`、`video`、`music`、`speech`、`sfx`。LLM 默认 `chat`。媒体模型必须设置。 |
| `capabilities` | No | 能力标签。媒体常用 `t2i`、`i2i`、`inpaint`、`t2v`、`i2v`、`audio`、`music`、`tts`、`voice_clone`、`sfx`。 |
| `context_window` | No | LLM 上下文长度。 |
| `max_output_tokens` | No | LLM 最大输出词元。 |
| `duration_seconds` | No | 视频/音频默认时长。 |
| `aspect_ratio` | No | 图片/视频默认画幅。 |
| `size` | No | 图片/视频默认尺寸。 |
| `voice_id` | No | 语音模型默认音色。 |
| `enabled` | No | 是否启用。 |
| `created_at` / `updated_at` | No | 自定义模型时间戳。 |

---

## 内置媒体 Provider / Model Registry

`packages/core/src/models/known-models.ts` 需要扩展为统一模型 registry，覆盖 LLM 和媒体模型。媒体模型列表参考 `/root/github/others/open-design/apps/web/src/media/models.ts` 和 `/root/github/others/open-design/apps/daemon/src/media-models.ts`，但 Viben 只引入配置和能力元数据，不照搬 Open Design 的生成调度运行时。

首批应包含这些 Provider 和典型模型：

| Surface | Provider | Models |
|---------|----------|--------|
| `image` | `openai` | `gpt-image-2`, `gpt-image-1.5`, `gpt-image-1`, `dall-e-3` |
| `image` | `volcengine` | `doubao-seedream-3-0-t2i-250415`, `doubao-seededit-3-0-i2i-250628` |
| `image` | `fal` | `flux-pro-ultra`, `flux-dev-fal`, `ideogram-v3-fal`, `recraft-v3-fal` |
| `image` | `senseaudio` | `senseaudio-image-2.0-260319`, `doubao-seedream-5-0-260128` |
| `video` | `volcengine` | `doubao-seedance-2-0-260128`, `doubao-seedance-2-0-fast-260128` |
| `video` | `grok` | `grok-imagine-video` |
| `video` | `fal` | `veo-3-fal`, `veo-2-fal`, `sora-2`, `sora-2-pro`, `wan-2.1-t2v`, `wan-2.1-i2v` |
| `video` | `minimax` | `minimax-video-01` |
| `music` | `suno` | `suno-v5`, `suno-v4-5` |
| `music` | `udio` | `udio-v2` |
| `music` | `google` | `lyria-2` |
| `speech` | `elevenlabs` | `elevenlabs-v3` |
| `speech` | `fishaudio` | `fish-speech-2` |
| `speech` | `minimax` | `minimax-tts` |
| `speech` | `openai` | `gpt-4o-mini-tts` |
| `sfx` | `elevenlabs` | `elevenlabs-sfx` |

---

## Core / CLI / Gateway 边界

- `packages/core/src/models/index.ts` 是 Model 配置的唯一实现入口，负责读取、校验、默认值、别名、回退链、模型启用状态和 YAML 写回。
- `packages/core/src/model/index.ts` 如果存在，应作为兼容入口 re-export `packages/core/src/models`；不能出现第二套实现。当前目录名以 `models` 为准，除非整体迁移。
- `packages/core/src/models/types.ts` 定义 ModelCategory、ModelSurface、ModelCapability、ModelsFile、ModelEntry。
- `packages/core/src/cli/commands/model.ts` 只做参数解析、输出格式化和调用 core，不直接读写 YAML。
- `packages/core/src/gateway/routes/models.ts` 只做 HTTP 参数转换，API query/body/response 字段必须使用 snake_case。
- Desktop 设置页通过 Gateway client 调用 `/api/models` 和 `/api/providers`，不能直接访问本地 YAML。
- `packages/core/src/acp/{index.ts,types.ts,ops/...}` 的分层方式作为重构参考：`index.ts` 只导出类型和 manager，业务逻辑放到 `ops`，route/CLI 不越过 manager。

---

## Gateway API

```http
GET /api/models?category=media&surface=image&provider_id=openai-media
GET /api/models/:id
POST /api/models
PATCH /api/models/:id
DELETE /api/models/:id
PUT /api/models/default
PUT /api/models/defaults/media/:surface
POST /api/models/:id/enable
POST /api/models/:id/disable
GET /api/models/aliases
POST /api/models/aliases
GET /api/models/fallbacks
GET /api/models/fallbacks/:surface
PUT /api/models/fallbacks/:surface
```

### `POST /api/models` body

```json
{
  "id": "fal-custom-video",
  "name": "Fal Custom Video",
  "provider_id": "fal-media",
  "category": "media",
  "surface": "video",
  "capabilities": ["t2v", "i2v"],
  "set_as_default": false
}
```

### Model response

```json
{
  "id": "gpt-image-2",
  "name": "gpt-image-2",
  "provider": "openai",
  "provider_id": "openai-media",
  "provider_name": "OpenAI Media",
  "category": "media",
  "surface": "image",
  "capabilities": ["t2i", "i2i", "inpaint"],
  "is_default": true,
  "enabled": true,
  "is_available": true
}
```

---

## Desktop 设置页

Desktop 设置页的 `model` section 需要在同一页面中配置 LLM 和媒体模型：

- 顶部使用 Tabs 或 segmented control 切换 `LLM`、`图片`、`视频`、`音乐`、`声音`、`音效`。
- Provider 列表显示对应 surface 的 Provider，支持新增、编辑 API key、base URL、启用/禁用、设置默认。
- Model 列表显示对应 surface 的模型，支持启用/禁用、设置默认、添加自定义模型。
- 媒体模型必须显示 capability 标签，例如 `t2i`、`i2i`、`t2v`、`i2v`、`tts`。
- API key 不在 UI 中明文回显，只显示是否已配置和短前缀。
- 所有数据经 Gateway client 获取，不直接读写 `~/.viben/*.yaml`。

---

## 完整 Model 配置示例

```yaml
# ~/.viben/models.yaml
version: 1

# 默认模型
default: claude-sonnet-4-20250514

# ============================================================
# 模型别名 (Aliases)
# 使用短名称引用常用模型
# ============================================================
aliases:
  # 速度优先
  fast: claude-3-5-haiku-latest
  quick: gpt-4o-mini

  # 智能优先
  smart: claude-sonnet-4-20250514
  balanced: gpt-4o

  # 最强能力
  best: claude-opus-4-20250514
  powerful: gpt-4-turbo

  # 特定用途
  code: claude-sonnet-4-20250514
  chat: claude-3-5-haiku-latest
  reasoning: o1-preview

  # Provider 特定
  gpt: gpt-4-turbo
  claude: claude-sonnet-4-20250514
  gemini: gemini-1.5-pro

# ============================================================
# 回退链 (Fallbacks)
# 当首选模型不可用时，按顺序尝试
# ============================================================
fallbacks:
  - claude-sonnet-4-20250514      # 首选
  - gpt-4-turbo                    # 第一备选
  - claude-3-5-haiku-latest        # 第二备选
  - gpt-4o-mini                    # 最后备选

# ============================================================
# 模型特定配置 (Model Config)
# 覆盖模型的默认参数
# ============================================================
model_config:
  # Claude Sonnet 4
  claude-sonnet-4-20250514:
    provider: anthropic-main        # 使用哪个 provider
    max_tokens: 8192                # 最大输出 tokens
    temperature: 0.7                # 温度

  # Claude Opus 4
  claude-opus-4-20250514:
    provider: anthropic-main
    max_tokens: 4096
    temperature: 0.5                # 更保守的温度

  # Claude Haiku
  claude-3-5-haiku-latest:
    provider: anthropic-main
    max_tokens: 4096
    temperature: 0.8

  # GPT-4 Turbo
  gpt-4-turbo:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  # GPT-4o
  gpt-4o:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  # GPT-4o Mini
  gpt-4o-mini:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.8

  # Azure GPT-4
  azure-gpt-4:
    provider: azure-gpt4            # 使用 Azure provider
    max_tokens: 4096
    temperature: 0.7

  # Gemini 1.5 Pro
  gemini-1.5-pro:
    provider: google-gemini
    max_tokens: 8192
    temperature: 0.7

  # 本地 Ollama 模型
  llama3:
    provider: local-ollama
    max_tokens: 4096
    temperature: 0.8

  # DeepSeek
  deepseek-chat:
    provider: deepseek
    max_tokens: 4096
    temperature: 0.7

  # Groq (LLaMA)
  llama-3.1-70b-versatile:
    provider: groq
    max_tokens: 4096
    temperature: 0.7

# ============================================================
# 模型能力标签 (用于智能选择)
# ============================================================
model_capabilities:
  claude-sonnet-4-20250514:
    context_window: 200000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.003
    cost_per_1k_output: 0.015

  claude-opus-4-20250514:
    context_window: 200000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.015
    cost_per_1k_output: 0.075

  gpt-4-turbo:
    context_window: 128000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.01
    cost_per_1k_output: 0.03

  gpt-4o-mini:
    context_window: 128000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.00015
    cost_per_1k_output: 0.0006
```

---

## 输出示例

**`viben model list` (Human)**:
```
Available Models:
  Provider: anthropic-main
    claude-opus-4-20250514        200K context   $15/$75
    claude-sonnet-4-20250514*     200K context   $3/$15
    claude-3-5-haiku-latest       200K context   $0.25/$1.25

  Provider: openai-main
    gpt-4-turbo                   128K context   $10/$30
    gpt-4o                        128K context   $2.5/$10
    gpt-4o-mini                   128K context   $0.15/$0.6

* = default model
```

**`viben model aliases list` (Human)**:
```
Model Aliases:
  fast   → claude-3-5-haiku-latest
  smart  → claude-sonnet-4-20250514
  best   → claude-opus-4-20250514
  gpt    → gpt-4-turbo
```

**`viben model fallbacks list` (Human)**:
```
Fallback Chain:
  1. claude-sonnet-4-20250514   (anthropic-main)
  2. gpt-4-turbo                (openai-main)
  3. claude-3-5-haiku-latest    (anthropic-main)
```

**`viben model status` (Human)**:
```
Model Status:
  Default: claude-sonnet-4-20250514

  claude-sonnet-4-20250514   anthropic-main   ✓ available
  gpt-4-turbo                openai-main      ✓ available
  claude-3-5-haiku-latest    anthropic-main   ✓ available
  local-llama                local-ollama     ✗ provider offline
```

**`viben model list --category media --surface image` (Human)**:
```
Available Media Models:
  Provider: openai-media
    gpt-image-2*                 image   t2i,i2i,inpaint   ✓ available
    gpt-image-1.5                image   t2i,i2i           ✓ available
    dall-e-3                     image   t2i               ✓ available

  Provider: fal-media
    flux-pro-ultra               image   t2i               ✓ available
    ideogram-v3-fal              image   t2i               ✓ available

* = default image model
```

**`viben model list --category media --surface speech` (Human)**:
```
Available Media Models:
  Provider: elevenlabs-voice
    elevenlabs-v3*               speech  tts,voice_clone   ✓ available
    elevenlabs-sfx               sfx     sfx               ✓ available

* = default speech model
```

---

## Acceptance Criteria

### Model Management
- [ ] `viben model list` 列出可用 models
- [ ] `viben model list --provider <provider>` 按 provider 过滤
- [ ] `viben model list --category media` 只列出媒体模型
- [ ] `viben model list --surface image` 只列出图片生成模型
- [ ] `viben model list --json` JSON 输出
- [ ] `viben model show -n <model>` 显示 model 详情
- [ ] `viben model status` 显示 model 状态
- [ ] `viben model set-default -n <model>` 设置默认 model
- [ ] `viben model set-default -n <model> --surface image` 设置默认图片模型
- [ ] `viben model create -n <model> --provider <provider> --category media --surface <surface>` 创建自定义媒体模型
- [ ] `viben model enable -n <model>` 启用模型
- [ ] `viben model disable -n <model>` 禁用模型

### Model Alias
- [ ] `viben model alias list` 列出别名
- [ ] `viben model alias create -n <name> -m <model>` 创建别名
- [ ] `viben model alias remove -n <name>` 删除别名
- [ ] `viben model alias resolve -n <name>` 解析别名

### Model Fallback
- [ ] `viben model fallback list` 列出回退链
- [ ] `viben model fallback set <models...>` 设置回退链
- [ ] `viben model fallback add -n <model>` 添加到回退链
- [ ] `viben model fallback remove -n <model>` 从回退链移除
- [ ] `viben model fallback clear` 清空回退链

### Model Config
- [ ] `viben model config show -n <model>` 显示模型配置
- [ ] `viben model config set -n <model>` 设置模型配置
- [ ] `viben model config remove -n <model>` 删除模型配置

### Model Providers
- [ ] `viben model providers` 列出可用 providers
- [ ] `viben model providers --category media` 只列出媒体 Provider
- [ ] `viben model providers --surface image` 只列出支持图片生成的 Provider

### Gateway / Desktop
- [ ] `/api/models` 支持 `category`、`surface`、`provider_id` snake_case query 参数
- [ ] `/api/models` response 包含 `category`、`surface`、`capabilities`、`provider_id`
- [ ] Desktop 设置页 model section 能配置媒体 Provider 和媒体模型
- [ ] Desktop 不直接读写 YAML，所有配置经 Gateway API

---

## Related Documents

- [provider.md](./provider.md) - Provider 管理
- [agent.md](./agent.md) - Agent 管理
