---
sidebar_position: 3
title: "Provider Configuration"
description: "Configure API providers for Viben CLI - Anthropic, OpenAI, Azure, Google, and more"
---

# Provider Configuration

Providers connect Viben to AI services like Anthropic, OpenAI, Google, and others. This page covers how to configure and manage providers.

## Overview

Provider configuration is stored in `~/.viben/providers.yaml`. Viben supports multiple authentication methods:

1. **Environment variables** (recommended) - No secrets in config files
2. **Environment variable references** - Use `env:VAR_NAME` syntax
3. **Encrypted storage** - Use `encrypted:xxx` for stored secrets

## Provider Types

| Type | Description | Auth Methods |
|------|-------------|--------------|
| `anthropic` | Anthropic Claude API | API Key |
| `openai` | OpenAI API | API Key |
| `azure` | Azure OpenAI | API Key, Azure AD |
| `google` | Google AI (Gemini) | API Key, OAuth |
| `openrouter` | OpenRouter | API Key |
| `ollama` | Ollama (local) | None |
| `custom` | OpenAI-compatible APIs | API Key |

## Configuration File

### Basic Structure

```yaml
# ~/.viben/providers.yaml
version: 1

# Default provider to use
default: anthropic-main

providers:
  anthropic-main:
    type: anthropic
    # Configuration options...

  openai-main:
    type: openai
    # Configuration options...
```

### API Key Configuration Methods

#### Method 1: Environment Variables (Recommended)

Set environment variables in your shell:

```bash
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"
```

Then create providers that automatically read them:

```yaml
providers:
  anthropic-main:
    type: anthropic
    # Automatically reads ANTHROPIC_API_KEY

  openai-main:
    type: openai
    # Automatically reads OPENAI_API_KEY
```

#### Method 2: Environment Variable References

Explicitly reference environment variables in config:

```yaml
providers:
  anthropic-main:
    type: anthropic
    ANTHROPIC_API_KEY: "env:ANTHROPIC_API_KEY"
```

#### Method 3: Encrypted Storage

Use the CLI to create providers with encrypted keys:

```bash
viben provider create -t anthropic --api-key "sk-ant-xxx"
```

This stores the key encrypted:

```yaml
providers:
  anthropic-main:
    type: anthropic
    ANTHROPIC_API_KEY: "encrypted:xxx"
```

## Provider-Specific Configuration

### Anthropic

```yaml
anthropic-main:
  type: anthropic
  # Environment variables: ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL

  # Optional configuration
  # ANTHROPIC_BASE_URL: "https://api.anthropic.com"
  # timeout: 120000
  # max_retries: 3
```

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `ANTHROPIC_API_KEY` | API key from Anthropic Console | Yes |
| `ANTHROPIC_BASE_URL` | Custom API endpoint | No |

### OpenAI

```yaml
openai-main:
  type: openai
  # Environment variables: OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_ORG_ID

  # Optional configuration
  # OPENAI_ORG_ID: "org-xxxxx"
```

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `OPENAI_API_KEY` | API key from OpenAI | Yes |
| `OPENAI_BASE_URL` | Custom API endpoint | No |
| `OPENAI_ORG_ID` | Organization ID | No |

### Azure OpenAI

```yaml
azure-gpt4:
  type: azure
  AZURE_OPENAI_ENDPOINT: "https://my-resource.openai.azure.com"
  AZURE_OPENAI_API_VERSION: "2024-02-15-preview"
  AZURE_OPENAI_DEPLOYMENT: "gpt-4-turbo"
  # AZURE_OPENAI_API_KEY from environment
```

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `AZURE_OPENAI_API_KEY` | Azure API key | Yes |
| `AZURE_OPENAI_ENDPOINT` | Azure resource endpoint | Yes |
| `AZURE_OPENAI_API_VERSION` | API version | Yes |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name | Yes |

### Google AI (Gemini)

```yaml
google-gemini:
  type: google
  # Environment variables: GOOGLE_API_KEY, GOOGLE_PROJECT_ID, GOOGLE_LOCATION

  # Optional configuration
  # GOOGLE_PROJECT_ID: "my-project"
  # GOOGLE_LOCATION: "us-central1"
```

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `GOOGLE_API_KEY` | Google AI API key | Yes |
| `GOOGLE_PROJECT_ID` | GCP project ID | No |
| `GOOGLE_LOCATION` | Region location | No |

### OpenRouter

```yaml
openrouter:
  type: openrouter
  # Environment variable: OPENROUTER_API_KEY

  # Optional configuration
  # site_url: "https://myapp.com"
  # app_name: "My App"
```

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key | Yes |

### Ollama (Local)

```yaml
local-ollama:
  type: ollama
  OLLAMA_HOST: "http://localhost:11434"
  # No API key required
```

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `OLLAMA_HOST` | Ollama server URL | No (default: `http://localhost:11434`) |

### Custom OpenAI-Compatible APIs

For services that implement the OpenAI API format:

```yaml
custom-api:
  type: custom
  OPENAI_BASE_URL: "https://api.example.com/v1"
  # OPENAI_API_KEY from environment

  # Optional: custom headers
  # headers:
  #   X-Custom-Header: "value"
```

### Popular Custom Providers

#### DeepSeek

```yaml
deepseek:
  type: custom
  OPENAI_BASE_URL: "https://api.deepseek.com/v1"
  # Uses DEEPSEEK_API_KEY or OPENAI_API_KEY
```

#### Groq

```yaml
groq:
  type: custom
  OPENAI_BASE_URL: "https://api.groq.com/openai/v1"
  # Uses GROQ_API_KEY or OPENAI_API_KEY
```

#### Together AI

```yaml
together:
  type: custom
  OPENAI_BASE_URL: "https://api.together.xyz/v1"
  # Uses TOGETHER_API_KEY or OPENAI_API_KEY
```

#### Fireworks AI

```yaml
fireworks:
  type: custom
  OPENAI_BASE_URL: "https://api.fireworks.ai/inference/v1"
  # Uses FIREWORKS_API_KEY or OPENAI_API_KEY
```

## Environment Variable Priority

When resolving API keys, Viben checks in this order:

1. **Command-line argument** (`--api-key`)
2. **Explicit value in config file**
3. **Provider-specific environment variable** (e.g., `ANTHROPIC_API_KEY`)
4. **Generic environment variable** (e.g., `OPENAI_API_KEY` for custom type)

## Provider Commands

### List Providers

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

### Create Provider

```bash
# Using environment variables (recommended)
viben provider create -t anthropic
viben provider create -t openai

# With explicit API key (will be encrypted)
viben provider create -t anthropic --api-key "sk-ant-xxx"

# With custom name
viben provider create -n my-claude -t anthropic --api-key "sk-ant-xxx"

# Custom API with base URL
viben provider create -t custom --api-key "xxx" --base-url "https://api.example.com/v1"
```

### Remove Provider

```bash
viben provider remove -n <name>
```

### Set Default Provider

```bash
viben provider set-default -n anthropic-main
```

### Check Provider Status

```bash
viben provider status
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

## Quick Setup Examples

### Minimal Setup (Anthropic Only)

```bash
# Set environment variable
export ANTHROPIC_API_KEY="sk-ant-xxx"

# Create provider
viben provider create -t anthropic
```

### Multi-Provider Setup

```bash
# Set all API keys
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"
export GOOGLE_API_KEY="xxx"

# Create providers
viben provider create -t anthropic
viben provider create -t openai
viben provider create -t google

# Set default
viben provider set-default -n anthropic-main
```

### Local Development (Ollama)

```bash
# Start Ollama server
ollama serve

# Create provider (no API key needed)
viben provider create -t ollama

# Set as default for local testing
viben provider set-default -n local-ollama
```

## JSON Output

All provider commands support `--json` for structured output:

```bash
viben provider list --json
```

**Output:**

```json
{
  "success": true,
  "data": {
    "default": "anthropic-main",
    "providers": [
      {
        "name": "anthropic-main",
        "type": "anthropic",
        "status": "connected",
        "latency_ms": 120
      },
      {
        "name": "openai-main",
        "type": "openai",
        "status": "connected",
        "latency_ms": 85
      }
    ]
  }
}
```

## Troubleshooting

### Connection Errors

```bash
# Check provider status
viben provider status -n anthropic-main

# Verify API key is set
echo $ANTHROPIC_API_KEY

# Test with verbose output
viben provider status -n anthropic-main --verbose
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

- [Model Configuration](/docs/cli/configuration/models) - Configure models, aliases, and fallbacks
- [Config Command](/docs/cli/configuration/config-command) - General configuration management
