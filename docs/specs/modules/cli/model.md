# viben model

> 管理 Viben models、别名和模型能力。Model 是具体可调用模型的配置入口，覆盖 LLM 模型和媒体生成模型。配置使用 file-native YAML，Provider 和 Model 统一存储在 `~/.viben/models.yaml`，CLI 命令是 MVP 验证入口，Gateway API 和 Desktop 设置页都必须复用 `packages/core/src/models` 的统一实现。

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
viben model list --provider <provider-type>
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

# 手动添加 model
viben model create -n <model> --provider <provider_id> --category media --surface image
viben model create -n <model> --provider <provider_id> --category media --surface video --capability t2v --capability i2v
viben model create -n <model> --provider <provider_id> --description "..." --context-window 200000 --max-output-tokens 8192

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

说明：

- `model list --provider` 当前按 provider type 过滤，不是按 `provider_id`。同名 `model_id` 跨多个 Provider 共存时，CLI 的 `show/config` 命令目前没有 `--provider-id` 消歧入口；core 会在全局按 model id 查找产生歧义时抛错。
- `model create --provider` 必须传 Provider 实例 ID。实现会用该 `provider_id` 查 Provider，再写入 `provider_id.models[model_id]`；不能把 provider type 当 provider id。
- 当前没有 CLI 级 `model enable` / `model disable` 命令。模型启停通过 Gateway provider-scoped endpoints 和 Desktop 设置页完成。
- `model set-default` 命令入口仍存在，但模型默认值持久化已移除，core 当前为兼容 no-op，不写 `models.yaml`。
- `model alias create/remove` 命令入口仍存在，但自定义 alias 持久化已移除，core 当前为兼容 no-op；`alias list` 只返回内置 aliases。
- CLI fallback 命令已移除，不再提供 model fallback 功能。

---

## Model 配置

所有字段使用 snake_case。`models.yaml` 顶层是 `provider_id -> provider entry`，模型必须嵌套在对应 Provider 的 `models` 下。这样同一个 `model_id` 可以同时属于不同 `provider_id`，不会互相覆盖。

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
  enabled: true
  models:
    claude-sonnet-4-5:
      name: Claude Sonnet 4.5
      enabled: true
      category: llm
      surface: chat
      context_window: 200000
      max_output_tokens: 8192
      config:
        max_tokens: 8192
        temperature: 0.7

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
      context_window: 400000
      max_output_tokens: 128000

openai-media:
  id: openai-media
  type: openai
  name: OpenAI Media
  category: media
  base_url: https://api.openai.com/v1
  api_key: "sk-xxx"
  surfaces:
    - image
    - speech
  enabled: true
  models:
    gpt-image-2:
      name: GPT Image 2
      enabled: false
      category: media
      surface: image
      capabilities:
        - t2i
        - i2i
        - inpaint
      config:
        size: 1024x1024

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
  enabled: true
  models:
    flux-pro-ultra:
      name: Flux Pro Ultra
      enabled: true
      category: media
      surface: image
      capabilities:
        - t2i
```

历史兼容：

- 读取旧字符串模型值时会规范化为 `{ name: value, enabled: true }`；写回必须统一为对象，不再写 `model_id: Model Name`。
- 读取旧 `model_name` 时会规范化为 `name`；写回只保留 `name`。
- 旧 `configs` / `model_config` / `custom_models` 可以读取迁移到 provider-scoped model entry；保存时不再写顶层 `default`、`defaults`、`aliases`、`fallbacks`、`fallbacks_by_surface`、`configs`、`model_config`、`custom_models`、`disabled_models` 或 `__viben` metadata。
- 模型默认值、alias 自定义持久化和 fallback 功能已经从 YAML 中移除。

---

## Model 字段

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | 模型稳定 ID。YAML 中不作为字段重复保存，而是 `models.<model_id>` 的 key。 |
| `name` | Yes | 展示名称。`model_name` 是旧别名，读取兼容，写回统一为 `name`。 |
| `category` | No | `llm` 或 `media`。未设置时默认 `llm`。 |
| `surface` | No | `chat`、`image`、`video`、`music`、`speech`、`sfx`。LLM 默认 `chat`。媒体模型必须设置。 |
| `capabilities` | No | 能力标签。媒体常用 `t2i`、`i2i`、`inpaint`、`t2v`、`i2v`、`audio`、`music`、`tts`、`voice_clone`、`sfx`。 |
| `context_window` | No | LLM 上下文长度。 |
| `max_output_tokens` | No | LLM 最大输出词元。 |
| `config` | No | Provider-scoped 模型参数，例如 `temperature`、`max_tokens`、`top_p`、`size`、`duration_seconds`、`voice_id`。 |
| `duration_seconds` | No | 视频/音频默认时长。 |
| `aspect_ratio` | No | 图片/视频默认画幅。 |
| `size` | No | 图片/视频默认尺寸。 |
| `voice_id` | No | 语音模型默认音色。 |
| `enabled` | No | 是否在所属 `provider_id` 下启用。禁用模型必须保留在 YAML 和 UI 列表中，方便重新启用。 |

Provider 相关字段不写在 Model entry 内：

- `provider_id` 由模型所在的顶层 Provider key 决定。
- `provider` / `provider_type` 只表示 Provider 的 `type`，不能参与 model identity，也不能用作 `provider_id` fallback。
- `is_available` 是 API response 计算字段，必须按 `provider_id` 查所属 Provider 是否存在、是否 enabled、是否满足 key 要求；不能只按 provider type 判断。

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

- `packages/core/src/models/index.ts` 是 Model 配置的唯一实现入口，负责读取、校验、provider-scoped 模型启用状态和 YAML 写回。
- `packages/core/src/model/index.ts` 如果存在，应作为兼容入口 re-export `packages/core/src/models`；不能出现第二套实现。当前目录名以 `models` 为准，除非整体迁移。
- `packages/core/src/models/types.ts` 定义 ModelCategory、ModelSurface、ModelCapability、ModelEntry 和 ModelConfigEntry。
- `packages/core/src/cli/commands/model.ts` 只做参数解析、输出格式化和调用 core，不直接读写 YAML。
- `packages/core/src/gateway/routes/models.ts` 只做 HTTP 参数转换，API query/body/response 字段必须使用 snake_case。
- Desktop 设置页通过 Gateway client 调用 `/api/models` 和 `/api/providers`，不能直接访问本地 YAML。
- `packages/core/src/acp/{index.ts,types.ts,ops/...}` 的分层方式作为重构参考：`index.ts` 只导出类型和 manager，业务逻辑放到 `ops`，route/CLI 不越过 manager。

---

## Gateway API

```http
GET /api/models/default
PUT /api/models/default
GET /api/models/aliases
POST /api/models/aliases
DELETE /api/models/aliases/:alias
POST /api/models/reload
GET /api/models?category=media&surface=image&provider_id=openai-media
GET /api/models/:id?provider_id=openai-media
POST /api/models/:id/enable?provider_id=openai-media
POST /api/models/:id/disable?provider_id=openai-media
POST /api/models
PATCH /api/models/:id
DELETE /api/models/:id?provider_id=openai-media
GET /api/models/:id/config?provider_id=openai-media
PUT /api/models/:id/config
DELETE /api/models/:id/config?provider_id=openai-media
GET /api/providers/:id/discover-models
GET /api/providers/:id/models
POST /api/providers/:provider_id/models/:model_id/enable
POST /api/providers/:provider_id/models/:model_id/disable
```

`/api/models` query 使用 snake_case：

- `provider_id`: 按 Provider 实例 ID 过滤。
- `provider`: 按 Provider type 过滤，不能当成 provider_id。
- `category` / `surface`: 按模型字段过滤。
- `workspace_path`、`include_global`、`include_provider_predefined`: 当前为兼容/保留参数，不能作为新存储语义。

`GET /api/models/:id` 可以用 `provider_id` 消歧；不传时如果唯一命中则返回，如果同一 `model_id` 存在于多个 `provider_id` 下则返回 400，要求调用方传 `provider_id`。`PATCH /api/models/:id`、`DELETE /api/models/:id`、`GET/PUT/DELETE /api/models/:id/config` 当前必须提供 `provider_id`；`DELETE /api/models/:id` 只删除该 provider-scoped model 的 `config`，不删除模型条目本身。

`GET /api/models/default` / `PUT /api/models/default` 和 alias create/delete 当前是兼容外壳：保留端点，但模型默认值和自定义 alias 不写入 `models.yaml`。fallback API 不存在。

### `POST /api/models` body

```json
{
  "id": "fal-manual-video",
  "name": "Fal Manual Video",
  "provider_id": "fal-media",
  "category": "media",
  "surface": "video",
  "capabilities": ["t2v", "i2v"],
  "set_as_default": false
}
```

`POST /api/models` 必须提供 `provider_id`。Gateway 会按 `provider_id` 查 Provider 并使用其 `type`，不会信任 body 里的 `provider` / `provider_type` 来决定所属 Provider。

### `PUT /api/models/:id/config` body

```json
{
  "provider_id": "openai-media",
  "temperature": 0.7,
  "max_tokens": 4096,
  "top_p": 1,
  "size": "1024x1024"
}
```

### Model response

```json
{
  "id": "gpt-image-2",
  "name": "gpt-image-2",
  "provider": "openai",
  "provider_id": "openai-media",
  "provider_type": "openai",
  "provider_name": "OpenAI Media",
  "category": "media",
  "surface": "image",
  "capabilities": ["t2i", "i2i", "inpaint"],
  "enabled": true,
  "is_available": true,
  "config": {
    "size": "1024x1024"
  }
}
```

---

## Desktop 设置页

Desktop 设置页的 `model` section 需要在同一页面中配置 LLM 和媒体模型：

- 顶部使用 Tabs 或 segmented control 切换 `LLM`、`图片`、`视频`、`音乐`、`声音`、`音效`。
- Provider 列表显示对应 surface 的 Provider，支持新增、编辑 API key、base URL、启用/禁用、设置默认。
- Model 列表显示对应 surface 的模型，支持启用/禁用和手动添加模型。
- Discover 模型来自 `GET /api/providers/:id/discover-models`，未启用前不属于已配置模型，也不写入 YAML。
- UI 必须同时读取 `GET /api/providers/:id/models`，把已配置模型与 discover 结果合并展示。已配置但 disabled、或者本次 discover 没返回的模型必须继续显示，不能因为只合并 enabled ids 而消失。
- 用户点击 toggle 启用发现模型时，Desktop 调 provider-scoped enable endpoint，把模型写入 `models.yaml` 的 `provider_id.models[model_id]`；禁用只把该 entry 的 `enabled` 改为 `false`。
- 同一个 `model_id` 可在不同 `provider_id` 下重复出现。所有启用、禁用、配置、删除操作都必须带明确 `provider_id` 或由 core 唯一解析；若不唯一必须报错要求调用方传 `provider_id`。
- 媒体模型必须显示 capability 标签，例如 `t2i`、`i2i`、`t2v`、`i2v`、`tts`。
- API key 不在 UI 中明文回显，只显示是否已配置和短前缀。
- 所有数据经 Gateway client 获取，不直接读写 `~/.viben/*.yaml`。

---

## 完整 Model 配置示例

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
      capabilities:
        - tools
        - vision
      context_window: 200000
      max_output_tokens: 8192
      config:
        max_tokens: 8192
        temperature: 0.7

    claude-3-5-haiku:
      name: Claude 3.5 Haiku
      enabled: false
      category: llm
      surface: chat
      context_window: 200000
      max_output_tokens: 4096

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
      capabilities:
        - tools
        - vision
      context_window: 400000
      max_output_tokens: 128000

openai-compatible-main:
  id: openai-compatible-main
  type: openai
  name: Internal OpenAI-Compatible Gateway
  category: llm
  base_url: https://llm.example.com/v1
  api_key: "sk-compatible-xxx"
  surfaces:
    - chat
  enabled: true
  models:
    gpt-5:
      name: GPT-5 via Internal Gateway
      enabled: true
      category: llm
      surface: chat

openai-media:
  id: openai-media
  type: openai
  name: OpenAI Media
  category: media
  base_url: https://api.openai.com/v1
  api_key: "sk-xxx"
  surfaces:
    - image
    - speech
  enabled: true
  models:
    gpt-image-2:
      name: GPT Image 2
      enabled: true
      category: media
      surface: image
      capabilities:
        - t2i
        - i2i
        - inpaint
      config:
        size: 1024x1024

    gpt-4o-mini-tts:
      name: GPT-4o Mini TTS
      enabled: false
      category: media
      surface: speech
      capabilities:
        - tts
      config:
        voice_id: default

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
      capabilities:
        - t2i

    veo-3-fal:
      name: Veo 3
      enabled: false
      category: media
      surface: video
      capabilities:
        - t2v
        - i2v
      config:
        duration_seconds: 8
        aspect_ratio: "16:9"
```

---

## 输出示例

**`viben model list` (Human)**:
```
Available Models:
  Provider: anthropic-main
    claude-opus-4-20250514        200K context   $15/$75
    claude-sonnet-4-20250514      200K context   $3/$15
    claude-3-5-haiku-latest       200K context   $0.25/$1.25

  Provider: openai-main
    gpt-4-turbo                   128K context   $10/$30
    gpt-4o                        128K context   $2.5/$10
    gpt-4o-mini                   128K context   $0.15/$0.6
```

**`viben model aliases list` (Human)**:
```
Model Aliases:
  gpt4         → gpt-4o
  gpt4o        → gpt-4o
  gpt4-mini    → gpt-4o-mini
  gpt35        → gpt-3.5-turbo
  claude       → claude-sonnet-4-5-20250514
  sonnet       → claude-sonnet-4-5-20250514
  sonnet-4.5   → claude-sonnet-4-5-20250514
  opus         → claude-opus-4-5-20250514
  opus-4.5     → claude-opus-4-5-20250514
  haiku        → claude-3-5-haiku-20241022
  sonnet-3.5   → claude-3-5-sonnet-20241022
  opus-3       → claude-3-opus-20240229
```

**`viben model status` (Human)**:
```
Model Status:
  Default: (not set)

  claude-sonnet-4-20250514   anthropic-main   ✓ available
  gpt-4-turbo                openai-main      ✓ available
  claude-3-5-haiku-latest    anthropic-main   ✓ available
  local-llama                local-ollama     ✓ available
```

**`viben model list --category media --surface image` (Human)**:
```
Available Media Models:
  Provider: openai-media
    gpt-image-2                  image   t2i,i2i,inpaint   ✓ available
    gpt-image-1.5                image   t2i,i2i           ✓ available
    dall-e-3                     image   t2i               ✓ available

  Provider: fal-media
    flux-pro-ultra               image   t2i               ✓ available
    ideogram-v3-fal              image   t2i               ✓ available
```

**`viben model list --category media --surface speech` (Human)**:
```
Available Media Models:
  Provider: elevenlabs-voice
    elevenlabs-v3                speech  tts,voice_clone   ✓ available
    elevenlabs-sfx               sfx     sfx               ✓ available
```

---

## Acceptance Criteria

### Model Management
- [x] `viben model list` 列出可用 models
- [x] `viben model list --provider <provider>` 按 provider 过滤
- [x] `viben model list --category media` 只列出媒体模型
- [x] `viben model list --surface image` 只列出图片生成模型
- [x] `viben model list --json` JSON 输出
- [x] `viben model show -n <model>` 显示 model 详情
- [x] `viben model status` 显示 model 状态
- [x] `viben model set-default -n <model>` 保持兼容 no-op，不写入 YAML
- [x] `viben model set-default -n <model> --surface image` 保持兼容 no-op，不写入 YAML
- [x] `viben model create -n <model> --provider <provider_id> --category media --surface <surface>` 创建 provider-scoped 模型
- [x] `viben model create --provider` 必须传 Provider 实例 ID；不能用 provider type 兜底成 provider id
- [x] 全局 model id 查找产生多 provider 命中时，core 报错并提示调用方需要 provider_id 消歧
- [ ] CLI `show/config` 命令补充 `--provider-id` 参数，用于显式消歧同名 model id

### Model Alias
- [x] `viben model alias list` 列出别名
- [x] `viben model alias create -n <name> -m <model>` 保持兼容 no-op，不写入 YAML
- [x] `viben model alias remove -n <name>` 保持兼容 no-op，不写入 YAML
- [x] `viben model alias resolve -n <name>` 解析别名
- [x] 内置 aliases 与 `packages/core/src/models/known-models.ts` 保持一致
- [x] fallback CLI 和 Gateway API 不存在，YAML 不写 `fallbacks` 或 `fallbacks_by_surface`

### Model Config
- [x] `viben model config show -n <model>` 显示模型配置
- [x] `viben model config set -n <model>` 设置模型配置
- [x] `viben model config remove -n <model>` 删除模型配置
- [x] Gateway `PUT /api/models/:id/config` 使用 snake_case，body 必须带 `provider_id`
- [x] 配置写入 `provider_id.models[model_id].config`

### Model Providers
- [x] `viben model providers` 列出可用 providers
- [x] `viben model providers --category media` 只列出媒体 Provider
- [x] `viben model providers --surface image` 只列出支持图片生成的 Provider

### Gateway / Desktop
- [x] `/api/models` 支持 `category`、`surface`、`provider_id` snake_case query 参数
- [x] `/api/models` 的 `provider_id` 与 `provider` 过滤严格分离，`provider` 只表示 provider type
- [x] `/api/models` response 包含 `category`、`surface`、`capabilities`、`provider_id`、`provider_type`、`provider_name`、`is_available`
- [x] `is_available` 必须按 `provider_id` 查 Provider 状态，不能按 provider type 判断
- [x] 同名 `model_id` 可在不同 `provider_id` 下共存；GET 不传 `provider_id` 时若不唯一必须返回 400
- [x] `PATCH /api/models/:id`、`DELETE /api/models/:id`、`GET/PUT/DELETE /api/models/:id/config` 必须要求 `provider_id`
- [x] 写回 `~/.viben/models.yaml` 时只保留 provider-map schema，不再写顶层 metadata、fallback、alias、自定义模型列表或 disabled 模型列表
- [x] 读取兼容旧 `model_name`，写回统一为 `name`
- [x] 读取兼容旧字符串模型值，写回统一为对象结构
- [x] 读取兼容旧 `apiKey`，写回统一为 `api_key`
- [x] Desktop 设置页 model section 能配置媒体 Provider 和媒体模型
- [x] Discover 模型未启用前不写 YAML；用户 toggle 后写入对应 `provider_id.models[model_id]`
- [x] Desktop 同时合并 discover models 与 configured models，configured-but-disabled 模型必须继续展示并可重新启用
- [x] Desktop 不直接读写 YAML，所有配置经 Gateway API
 
---

## Related Documents

- [provider.md](./provider.md) - Provider 管理
- [agent.md](./agent.md) - Agent 管理
