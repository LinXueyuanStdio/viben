# viben model

> 管理 models、别名和回退链。

## 命令

```bash
# ============================================================
# Model 管理
# ============================================================

# 列出可用 models
viben model list
viben model list --provider <provider-name>
viben model list --json

# 查看 model 状态
viben model status
viben model status -n <model>

# 设置默认 model
viben model set-default -n <model>

# ============================================================
# Model Aliases (别名)
# ============================================================

# 列出别名
viben model aliases list

# 创建别名
viben model aliases create -n <alias> -f <model>
viben model aliases create -n fast -f claude-3-5-haiku-latest
viben model aliases create -n smart -f claude-sonnet-4-20250514
viben model aliases create -n best -f claude-opus-4-20250514

# 删除别名
viben model aliases remove -n <alias>

# ============================================================
# Model Fallbacks (回退链)
# ============================================================

# 列出回退链
viben model fallbacks list

# 添加到回退链
viben model fallbacks create -n <model>
viben model fallbacks create -n claude-sonnet-4-20250514
viben model fallbacks create -n gpt-4-turbo
viben model fallbacks create -n claude-3-5-haiku-latest

# 从回退链移除
viben model fallbacks remove -n <model>

# 清空回退链
viben model fallbacks clear
```

---

## Model 配置

```yaml
# ~/.viben/models.yaml
version: 1

default: claude-sonnet-4-20250514

# 模型别名
aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  best: claude-opus-4-20250514
  gpt: gpt-4-turbo

# 回退链 (按顺序尝试)
fallbacks:
  - claude-sonnet-4-20250514
  - gpt-4-turbo
  - claude-3-5-haiku-latest

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
```

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

---

## Acceptance Criteria

### Model Management
- [ ] `viben model list` 列出可用 models
- [ ] `viben model status` 显示 model 状态
- [ ] `viben model set-default -n <model>` 设置默认 model
- [ ] `viben model aliases list/create/remove` 管理别名
- [ ] `viben model fallbacks list/create/remove/clear` 管理回退链

---

## Related Documents

- [provider.md](./provider.md) - Provider 管理
- [agent.md](./agent.md) - Agent 管理
