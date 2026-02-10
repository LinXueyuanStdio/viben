#!/usr/bin/env python3
"""
Session start hook for Viben workflow.

This hook is called at the start of a Claude Code session.
It can be used to inject context or perform setup tasks.
"""

import json
import os
import sys
from pathlib import Path


def get_repo_root():
    """Find the repository root."""
    cwd = Path.cwd()
    while cwd != cwd.parent:
        if (cwd / ".git").exists():
            return cwd
        cwd = cwd.parent
    return Path.cwd()


def get_viben_dir():
    """Get the .viben directory path."""
    return get_repo_root() / ".viben"


def get_developer():
    """Get the current developer name."""
    dev_file = get_viben_dir() / ".developer"
    if dev_file.exists():
        return dev_file.read_text().strip()
    return None


def get_current_task():
    """Get the current task path."""
    task_file = get_viben_dir() / ".current-task"
    if task_file.exists():
        return task_file.read_text().strip()
    return None


def main():
    """Main hook function."""
    viben_dir = get_viben_dir()

    if not viben_dir.exists():
        # Viben not initialized, skip
        return

    developer = get_developer()
    current_task = get_current_task()

    context = {
        "developer": developer,
        "current_task": current_task,
        "viben_initialized": True
    }

    # Output context for Claude Code to pick up
    print(json.dumps(context), file=sys.stderr)


if __name__ == "__main__":
    main()
