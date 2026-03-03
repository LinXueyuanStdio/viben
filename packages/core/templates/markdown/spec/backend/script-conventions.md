# Script Conventions

> Standards for Python scripts in the `.viben/scripts/` directory.

---

## Overview

All workflow scripts are written in **Python 3.10+** for cross-platform compatibility. Scripts use only the standard library (no external dependencies).

---

## Directory Structure

```
.viben/scripts/
├── __init__.py           # Package init
├── common/               # Shared modules
│   ├── __init__.py
│   ├── paths.py          # Path constants and functions
│   ├── developer.py      # Developer identity management
│   ├── task_queue.py     # Task queue CRUD
│   ├── task_utils.py     # Task helper functions
│   ├── phase.py          # Multi-agent phase tracking
│   ├── registry.py       # Agent registry management
│   ├── worktree.py       # Git worktree utilities
│   └── git_context.py    # Git/session context
├── multi_agent/          # Multi-agent pipeline scripts
│   ├── __init__.py
│   ├── start.py          # Start worktree agent
│   ├── status.py         # Monitor agent status
│   ├── plan.py           # Start plan agent
│   ├── cleanup.py        # Cleanup worktree
│   └── create_pr.py      # Create PR from task
├── task.py               # Main task management CLI
├── get_context.py        # Session context retrieval
├── init_developer.py     # Developer initialization
├── get_developer.py      # Get current developer
├── add_session.py        # Session recording
└── create_bootstrap.py   # Bootstrap task creation
```

---

## Script Types

### Library Modules (`common/*.py`)

Shared utilities imported by other scripts. **Never run directly.**

```python
# common/paths.py - Example library module

from __future__ import annotations

from pathlib import Path

# Constants
DIR_WORKFLOW = ".viben"
DIR_SCRIPTS = "scripts"
DIR_TASKS = "tasks"

def get_repo_root() -> Path | None:
    """Find repository root by looking for .viben directory."""
    current = Path.cwd().resolve()
    while current != current.parent:
        if (current / DIR_WORKFLOW).is_dir():
            return current
        current = current.parent
    return None
```

### Entry Scripts (`*.py`)

CLI tools that users run directly. Include docstring with usage.

```python
#!/usr/bin/env python3
"""
Task Management Script.

Usage:
    python3 task.py create "<title>" [--slug <name>]
    python3 task.py list [--mine] [--status <status>]
    python3 task.py start <dir>
    python3 task.py finish
    python3 task.py archive <task-name>
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from common.paths import get_repo_root, DIR_WORKFLOW


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Task management")
    # ... argument setup
    args = parser.parse_args()
    # ... command dispatch
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

---

## Coding Standards

### Type Hints

Use modern type hints (Python 3.10+ syntax):

```python
# Good
def get_tasks(status: str | None = None) -> list[dict]:
    ...

def read_json(path: Path) -> dict | None:
    ...

# Bad - old style
from typing import Optional, List, Dict
def get_tasks(status: Optional[str] = None) -> List[Dict]:
    ...
```

### Path Handling

Always use `pathlib.Path`:

```python
# Good
from pathlib import Path

def read_file(path: Path) -> str:
    return path.read_text(encoding="utf-8")

config_path = repo_root / DIR_WORKFLOW / "config.json"

# Bad - string concatenation
config_path = repo_root + "/" + DIR_WORKFLOW + "/config.json"
```

### JSON Operations

Use helper functions for consistent error handling:

```python
import json
from pathlib import Path


def read_json(path: Path) -> dict | None:
    """Read JSON file, return None on error."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def write_json(path: Path, data: dict) -> bool:
    """Write JSON file, return success status."""
    try:
        path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )
        return True
    except Exception:
        return False
```

### Subprocess Execution

```python
import subprocess
from pathlib import Path


def run_command(
    cmd: list[str],
    cwd: Path | None = None
) -> tuple[int, str, str]:
    """Run command and return (returncode, stdout, stderr)."""
    result = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True
    )
    return result.returncode, result.stdout, result.stderr
```

---

## Cross-Platform Compatibility

### CRITICAL: Windows stdout Encoding

On Windows, Python's stdout defaults to the system code page (e.g., GBK/CP936 in China, CP1252 in Western locales). This causes `UnicodeEncodeError` when printing non-ASCII characters.

**The Problem Chain**:

```
Windows code page = GBK (936)
    ↓
Python stdout defaults to GBK encoding
    ↓
Subprocess output contains special chars → replaced with \ufffd (replacement char)
    ↓
json.dumps(ensure_ascii=False) → print()
    ↓
GBK cannot encode \ufffd → UnicodeEncodeError: 'gbk' codec can't encode character
```

**Root Cause**: Even if you set `PYTHONIOENCODING` in subprocess calls, the **parent process's stdout** still uses the system code page. The error occurs when `print()` tries to write to stdout.

---

#### GOOD: Use `sys.stdout.reconfigure()` (Python 3.7+)

```python
import sys

# MUST be at the top of the script, before any print() calls
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
```

**Why this works**: `reconfigure()` modifies the existing stream **in-place**, changing its encoding settings directly. This affects all subsequent writes to stdout.

**Best Practice**: Add this to `common/__init__.py` so all scripts that `from common import ...` automatically get the fix:

```python
# common/__init__.py
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ... rest of exports
```

---

#### BAD: Do NOT use `io.TextIOWrapper`

```python
# BAD - This does NOT reliably fix the encoding issue!
import sys
import io

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
```

**Why this fails**:

1. **Creates a new wrapper, doesn't fix the underlying issue**: `TextIOWrapper` wraps `sys.stdout.buffer`, but the original stdout object and its encoding settings may still interfere in some code paths.

2. **Loses original stdout properties**: The new wrapper may not preserve all attributes of the original `sys.stdout` (like `isatty()`, line buffering behavior).

3. **Race condition with buffering**: If any output was buffered before the replacement, it may still be encoded with the old encoding.

4. **Not idempotent**: Calling this multiple times creates nested wrappers, while `reconfigure()` is safe to call multiple times.

**Real-world failure case**: Users reported that `io.TextIOWrapper` did not fix the `UnicodeEncodeError` on Windows, while `sys.stdout.reconfigure()` worked immediately.

---

#### Summary

| Method | Works? | Reason |
|--------|--------|--------|
| `sys.stdout.reconfigure(encoding="utf-8")` | ✅ Yes | Modifies stream in-place |
| `io.TextIOWrapper(sys.stdout.buffer, ...)` | ❌ No | Creates wrapper, doesn't fix underlying encoding |
| `PYTHONIOENCODING=utf-8` env var | ⚠️ Partial | Only works if set **before** Python starts |

### CRITICAL: Always Use `python3` Explicitly

Windows does not support shebang (`#!/usr/bin/env python3`). Always document invocation with explicit `python3`:

```python
# In docstrings
"""
Usage:
    python3 task.py create "My Task"
    python3 task.py list --mine
"""

# In error messages
print("Usage: python3 task.py <command>")
print("Run: python3 ./.viben/scripts/init_developer.py <name>")

# In help text
print("Next steps:")
print("  python3 task.py start <dir>")
```

### Path Separators

Use `pathlib.Path` - it handles separators automatically:

```python
# Good - works on all platforms
path = Path(".viben") / "scripts" / "task.py"

# Bad - Unix-only
path = ".viben/scripts/task.py"
```

---

## Error Handling

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Usage error (wrong arguments) |

### Error Messages

Print errors to stderr with context:

```python
import sys

def error(msg: str) -> None:
    """Print error message to stderr."""
    print(f"Error: {msg}", file=sys.stderr)

# Usage
if not repo_root:
    error("Not in a Viben project (no .viben directory found)")
    sys.exit(1)
```

---

## Argument Parsing

Use `argparse` for consistent CLI interface:

```python
import argparse


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Task management",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 task.py create "Add login" --slug add-login
  python3 task.py list --mine --status in_progress
"""
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # create command
    create_parser = subparsers.add_parser("create", help="Create new task")
    create_parser.add_argument("title", help="Task title")
    create_parser.add_argument("--slug", help="URL-friendly name")

    # list command
    list_parser = subparsers.add_parser("list", help="List tasks")
    list_parser.add_argument("--mine", "-m", action="store_true")
    list_parser.add_argument("--status", "-s", choices=["planning", "in_progress", "review", "completed"])

    args = parser.parse_args()

    if args.command == "create":
        return cmd_create(args)
    elif args.command == "list":
        return cmd_list(args)

    return 0
```

---

## Import Conventions

### Relative Imports Within Package

```python
# In task.py (root level)
from common.paths import get_repo_root, DIR_WORKFLOW
from common.developer import get_developer

# In common/developer.py
from .paths import get_repo_root, DIR_WORKFLOW
```

### Standard Library Imports

Group and order imports:

```python
# 1. Future imports
from __future__ import annotations

# 2. Standard library
import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# 3. Local imports
from common.paths import get_repo_root
from common.developer import get_developer
```

---

## DO / DON'T

### DO

- Use `pathlib.Path` for all path operations
- Use type hints (Python 3.10+ syntax)
- Return exit codes from `main()`
- Print errors to stderr
- Always use `python3` in documentation and messages
- Use `encoding="utf-8"` for all file operations

### DON'T

- Don't use string path concatenation
- Don't use `os.path` when `pathlib` works
- Don't rely on shebang for invocation documentation
- Don't use `print()` for errors (use stderr)
- Don't hardcode paths - use constants from `common/paths.py`
- Don't use external dependencies (stdlib only)

---

## Example: Complete Script

See `.viben/scripts/task.py` for a comprehensive example with:
- Multiple subcommands
- Argument parsing
- JSON file operations
- Error handling
- Cross-platform path handling

---

## Migration Note

> **Historical Context**: Scripts were migrated from Bash to Python in v0.3.0 for cross-platform compatibility. The old shell scripts are archived in `.viben/scripts-shell-archive/` (if preserved).
