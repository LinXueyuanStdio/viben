---
sidebar_position: 3
title: "Model Aliases"
description: "Create convenient shortcuts for model names with Viben CLI"
---

# Model Aliases

Aliases let you reference models with short, memorable names instead of full model identifiers like `claude-sonnet-4-20250514`.

## Concept

An alias is a short name that maps to a full model name:

```
fast   ->  claude-3-5-haiku-latest
smart  ->  claude-sonnet-4-20250514
best   ->  claude-opus-4-20250514
```

This means you can use `fast` anywhere you would use `claude-3-5-haiku-latest`.

## Commands

### List Aliases

View all configured aliases:

```bash
viben model aliases list
```

**Output:**
```
Model Aliases:
  fast   -> claude-3-5-haiku-latest
  smart  -> claude-sonnet-4-20250514
  best   -> claude-opus-4-20250514
  gpt    -> gpt-4-turbo
```

For JSON output:

```bash
viben model aliases list --json
```

### Create Alias

Create a new alias:

```bash
viben model aliases create -n <alias> -f <model>
```

**Examples:**

```bash
# Create speed-focused aliases
viben model aliases create -n fast -f claude-3-5-haiku-latest
viben model aliases create -n quick -f gpt-4o-mini

# Create quality-focused aliases
viben model aliases create -n smart -f claude-sonnet-4-20250514
viben model aliases create -n best -f claude-opus-4-20250514

# Create purpose-specific aliases
viben model aliases create -n code -f claude-sonnet-4-20250514
viben model aliases create -n chat -f claude-3-5-haiku-latest
viben model aliases create -n reasoning -f o1-preview

# Create provider-specific aliases
viben model aliases create -n gpt -f gpt-4-turbo
viben model aliases create -n claude -f claude-sonnet-4-20250514
viben model aliases create -n gemini -f gemini-1.5-pro
```

### Remove Alias

Remove an existing alias:

```bash
viben model aliases remove -n <alias>
```

**Example:**
```bash
viben model aliases remove -n old-alias
```

## Configuration File

Aliases are stored in `~/.viben/models.yaml`:

```yaml
# ~/.viben/models.yaml
version: 1

default: claude-sonnet-4-20250514

aliases:
  # Speed-focused
  fast: claude-3-5-haiku-latest
  quick: gpt-4o-mini

  # Quality-focused
  smart: claude-sonnet-4-20250514
  balanced: gpt-4o

  # Maximum capability
  best: claude-opus-4-20250514
  powerful: gpt-4-turbo

  # Purpose-specific
  code: claude-sonnet-4-20250514
  chat: claude-3-5-haiku-latest
  reasoning: o1-preview

  # Provider-specific
  gpt: gpt-4-turbo
  claude: claude-sonnet-4-20250514
  gemini: gemini-1.5-pro
```

## Recommended Alias Categories

### By Performance

| Alias | Description | Example Model |
|-------|-------------|---------------|
| `fast` | Fastest response time | claude-3-5-haiku-latest |
| `quick` | Quick responses | gpt-4o-mini |
| `balanced` | Balanced speed/quality | gpt-4o |
| `smart` | High quality | claude-sonnet-4-20250514 |
| `best` | Maximum quality | claude-opus-4-20250514 |
| `powerful` | Most capable | gpt-4-turbo |

### By Use Case

| Alias | Description | Example Model |
|-------|-------------|---------------|
| `code` | Code generation/review | claude-sonnet-4-20250514 |
| `chat` | Casual conversation | claude-3-5-haiku-latest |
| `reasoning` | Complex reasoning | o1-preview |
| `analysis` | Data analysis | claude-opus-4-20250514 |
| `creative` | Creative writing | claude-opus-4-20250514 |

### By Provider

| Alias | Description | Example Model |
|-------|-------------|---------------|
| `claude` | Default Claude model | claude-sonnet-4-20250514 |
| `gpt` | Default GPT model | gpt-4-turbo |
| `gemini` | Default Gemini model | gemini-1.5-pro |
| `local` | Local Ollama model | llama3 |

## Using Aliases

Once configured, use aliases anywhere you specify a model:

```bash
# Set default model using alias
viben model set-default -n fast

# Use in agent configuration
viben agent config -n my-agent set model smart
```

## Updating Aliases

To update an alias to point to a different model, simply create it again:

```bash
# Update 'fast' to point to a different model
viben model aliases create -n fast -f gpt-4o-mini
```

This will overwrite the existing alias.

## Best Practices

### Use Semantic Names

Choose alias names that describe the use case, not the specific model:

```bash
# Good - semantic naming
viben model aliases create -n fast -f claude-3-5-haiku-latest
viben model aliases create -n best -f claude-opus-4-20250514

# Less ideal - model-specific naming
viben model aliases create -n haiku -f claude-3-5-haiku-latest
viben model aliases create -n opus -f claude-opus-4-20250514
```

Semantic names allow you to swap out the underlying model without changing your workflows.

### Standardize Across Team

If working in a team, agree on a standard set of aliases:

```yaml
aliases:
  # Team standards
  fast: claude-3-5-haiku-latest    # For quick operations
  default: claude-sonnet-4-20250514 # Default for most tasks
  premium: claude-opus-4-20250514   # When quality matters most
```

### Keep Aliases Minimal

Too many aliases can be confusing. Stick to a small set of commonly used ones:

```yaml
# Good - focused set
aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  best: claude-opus-4-20250514

# Less ideal - too many aliases
aliases:
  fast: ...
  quick: ...
  speedy: ...
  rapid: ...
  # etc.
```

## JSON Output

```bash
viben model aliases list --json
```

```json
{
  "success": true,
  "data": {
    "aliases": {
      "fast": "claude-3-5-haiku-latest",
      "smart": "claude-sonnet-4-20250514",
      "best": "claude-opus-4-20250514",
      "gpt": "gpt-4-turbo"
    }
  }
}
```

## Next Steps

- [Model Fallbacks](./fallbacks) - Set up automatic fallback chains
- [Model Management](./models) - Configure model settings
- [Provider Management](./providers) - Configure providers for your models
