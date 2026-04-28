---
sidebar_position: 23
title: "viben idea"
description: "AI-driven idea generation command that analyzes project codebase to automatically generate improvement suggestions"
---

# viben idea

AI-driven idea generation command that analyzes project codebase to automatically generate improvement suggestions.

## Overview

The `viben idea` command analyzes the project codebase to automatically generate improvement suggestions. It supports 6 built-in types and user-defined custom types. Generated ideas can be converted to tasks using the `promote` command.

## Built-in Types

| Type | Description |
|------|-------------|
| `code_improvements` | Code improvements - improvement opportunities based on existing patterns |
| `ui_ux_improvements` | UI/UX improvements - visual and interaction enhancements |
| `documentation_gaps` | Documentation gaps - missing or insufficient documentation |
| `security_hardening` | Security hardening - security vulnerabilities and hardening measures |
| `performance_optimizations` | Performance optimizations - performance bottlenecks and optimization techniques |
| `code_quality` | Code quality - code quality improvements and refactoring patterns |

## Command Structure

```bash
viben idea <subcommand> [options]
```

## Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `generate` | Generate ideas (core command) |
| `list` | List generated ideas |
| `list-types` | List available idea types |
| `view` | View idea details |
| `promote` | Convert idea to task |
| `clear` | Clear all ideas and sessions |
| `remove` | Delete idea |

## Generate Ideas

```bash
viben idea generate --types <type>... [options]
```

**Required Parameters**:

| Parameter | Description |
|-----------|-------------|
| `--types`, `-t` | Idea types to generate, multiple selection allowed |

**Optional Parameters**:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--output`, `-o` | Output directory | `.viben/ideas/` |
| `--model`, `-m` | AI model | Global config |
| `--max-ideas` | Maximum ideas per type | 5 |
| `--append` | Append mode, preserve existing ideas | false |
| `--focus` | Focus area for generation | - |
| `--override` | Force regenerate all types | false |
| `--json` | JSON format output for progress | false |

**Examples**:

```bash
# Generate code improvements and code quality ideas
viben idea generate --types code_improvements code_quality

# Use custom type
viben idea generate --types my_custom_type --model opus

# Append mode, maximum 10 per type
viben idea generate -t security_hardening --append --max-ideas 10
```

## List Ideas

```bash
viben idea list [options]
```

**Options**:

| Parameter | Description |
|-----------|-------------|
| `--type`, `-t` | Filter by type |
| `--effort`, `-e` | Filter by effort (trivial/small/medium/large/complex) |
| `--status`, `-s` | Filter by status (draft/promoted/dismissed) |
| `--json` | JSON format output |

**Output**:

```
Ideas (3):

[a1b2c3d4] code_improvements  draft  small
  Add retry logic to API calls
  Add automatic retry logic for API calls to handle temporary network failures
  Why: Current code fails directly on network errors without retry mechanism
  Files:
    - src/api/client.ts
    - src/api/request.ts
  Implementation:
    Use exponential backoff strategy, retry up to 3 times

[b2c3d4e5] code_improvements  draft  medium
  Extract common validators
  Extract common validation logic into a separate module
  Why: Multiple places have duplicate validation logic
  Files:
    - src/utils/validators.ts
    - src/forms/*.ts

[c3d4e5f6] security_hardening  promoted  small
  Add input sanitization
  Add input sanitization to prevent XSS attacks
  Why: User input is rendered directly without filtering
  Task: 03-11-input-sanitization
```

## List Types

```bash
viben idea list-types [--json]
```

**Output**:

```
TYPE                        SOURCE      DESCRIPTION
code_improvements           builtin     Code improvements - improvement opportunities based on existing patterns
ui_ux_improvements          builtin     UI/UX improvements - visual and interaction enhancements
documentation_gaps          builtin     Documentation gaps - missing or insufficient documentation
security_hardening          builtin     Security hardening - security vulnerabilities and hardening measures
performance_optimizations   builtin     Performance optimizations - performance bottlenecks and optimization techniques
code_quality                builtin     Code quality - code quality improvements and refactoring patterns
api_design                  custom      docs/idea-types/api_design.md
```

## View Idea Details

```bash
viben idea view <idea-id> [--json]
```

**Output**:

```
[a1b2c3d4] code_improvements  draft  small
Add retry logic to API calls
Created: 2026-03-11T14:30:00Z

Description
Add automatic retry logic for API calls to handle temporary network failures

Rationale
Current code fails directly on network errors without retry mechanism

Affected Files
  - src/api/client.ts
  - src/api/request.ts

Existing Patterns
  - error handling in src/utils/error.ts

Implementation
Use exponential backoff strategy, retry up to 3 times.
1. Add retry wrapper in src/api/client.ts
2. Configure maximum retry count and backoff time
3. Retry on retriable error codes
```

## Promote Idea to Task

```bash
viben idea promote <idea-id> [options]
```

**Options** (consistent with `viben task create`):

| Parameter | Description | Default |
|-----------|-------------|---------|
| `-s, --slug <name>` | Task identifier | Generated from idea title |
| `-b, --branch <branch>` | Custom branch name | `feature/<slug>` |
| `-a, --assignee <dev>` | Assign to | Current developer |
| `-p, --priority <priority>` | Priority (P0-P3) | Mapped from effort |
| `-d, --description <text>` | Task description | Idea's description |
| `--agent <agent-id>` | Associated agent configuration | - |
| `--executor <type>` | Executor type | CLAUDE_CODE |
| `--model <model>` | Model to use | - |
| `--start` | Automatically add to queue | false |
| `--worktree` | Run in git worktree | false |
| `--json` | JSON format output | false |

**Effort -> Priority Default Mapping**:

| Effort | Priority |
|--------|----------|
| trivial | P3 |
| small | P3 |
| medium | P2 |
| large | P1 |
| complex | P1 |

**Examples**:

```bash
# Convert idea to task (simplest way)
viben idea promote ci-001

# Specify priority and slug
viben idea promote ci-001 --slug add-retry-logic --priority P1

# Create and automatically start task
viben idea promote ci-001 --start

# Develop in isolated worktree
viben idea promote ci-001 --worktree --start

# Full example
viben idea promote ci-001 \
  --slug add-retry-logic \
  --branch feature/api-retry \
  --priority P1 \
  --executor CLAUDE_CODE \
  --model opus \
  --start
```

## Clear Ideas

Clear all ideas and sessions. This is a destructive operation that removes all session directories under `.viben/ideas/`.

```bash
viben idea clear [--force] [--json]
```

**Options**:

| Parameter | Description |
|-----------|-------------|
| `--force`, `-f` | Skip confirmation warning |
| `--json` | JSON format output |

**Examples**:

```bash
# Clear all ideas (shows warning)
viben idea clear

# Skip warning and clear directly
viben idea clear --force

# JSON format output
viben idea clear --force --json
```

**Output**:

```
Warning: This will remove ALL ideas and sessions. Use --force to skip this warning.
Cleared 15 idea(s)
```

:::note
`clear` is a shortcut for `remove --all` with clearer semantics. Both commands display a warning by default and require `--force` to skip.
:::

## Remove Ideas

```bash
viben idea remove <idea-id>... [--type <type>] [--all]
```

**Options**:

| Parameter | Description |
|-----------|-------------|
| `--type`, `-t` | Delete all ideas of specified type |
| `--all` | Delete all ideas |

**Examples**:

```bash
# Delete single idea
viben idea remove ci-001

# Delete multiple ideas
viben idea remove ci-001 ci-002 sq-001

# Delete all ideas of a type
viben idea remove --type code_improvements

# Clear all ideas
viben idea remove --all
```

## Data Structure

### Directory Structure

```
.viben/
└── ideas/
    └── <date>-<slug>/                          # One directory per generation
        ├── idea.json                           # Metadata
        ├── idea_code_improvements_<name1>.md   # Each idea in separate file
        ├── idea_code_improvements_<name2>.md
        ├── idea_security_hardening_<name1>.md
        └── idea_my_custom_type_<name1>.md

docs/
└── idea-types/                  # Custom type prompt templates
    ├── api_design.md
    └── refactoring.md
```

### idea.json Format

```json
{
  "id": "03-11-api-improvement",
  "types": ["code_improvements", "security_hardening"],
  "model": "sonnet",
  "summary": {
    "total_ideas": 10,
    "by_type": {"code_improvements": 5, "security_hardening": 5},
    "by_status": {"draft": 9, "promoted": 1}
  },
  "files": [
    "idea_code_improvements_add-retry-logic.md",
    "idea_code_improvements_extract-validators.md",
    "idea_security_hardening_input-sanitization.md"
  ],
  "generated_at": "2026-03-11T14:30:00Z",
  "updated_at": "2026-03-11T14:35:00Z"
}
```

### idea_*.md Format

```markdown
---
id: a1b2c3d4
type: code_improvements
name: add-retry-logic
title: Add retry logic to API calls
description: Add automatic retry logic for API calls to handle temporary network failures
rationale: Current code fails directly on network errors without retry mechanism
estimated_effort: small
status: draft
promoted_to: null
created_at: 2026-03-11T14:30:00Z
affected_files:
  - src/api/client.ts
  - src/api/request.ts
existing_patterns:
  - error handling in src/utils/error.ts
---

Use exponential backoff strategy, retry up to 3 times.

1. Add retry wrapper in `src/api/client.ts`
2. Configure maximum retry count and backoff time
3. Retry on retriable error codes (e.g., 5xx, network timeout)
```

## Execution Flow

### `viben idea generate` Pipeline

```
+-------------------------------------------------------------+
|                    GENERATE PIPELINE                         |
+-------------------------------------------------------------+
|                                                              |
|  STEP 1: Parse Arguments                                     |
|  +-------------------------------------+                    |
|  | - Validate --types parameter         |                    |
|  | - Load type prompt (built-in or      |                    |
|  |   custom)                            |                    |
|  | - Determine output directory & model |                    |
|  +-------------------------------------+                    |
|                      |                                       |
|                      v                                       |
|  STEP 2: Create Output Directory                             |
|  +-------------------------------------+                    |
|  | .viben/ideas/<date>-<slug>/          |                    |
|  | - Initialize idea.json               |                    |
|  +-------------------------------------+                    |
|                      |                                       |
|                      v                                       |
|  STEP 3: Generate Ideas in Parallel                          |
|  +----------+ +----------+ +----------+                      |
|  | type_1   | | type_2   | | type_n   |                      |
|  | AI Agent | | AI Agent | | AI Agent |                      |
|  +----+-----+ +----+-----+ +----+-----+                      |
|       |            |            |                             |
|       v            v            v                             |
|  +---------------------------------------------+            |
|  | idea_type1_name1.md, idea_type1_name2.md...  |            |
|  | idea_type2_name1.md, idea_type2_name2.md...  |            |
|  | idea_typen_name1.md, idea_typen_name2.md...  |            |
|  +---------------------------------------------+            |
|                      |                                       |
|                      v                                       |
|  STEP 4: Update Metadata                                     |
|  +-------------------------------------+                    |
|  | - Count ideas by type               |                    |
|  | - Update idea.json summary          |                    |
|  +-------------------------------------+                    |
|                                                              |
+-------------------------------------------------------------+
```

## Custom Types

Users can create custom type prompt templates in `docs/idea-types/*.md`.

```markdown
---
name: api_design
description: API design improvements - RESTful conventions, interface consistency, version management
max_ideas: 5
---

# API Design Ideation Agent

You are an API design expert responsible for analyzing the project codebase and proposing API improvement suggestions.

## Analysis Focus

1. RESTful convention compliance
2. Interface naming consistency
3. Request/response format uniformity
4. Error handling standards
5. API version management

## Output Requirements

For each improvement suggestion, provide:

- **title**: Brief description
- **description**: Improvement content
- **rationale**: Why improvement is needed
- **affected_files**: Files involved
- **existing_patterns**: Existing patterns for reference
- **implementation_approach**: Implementation method
- **estimated_effort**: trivial/small/medium/large/complex
```

### YAML Header Fields

Custom type templates use YAML frontmatter with the following fields:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Type identifier |
| `description` | Yes | Type description (displayed in list-types) |
| `focus_areas` | No | List of areas to focus on during analysis |
| `max_ideas` | No | Default maximum number of ideas, default 5 |
| `output_format` | No | Output format specification |
| `model` | No | Preferred model for this type |

The body (after the YAML header) is the prompt content, sent directly to the AI.

### Built-in Type Storage

Built-in types are stored in `packages/core/templates/viben/idea-types/` and loaded directly from this directory at runtime:

```
packages/core/templates/viben/idea-types/
  code_improvements.md        # Code improvements
  code_quality.md             # Code quality
  documentation_gaps.md       # Documentation gaps
  performance_optimizations.md  # Performance optimizations
  security_hardening.md       # Security hardening
  ui_ux_improvements.md       # UI/UX improvements
```

### Type Lookup Order

The CLI looks up idea type prompts in the following order:

1. `docs/idea-types/<type>.md` (project custom types, takes priority)
2. `packages/core/templates/viben/idea-types/<type>.md` (built-in fallback)

This means:
- Built-in types are available even without running `viben init`
- Projects can override built-in types by placing files in `docs/idea-types/`
- Custom types only need to be created in `docs/idea-types/`

## Related Commands

- [viben task](./task) - Task management command
- [viben model](./model) - Model configuration
