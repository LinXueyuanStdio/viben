---
sidebar_position: 9
title: "viben provider"
description: "Manage API providers - OpenAI, Anthropic, Google, Azure, etc."
---

# viben provider

Manage API providers for AI models.

## Usage

```bash
viben provider <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `list` | List all configured providers |
| `create` | Create a new provider |
| `remove` | Remove a provider |
| `set-default` | Set the default provider |
| `status` | Check provider connectivity |

## Provider Types

| Type | Description | Authentication |
|------|-------------|----------------|
| `openai` | OpenAI API | API Key |
| `anthropic` | Anthropic API | API Key |
| `google` | Google AI (Gemini) | API Key, OAuth |
| `azure` | Azure OpenAI | API Key, Azure AD |
| `openrouter` | OpenRouter | API Key |
| `ollama` | Ollama (local) | None |
| `custom` | Custom OpenAI-compatible | API Key |

## Commands

### List Providers

List all configured providers:

```bash
viben provider list
viben provider list --json
```

**Output (human-readable):**

```
Providers:
  anthropic-main*   anthropic   ✓ connected
  openai-main       openai      ✓ connected
  azure-gpt4        azure       ✓ connected
  local-ollama      ollama      ○ not running
  custom-api        custom      ✓ connected

* = default provider
```

**Output (JSON):**

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
      },
      {
        "name": "local-ollama",
        "type": "ollama",
        "status": "not_running"
      }
    ]
  }
}
```

### Create Provider

Create a new provider:

```bash
# Create with explicit name and type
viben provider create -n my-anthropic -t anthropic --api-key sk-ant-xxx

# Create with auto-generated name
viben provider create -t openai --api-key sk-xxx

# Create custom provider with base URL
viben provider create -t custom --api-key sk-xxx --base-url https://api.example.com/v1

# Create from configuration file
viben provider create -n my-provider -t anthropic -c /path/to/config.yaml
```

**Output:**

```
Created provider 'anthropic-main'
```

### Remove Provider

```bash
viben provider remove -n anthropic-main
```

### Set Default Provider

```bash
viben provider set-default -n openai-main
```

### Provider Status

Check provider connectivity:

```bash
# Check all providers
viben provider status

# Check specific provider
viben provider status -n anthropic-main
```

**Output (human-readable):**

```
Provider Status:
  anthropic-main   anthropic   ✓ connected   latency: 120ms
  openai-main      openai      ✓ connected   latency: 85ms
  azure-gpt4       azure       ✓ connected   latency: 150ms
  local-ollama     ollama      ✗ error       connection refused
  custom-api       custom      ✓ connected   latency: 200ms
```

## Environment Variables

Providers can be configured using environment variables:

| Provider | API Key | Base URL | Other |
|----------|---------|----------|-------|
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` | - |
| `openai` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_ORG_ID` |
| `azure` | `AZURE_OPENAI_API_KEY` | `AZURE_OPENAI_ENDPOINT` | `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT` |
| `google` | `GOOGLE_API_KEY` | - | `GOOGLE_PROJECT_ID`, `GOOGLE_LOCATION` |
| `openrouter` | `OPENROUTER_API_KEY` | - | - |
| `ollama` | - | `OLLAMA_HOST` | - |
| `custom` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | - |

### Priority

Provider configuration is resolved in the following order:

1. Command-line arguments (`--api-key`)
2. Values in configuration file
3. Provider-specific environment variables (e.g., `ANTHROPIC_API_KEY`)
4. Generic environment variables (e.g., custom type uses `OPENAI_API_KEY`)

### Quick Setup

```bash
# Set environment variables (recommended)
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"

# Create providers (automatically uses environment variables)
viben provider create -t anthropic
viben provider create -t openai
```

## Provider Configuration File

```yaml
# ~/.viben/providers.yaml
version: 1

default: anthropic-main

providers:
  anthropic-main:
    type: anthropic
    # API key obtained from ANTHROPIC_API_KEY environment variable

  openai-main:
    type: openai
    # API key obtained from OPENAI_API_KEY environment variable

  azure-gpt4:
    type: azure
    AZURE_OPENAI_ENDPOINT: "https://my-resource.openai.azure.com"
    AZURE_OPENAI_API_VERSION: "2024-02-15-preview"
    AZURE_OPENAI_DEPLOYMENT: "gpt-4-turbo"

  local-ollama:
    type: ollama
    OLLAMA_HOST: "http://localhost:11434"

  custom-api:
    type: custom
    OPENAI_BASE_URL: "https://api.example.com/v1"
```

## Error Handling

### Provider Not Found

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_NOT_FOUND",
    "message": "Provider 'unknown-provider' not found"
  }
}
```

### Invalid API Key

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid API key for provider 'anthropic-main'"
  }
}
```

### Connection Error

```json
{
  "success": false,
  "error": {
    "code": "CONNECTION_ERROR",
    "message": "Cannot connect to provider 'local-ollama': connection refused"
  }
}
```

## Related Commands

- [viben model](./model) - Model management
- [viben agent](./agent) - Agent management
- [viben config](./config) - Configuration management
