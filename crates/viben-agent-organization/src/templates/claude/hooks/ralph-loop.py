#!/usr/bin/env python3
"""
Ralph Loop - Iterative verification for multi-agent pipeline.

This hook monitors agent output and determines if verification is needed.
Named after the "Ralph the Check" pattern from effective agent harnesses.
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


def get_ralph_state():
    """Get the current Ralph loop state."""
    state_file = get_viben_dir() / ".ralph-state.json"
    if state_file.exists():
        try:
            return json.loads(state_file.read_text())
        except json.JSONDecodeError:
            pass
    return {"iterations": 0, "max_iterations": 5}


def save_ralph_state(state):
    """Save the Ralph loop state."""
    state_file = get_viben_dir() / ".ralph-state.json"
    state_file.write_text(json.dumps(state, indent=2))


def check_completion_markers(output):
    """Check for completion markers in agent output."""
    completion_markers = [
        "## Implementation Complete",
        "## Check Results",
        "## Debug Report",
        "Lint: Passed",
        "TypeCheck: Passed"
    ]

    for marker in completion_markers:
        if marker in output:
            return True

    return False


def main():
    """Main hook function."""
    # Get input from stdin if available
    if not sys.stdin.isatty():
        output = sys.stdin.read()
    else:
        output = ""

    state = get_ralph_state()
    iterations = state.get("iterations", 0)
    max_iterations = state.get("max_iterations", 5)

    # Check if we should continue
    if iterations >= max_iterations:
        print(json.dumps({
            "action": "stop",
            "reason": "max_iterations_reached",
            "iterations": iterations
        }), file=sys.stderr)
        return

    # Check for completion
    if check_completion_markers(output):
        print(json.dumps({
            "action": "complete",
            "iterations": iterations
        }), file=sys.stderr)
        # Reset state
        save_ralph_state({"iterations": 0, "max_iterations": max_iterations})
        return

    # Continue loop
    state["iterations"] = iterations + 1
    save_ralph_state(state)

    print(json.dumps({
        "action": "continue",
        "iterations": state["iterations"]
    }), file=sys.stderr)


if __name__ == "__main__":
    main()
