---
sidebar_position: 1
title: "Provider Management"
description: "Manage API providers (OpenAI, Anthropic, Google, Azure, etc.) with Viben CLI"
---

# Provider Management

Providers are connections to AI model APIs. Viben CLI supports multiple provider types, allowing you to configure and switch between different AI services.

## Provider Types

| Type | Description | Auth Methods |
|------|-------------|--------------|
| `anthropic` | Anthropic API (Claude) | API Key |
| `openai` | OpenAI API | API Key |
| `azure` | Azure OpenAI | API Key, Azure AD |
| `google` | Google AI (Gemini) | API Key, OAuth |
| `openrouter` | OpenRouter | API Key |
| `ollama` | Ollama (local) | None |
| `custom` | Custom OpenAI-compatible | API Key |

## Commands

### List Providers

List all configured providers:

```bash
viben provider list
```

**Output:**
```
Providers:
  anthropic-main*   anthropic   ✓ connected
  openai-main       openai      ✓ connected
  azure-gpt4        azure       ✓ connected
  local-ollama      ollama      ○ not running
  custom-api        custom      ✓ connected

* = default provider
```

For JSON output (useful for scripts and agent integration):

```bash
viben provider list --json
```

### Create Provider

Create a new provider configuration:

```bash
# Full syntax
viben provider create -n <name> -t <type> --api-key <key>

# With custom base URL
viben provider create -n <name> -t <type> --api-key <key> --base-url <url>

# Shorthand (auto-generates name based on type)
viben provider create -t <type> --api-key <key>
```

**Examples:**

```bash
# Create Anthropic provider
viben provider create -n anthropic-main -t anthropic --api-key "sk-ant-xxx"

# Create OpenAI provider (shorthand)
viben provider create -t openai --api-key "sk-xxx"

# Create custom provider with base URL
viben provider create -n deepseek -t custom \
  --api-key "sk-xxx" \
  --base-url "https://api.deepseek.com/v1"
```

### Remove Provider

Remove an existing provider:

```bash
viben provider remove -n <name>
```

**Example:**
```bash
viben provider remove -n old-provider
```

### Set Default Provider

Set a provider as the default:

```bash
viben provider set-default -n <name>
```

**Example:**
```bash
viben provider set-default -n anthropic-main
```

### Check Provider Status

Check connectivity and health of providers:

```bash
# Check all providers
viben provider status

# Check specific provider
viben provider status -n <name>
```

**Output:**
```
Provider Status:
  anthropic-main   anthropic   ✓ connected   latency: 120ms
  openai-main      openai      ✓ connected   latency: 85ms
  azure-gpt4       azure       ✓ connected   latency: 150ms
  local-ollama     ollama      ✗ error       connection refused
  custom-api       custom      ✓ connected   latency: 200ms
```

## Configuration File

Providers are stored in `~/.viben/providers.yaml`:

```yaml
# ~/.viben/providers.yaml
version: 1

# Default provider
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

## Environment Variables

You can configure providers using environment variables. Viben automatically reads them:

| Provider | API Key Variable | Base URL Variable | Other Variables |
|----------|-----------------|-------------------|-----------------|
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` | - |
| `openai` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_ORG_ID` |
| `azure` | `AZURE_OPENAI_API_KEY` | `AZURE_OPENAI_ENDPOINT` | `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT` |
| `google` | `GOOGLE_API_KEY` | - | `GOOGLE_PROJECT_ID`, `GOOGLE_LOCATION` |
| `openrouter` | `OPENROUTER_API_KEY` | - | - |
| `ollama` | - | `OLLAMA_HOST` | - |
| `custom` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | - |

**Priority Order** (highest to lowest):

1. Command-line arguments (`--api-key`)
2. Explicit values in configuration file
3. Provider-specific environment variables (e.g., `ANTHROPIC_API_KEY`)
4. Generic environment variables (e.g., `OPENAI_API_KEY` for custom type)

## Quick Setup with Environment Variables

The simplest way to configure providers - just set environment variables:

```bash
# Set environment variables
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"

# Create providers (automatically uses environment variables)
viben provider create -t anthropic
viben provider create -t openai
```

## Provider Type Details

### Anthropic

For Claude models:

```bash
viben provider create -t anthropic --api-key "sk-ant-xxx"
```

Environment variables:
- `ANTHROPIC_API_KEY` (required)
- `ANTHROPIC_BASE_URL` (optional)

### OpenAI

For GPT models:

```bash
viben provider create -t openai --api-key "sk-xxx"
```

Environment variables:
- `OPENAI_API_KEY` (required)
- `OPENAI_BASE_URL` (optional)
- `OPENAI_ORG_ID` (optional)

### Azure OpenAI

For Azure-hosted OpenAI models:

```bash
viben provider create -n azure-gpt4 -t azure \
  --api-key "xxx" \
  --base-url "https://my-resource.openai.azure.com"
```

Configuration file allows additional settings:

```yaml
azure-gpt4:
  type: azure
  AZURE_OPENAI_ENDPOINT: "https://my-resource.openai.azure.com"
  AZURE_OPENAI_API_VERSION: "2024-02-15-preview"
  AZURE_OPENAI_DEPLOYMENT: "gpt-4-turbo"
```

### Google AI (Gemini)

For Gemini models:

```bash
viben provider create -t google --api-key "xxx"
```

Environment variables:
- `GOOGLE_API_KEY` (required)
- `GOOGLE_PROJECT_ID` (optional)
- `GOOGLE_LOCATION` (optional)

### Ollama (Local)

For locally-running Ollama:

```bash
viben provider create -n local-ollama -t ollama
```

No API key required. Configure host if needed:

```yaml
local-ollama:
  type: ollama
  OLLAMA_HOST: "http://localhost:11434"
```

### Custom (OpenAI-compatible)

For any OpenAI-compatible API:

```bash
viben provider create -n deepseek -t custom \
  --api-key "xxx" \
  --base-url "https://api.deepseek.com/v1"
```

Common custom providers:

| Provider | Base URL |
|----------|----------|
| DeepSeek | `https://api.deepseek.com/v1` |
| Groq | `https://api.groq.com/openai/v1` |
| Together AI | `https://api.together.xyz/v1` |
| Fireworks AI | `https://api.fireworks.ai/inference/v1` |

## Security

API keys are encrypted when stored in the configuration file. The encrypted format looks like:

```yaml
api_key: "encrypted:sk-ant-xxx"
```

:::tip Best Practice
Use environment variables for API keys instead of storing them in configuration files. This is more secure and follows the 12-factor app methodology.
:::

## JSON Output

All commands support `--json` flag for structured output:

```bash
viben provider list --json
```

```json
{
  "success": true,
  "data": {
    "default": "anthropic-main",
    "providers": [
      {
        "name": "anthropic-main",
        "type": "anthropic",
        "status": "connected"
      },
      {
        "name": "openai-main",
        "type": "openai",
        "status": "connected"
      }
    ]
  }
}
```

## Next Steps

- [Model Management](./models) - Configure models for your providers
- [Model Aliases](./aliases) - Create convenient shortcuts for model names
- [Model Fallbacks](./fallbacks) - Set up automatic fallback chains
