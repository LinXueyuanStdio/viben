# Shared Documentation

This directory contains documentation shared across multiple audience categories.

## Directory Structure

| Subdirectory | Content | Related Audiences |
|--------------|---------|-------------------|
| [architecture/](./architecture/overview.md) | System architecture, core integrations | backend, frontend, agent |
| [guides/](./guides/index.md) | Development philosophy guides | backend, frontend, agent |
| [data-models/](./data-models/workspace.md) | Data model definitions | backend, frontend |

## Core Documentation

| Document | Description | Related Audiences |
|----------|-------------|-------------------|
| [Provider System](./provider-system.md) | Provider system design | frontend, backend |
| [Plugin Architecture](./plugin-architecture.md) | Plugin architecture design | backend, agent |

## Usage Guide

- **Frontend developers** refer to architecture/ and data-models/
- **Backend developers** refer to architecture/ and data-models/
- **Agent developers** refer to architecture/ and guides/
- **CLI documentation** has been moved to the standalone [CLI](/cli/) category

## How to Reference from Categories

Add reference links to shared/ in each category's index.md:

```markdown
## Related Shared Documentation

- [Architecture Overview](../shared/architecture/overview.md)
- [Data Models](../shared/data-models/)
```
