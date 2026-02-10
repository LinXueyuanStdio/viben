#!/usr/bin/env python3
"""
Inject subagent context from task's jsonl files.

This hook reads the task's context files (implement.jsonl, check.jsonl, debug.jsonl)
and injects them into the agent's context.
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


def get_current_task():
    """Get the current task path."""
    task_file = get_viben_dir() / ".current-task"
    if task_file.exists():
        return task_file.read_text().strip()
    return None


def read_jsonl(file_path):
    """Read entries from a jsonl file."""
    entries = []
    if file_path.exists():
        with open(file_path) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
    return entries


def main():
    """Main hook function."""
    repo_root = get_repo_root()
    current_task = get_current_task()

    if not current_task:
        return

    task_dir = repo_root / current_task

    # Determine which context file to use based on agent type
    agent_type = os.environ.get("VIBEN_AGENT_TYPE", "implement")

    context_file = task_dir / f"{agent_type}.jsonl"
    entries = read_jsonl(context_file)

    if entries:
        # Output files to inject
        files_to_read = []
        for entry in entries:
            file_path = entry.get("file", "")
            if file_path:
                full_path = repo_root / file_path
                if full_path.exists():
                    files_to_read.append(str(full_path))

        if files_to_read:
            print(json.dumps({"inject_files": files_to_read}), file=sys.stderr)


if __name__ == "__main__":
    main()
