---
sidebar_position: 9
title: "viben provider"
description: "Manage API providers — OpenAI, Anthropic, Google, Azure, Ollama and more"
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
| `list` | List all configured providers (supports `--category`, `--surface` filters) |
| `create` | Create a new provider |
| `show` | Show provider details |
| `update` | Update provider configuration |
| `remove` | Remove a provider |
| `set-default` | Set the default provider |
| `enable` | Enable a provider |
| `disable` | Disable a provider |
| `status` | Check provider connectivity |
| `types` | List supported provider types |

## Provider Types

### LLM Providers

| Type | Description | Authentication |
|------|-------------|----------------|
| `openai` | OpenAI API | API Key |
| `openai-responses` | OpenAI Responses API | API Key |
| `anthropic` | Anthropic API | API Key |
| `google` | Google AI (Gemini) | API Key, OAuth |
| `azure` | Azure OpenAI | API Key, Azure AD |
| `openrouter` | OpenRouter | API Key |
| `ollama` | Ollama (local) | None |
| `volcengine` | Volcano Engine (字节跳动) | API Key |
| `grok` | Grok (xAI) | API Key |

### Media Providers

| Type | Description | Authentication |
|------|-------------|----------------|
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

## Commands

### List Providers

```bash
# List all providers
viben provider list

# Filter by category
viben provider list --category llm
viben provider list --category media

# Filter by surface
viben provider list --surface image
viben provider list --surface chat

# JSON output
viben provider list --json
```

**Output:**

```
Providers:
  ID          Category  Type       Surfaces  Base URL  Default  Enabled
  anthro-main llm       anthropic  chat      (default)  Yes      Yes
  openai-main llm       openai     chat      (default)           Yes
  dalle-img   media     nanobanana image     (default)           Yes
```

### Create Provider

```bash
# Create with explicit name and type
viben provider create -n my-anthropic -t anthropic --api-key sk-ant-xxx

# Create with auto-generated name
viben provider create -t openai --api-key sk-xxx

# Create with custom base URL
viben provider create -t openai --base-url https://api.example.com/v1 -d

# Create media provider
viben provider create -t nanobanana --category media --surface image --api-key sk-xxx
```

**Options**:

| Option | Description |
|--------|-------------|
| `-n, --name <name>` | Provider name (auto-generated if omitted) |
| `-t, --type <type>` | Provider type (required, see valid types above) |
| `--category <category>` | Provider category: `llm` or `media` |
| `--surface <surface>` | Supported surface (repeatable) |
| `-u, --base-url <url>` | Custom base URL |
| `-k, --api-key <key>` | API key |
| `--auth <method>` | Authentication method |
| `--timeout <seconds>` | Request timeout |
| `--max-retries <count>` | Retry attempts |
| `-d, --default` | Set as default provider |

### Show Provider

```bash
viben provider show -n my-provider
```

### Update Provider

```bash
viben provider update -n my-provider \
  --api-key sk-new-key \
  --timeout 60 \
  --max-retries 5
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

### Enable / Disable Provider

```bash
viben provider enable -n my-provider
viben provider disable -n my-provider
```

### Provider Status

```bash
# Check all providers
viben provider status

# Check specific provider
viben provider status -n anthropic-main
```

**Output:**

```
Providers:
  Provider       Connected  Latency  Error
  anthropic-main Yes        120ms    -
  openai-main    Yes         85ms    -
  local-ollama   No          -       connection refused
```

### List Provider Types

```bash
viben provider types
```

**Output:**

```
Type              Default Base URL                         API Key Env Var
openai            https://api.openai.com/v1                OPENAI_API_KEY
anthropic         https://api.anthropic.com                ANTHROPIC_API_KEY
openai-responses  https://api.openai.com/v1                OPENAI_API_KEY
...
```

## Environment Variables

Providers can be configured using environment variables:

| Provider Type | API Key | Base URL | Other |
|---------------|---------|----------|-------|
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` | — |
| `openai` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_ORG_ID` |
| `openai-responses` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | — |
| `azure` | `AZURE_OPENAI_API_KEY` | `AZURE_OPENAI_ENDPOINT` | `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT` |
| `google` | `GOOGLE_API_KEY` | — | `GOOGLE_PROJECT_ID`, `GOOGLE_LOCATION` |
| `openrouter` | `OPENROUTER_API_KEY` | — | — |
| `ollama` | — | `OLLAMA_HOST` | — |
| `grok` | `XAI_API_KEY` | — | — |

### Priority

Provider configuration is resolved in order:

1. Command-line arguments (`--api-key`)
2. Values in configuration file
3. Provider-specific environment variables (e.g., `ANTHROPIC_API_KEY`)
4. Default base URLs

## Configuration File

Provider configuration is stored in `~/.viben/models.yaml`:

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

  local-ollama:
    type: ollama
    category: llm
    surfaces: [chat]
    OLLAMA_HOST: "http://localhost:11434"

  dalle-images:
    type: nanobanana
    category: media
    surfaces: [image]
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

## Related Commands

- [viben model](./model) — Model management
- [viben agent](./agent) — Agent management
- [viben config](./config) — Configuration management
- [Providers Configuration](../configuration/providers.md)
