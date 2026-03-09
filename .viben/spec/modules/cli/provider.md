# viben provider

> 管理 API Providers (OpenAI, Anthropic, Google, etc.)。

## Provider 类型

| Type | Description | Auth Methods |
|------|-------------|--------------|
| `openai` | OpenAI API | API Key |
| `anthropic` | Anthropic API | API Key |
| `google` | Google AI (Gemini) | API Key, OAuth |
| `azure` | Azure OpenAI | API Key, Azure AD |
| `openrouter` | OpenRouter | API Key |
| `ollama` | Ollama (local) | None |
| `custom` | Custom OpenAI-compatible | API Key |

---

## 命令

```bash
# ============================================================
# Provider 管理
# ============================================================

# 列出所有 providers
viben provider list
viben provider list --json

# 创建 provider
viben provider create -n <name> -t <type> -c <config-file>
viben provider create -n <name> -t <type> --auth <auth-method>
viben provider create -n <name> -t <type> --api-key <key>
viben provider create -n <name> -t <type> --api-key <key> --base-url <url>

# 简写 (自动生成名称)
viben provider create -t openai --api-key <key>
viben provider create -t anthropic --api-key <key>
viben provider create -t custom --api-key <key> --base-url https://api.example.com/v1

# 删除 provider
viben provider remove -n <name>

# 设置默认 provider
viben provider set-default -n <name>

# 查看 provider 状态 (连通性检查)
viben provider status
viben provider status -n <name>
```

---

## Provider 配置

```yaml
# ~/.viben/providers.yaml
version: 1

default: anthropic-main

providers:
  anthropic-main:
    type: anthropic
    api_key: "encrypted:sk-ant-xxx"

  openai-main:
    type: openai
    api_key: "encrypted:sk-xxx"

  azure-gpt4:
    type: azure
    api_key: "encrypted:xxx"
    base_url: "https://my-resource.openai.azure.com"
    api_version: "2024-02-15-preview"
    deployment: "gpt-4-turbo"

  local-ollama:
    type: ollama
    base_url: "http://localhost:11434"

  custom-api:
    type: custom
    api_key: "encrypted:xxx"
    base_url: "https://api.example.com/v1"
```

---

## 输出示例

**`viben provider list` (Human)**:
```
Providers:
  anthropic-main*   anthropic   ✓ connected
  openai-main       openai      ✓ connected
  azure-gpt4        azure       ✓ connected
  local-ollama      ollama      ○ not running
  custom-api        custom      ✓ connected

* = default provider
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
- [ ] `viben provider create -n <name> -t <type>` 创建 provider
- [ ] `viben provider create -t <type> --api-key <key>` 快速创建
- [ ] `viben provider remove -n <name>` 删除 provider
- [ ] `viben provider set-default -n <name>` 设置默认 provider
- [ ] `viben provider status` 检查 provider 连通性
- [ ] 支持 provider 类型: openai, anthropic, google, azure, openrouter, ollama, custom

---

## Related Documents

- [model.md](./model.md) - Model 管理
- [agent.md](./agent.md) - Agent 管理
