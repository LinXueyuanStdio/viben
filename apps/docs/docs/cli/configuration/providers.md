---
sidebar_position: 3
title: "Provider Configuration"
description: "Configure API providers for Viben CLI — Anthropic, OpenAI, Azure, Google, and more"
---

# Provider Configuration

Providers connect Viben to AI services like Anthropic, OpenAI, Google, and others. This page covers how to configure and manage providers.

## Overview

Provider configuration is stored in `~/.viben/models.yaml`. Viben supports multiple authentication methods:

1. **Environment variables** (recommended) - No secrets in config files
2. **Command-line** - Use `--api-key` with `viben provider create`
3. **Config file** - Direct values in YAML config

## Provider Types

### LLM Providers

| Type | Description | Auth |
|------|-------------|------|
| `anthropic` | Anthropic Claude API | API Key |
| `openai` | OpenAI API | API Key |
| `openai-responses` | OpenAI Responses API | API Key |
| `azure` | Azure OpenAI | API Key, Azure AD |
| `google` | Google AI (Gemini) | API Key, OAuth |
| `openrouter` | OpenRouter | API Key |
| `ollama` | Ollama (local) | None |
| `volcengine` | Volcano Engine (字节跳动) | API Key |
| `grok` | Grok (xAI) | API Key |

### Media Providers

| Type | Description | Auth |
|------|-------------|------|
| `nanobanana` | Nano Banana (image) | API Key |
| `imagerouter` | Image Router | API Key |
| `fal` | Fal.ai (image/video) | API Key |
| `leonardo` | Leonardo AI (image) | API Key |
| `minimax` | MiniMax (video/music) | API Key |
| `elevenlabs` | ElevenLabs (speech) | API Key |
| `fishaudio` | Fish Audio (speech) | API Key |
| `senseaudio` | SenseAudio (speech) | API Key |
| `aihubmix` | AIHubMix | API Key |
| `suno` | Suno (music) | API Key |
| `udio` | Udio (music) | API Key |

## Configuration File

### Basic Structure

Provider configuration is part of `~/.viben/models.yaml`:

```yaml
# ~/.viben/models.yaml
version: 1

providers:
  anthropic-main:
    type: anthropic
    category: llm
    surfaces: [chat]
    # API key from ANTHROPIC_API_KEY env var

  openai-main:
    type: openai
    category: llm
    surfaces: [chat]
    # API key from OPENAI_API_KEY env var

  dalle-images:
    type: nanobanana
    category: media
    surfaces: [image]

  local-ollama:
    type: ollama
    category: llm
    surfaces: [chat]
    OLLAMA_HOST: "http://localhost:11434"
```

### Provider Categories & Surfaces

| Category | Available Surfaces |
|----------|-------------------|
| `llm` | `chat` |
| `media` | `image`, `video`, `music`, `speech`, `sfx` |

## API Key Configuration Methods

### Method 1: Environment Variables (Recommended)

Set environment variables and create providers:

```bash
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"

viben provider create -t anthropic
viben provider create -t openai
```

### Method 2: Command-Line

Provide the API key directly (will be securely stored):

```bash
viben provider create -t anthropic --api-key "sk-ant-xxx"
```

## Provider-Specific Configuration

### Anthropic

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `ANTHROPIC_API_KEY` | API key | Yes |
| `ANTHROPIC_BASE_URL` | Custom endpoint | No |

### OpenAI

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `OPENAI_API_KEY` | API key | Yes |
| `OPENAI_BASE_URL` | Custom endpoint | No |
| `OPENAI_ORG_ID` | Organization ID | No |

### Azure OpenAI

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `AZURE_OPENAI_API_KEY` | Azure API key | Yes |
| `AZURE_OPENAI_ENDPOINT` | Azure resource endpoint | Yes |
| `AZURE_OPENAI_API_VERSION` | API version | Yes |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name | Yes |

### Google AI (Gemini)

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `GOOGLE_API_KEY` | Google AI API key | Yes |
| `GOOGLE_PROJECT_ID` | GCP project ID | No |
| `GOOGLE_LOCATION` | Region location | No |

### OpenRouter

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key | Yes |

### Ollama (Local)

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `OLLAMA_HOST` | Ollama server URL | No |

### Grok (xAI)

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `XAI_API_KEY` | xAI API key | Yes |

## Environment Variable Priority

When resolving API keys, Viben checks in this order:

1. **Command-line argument** (`--api-key`)
2. **Explicit value in config file**
3. **Provider-specific environment variable** (e.g., `ANTHROPIC_API_KEY`)
4. **Default base URL** (for each provider type)

## Provider Commands

### List Providers

```bash
# List all providers
viben provider list

# Filter by category
viben provider list --category media

# Filter by surface
viben provider list --surface image

# JSON output
viben provider list --json
```

### Create Provider

```bash
# Basic creation (uses env vars for API key)
viben provider create -t anthropic

# With explicit name and API key
viben provider create -n my-claude -t anthropic --api-key "sk-ant-xxx"

# Media provider
viben provider create -t nanobanana --category media --surface image --api-key "sk-xxx"

# Set as default
viben provider create -t openai -d
```

### Show Provider

```bash
viben provider show -n anthropic-main
```

### Update Provider

```bash
viben provider update -n my-provider --api-key sk-new-key --timeout 60
```

### Enable / Disable Provider

```bash
viben provider enable -n my-provider
viben provider disable -n my-provider
```

### Remove Provider

```bash
viben provider remove -n my-provider
# or
viben provider rm -n my-provider
```

### Set Default Provider

```bash
viben provider set-default -n openai-main
```

### Check Provider Status

```bash
# All providers
viben provider status

# Specific provider
viben provider status -n anthropic-main
```

### List Supported Types

```bash
viben provider types
```

## Quick Setup Examples

### Minimal Setup (Anthropic Only)

```bash
export ANTHROPIC_API_KEY="sk-ant-xxx"
viben provider create -t anthropic
```

### Multi-Provider Setup

```bash
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"
export GOOGLE_API_KEY="xxx"

viben provider create -t anthropic
viben provider create -t openai
viben provider create -t google
```

### Local Development (Ollama)

```bash
ollama serve
viben provider create -t ollama
viben provider set-default -n ollama-xxx
```

### Media Provider Setup

```bash
export OPENAI_API_KEY="sk-xxx"

viben provider create -t nanobanana --category media --surface image
viben provider create -t elevenlabs --category media --surface speech
```

## Troubleshooting

### Connection Errors

```bash
viben provider status -n anthropic-main
echo $ANTHROPIC_API_KEY
```

### Invalid API Key

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The API key for provider 'anthropic-main' is invalid"
  }
}
```

### Provider Not Found

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_NOT_FOUND",
    "message": "Provider 'unknown' not found in configuration"
  }
}
```

## Next Steps

- [Model Configuration](./models.md) - Configure models and aliases
- [Provider Commands](../commands/provider.md) - CLI command reference
