#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Session Start Hook - Inject structured context
"""

# IMPORTANT: Suppress all warnings FIRST
import warnings
warnings.filterwarnings("ignore")

import json
import os
import subprocess
import sys
from io import StringIO
from pathlib import Path

# IMPORTANT: Force stdout to use UTF-8 on Windows
# This fixes UnicodeEncodeError when outputting non-ASCII characters
if sys.platform == "win32":
    import io as _io
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    elif hasattr(sys.stdout, "detach"):
        sys.stdout = _io.TextIOWrapper(sys.stdout.detach(), encoding="utf-8", errors="replace")  # type: ignore[union-attr]


def should_skip_injection() -> bool:
    return (
        os.environ.get("CLAUDE_NON_INTERACTIVE") == "1"
        or os.environ.get("OPENCODE_NON_INTERACTIVE") == "1"
    )


def read_file(path: Path, fallback: str = "") -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (FileNotFoundError, PermissionError):
        return fallback


def run_viben_command(args: list[str], cwd: Path) -> str:
    """Run viben CLI command and return output."""
    try:
        # Try npx viben first (for development), then viben (for installed)
        for cmd_prefix in [["npx", "viben"], ["viben"]]:
            try:
                result = subprocess.run(
                    cmd_prefix + args,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=10,
                    cwd=cwd,
                )
                if result.returncode == 0:
                    return result.stdout
            except FileNotFoundError:
                continue
        return "No context available"
    except subprocess.TimeoutExpired:
        return "No context available"


def main():
    if should_skip_injection():
        sys.exit(0)

    project_dir = Path(os.environ.get("CLAUDE_PROJECT_DIR", ".")).resolve()
    viben_dir = project_dir / ".viben"
    claude_dir = project_dir / ".claude"

    output = StringIO()

    output.write("""<session-context>
You are starting a new session in a Viben-managed project.
Read and follow all instructions below carefully.
</session-context>

""")

    output.write("<current-state>\n")
    output.write(run_viben_command(["task", "context"], project_dir))
    output.write("\n</current-state>\n\n")

    output.write("<workflow>\n")
    workflow_content = read_file(viben_dir / "workflow.md", "No workflow.md found")
    output.write(workflow_content)
    output.write("\n</workflow>\n\n")

    output.write("<guidelines>\n")

    output.write("## Frontend\n")
    frontend_index = read_file(
        viben_dir / "spec" / "frontend" / "index.md", "Not configured"
    )
    output.write(frontend_index)
    output.write("\n\n")

    output.write("## Backend\n")
    backend_index = read_file(
        viben_dir / "spec" / "backend" / "index.md", "Not configured"
    )
    output.write(backend_index)
    output.write("\n\n")

    output.write("## Guides\n")
    guides_index = read_file(
        viben_dir / "spec" / "guides" / "index.md", "Not configured"
    )
    output.write(guides_index)

    output.write("\n</guidelines>\n\n")

    output.write("<instructions>\n")
    start_md = read_file(
        claude_dir / "commands" / "viben" / "start.md", "No start.md found"
    )
    output.write(start_md)
    output.write("\n</instructions>\n\n")

    output.write("""<ready>
Context loaded. Wait for user's first message, then follow <instructions> to handle their request.
</ready>""")

    result = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": output.getvalue(),
        }
    }

    # Output JSON - stdout is already configured for UTF-8
    print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
