#!/usr/bin/env python3
"""
File comparison script that generates a markdown diff report.

Usage:
    python scripts/diff.py --config scripts/diff.yaml
    python scripts/diff.py --config scripts/diff.yaml --output report.md
"""

import argparse
import difflib
import os
import sys
from datetime import datetime
from pathlib import Path

import yaml


def load_config(config_path: str) -> dict:
    """Load YAML configuration file."""
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def read_file_content(file_path: str) -> tuple[list[str], str | None]:
    """Read file content and return lines and error message if any."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.readlines(), None
    except FileNotFoundError:
        return [], f"File not found: {file_path}"
    except Exception as e:
        return [], f"Error reading {file_path}: {e}"


def generate_diff(src_lines: list[str], tgt_lines: list[str], src_path: str, tgt_path: str) -> tuple[str, dict]:
    """Generate unified diff and statistics."""
    diff = list(difflib.unified_diff(
        src_lines,
        tgt_lines,
        fromfile=src_path,
        tofile=tgt_path,
        lineterm=""
    ))

    stats = {
        "src_lines": len(src_lines),
        "tgt_lines": len(tgt_lines),
        "additions": sum(1 for line in diff if line.startswith("+") and not line.startswith("+++")),
        "deletions": sum(1 for line in diff if line.startswith("-") and not line.startswith("---")),
        "identical": len(diff) == 0,
    }

    return "\n".join(diff), stats


def generate_markdown_report(config: dict, results: list[dict]) -> str:
    """Generate markdown report from comparison results. Only shows files with differences."""
    lines = []

    # Header
    lines.append("# File Comparison Report")
    lines.append("")
    lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if config.get("description"):
        lines.append(f"**Description:** {config['description']}")
    lines.append("")

    # Count stats
    identical_count = sum(1 for r in results if not r.get("error") and r.get("stats", {}).get("identical"))
    different_count = sum(1 for r in results if not r.get("error") and not r.get("stats", {}).get("identical"))
    error_count = sum(1 for r in results if r.get("error"))

    lines.append(f"**Total:** {len(results)} pairs | ✅ {identical_count} identical | ⚠️ {different_count} different | ❌ {error_count} errors")
    lines.append("")

    # Only show files with differences
    for result in results:
        # Skip identical files
        if not result.get("error") and result.get("stats", {}).get("identical"):
            continue

        lines.append("---")
        lines.append("")
        lines.append(f"- **src:** `{result['src']}`")
        lines.append(f"- **tgt:** `{result['tgt']}`")
        lines.append("")

        if result.get("error"):
            lines.append(f"**Error:** {result['error']}")
        else:
            lines.append("```diff")
            lines.append(result["diff"])
            lines.append("```")

        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Compare file pairs and generate markdown report")
    parser.add_argument("--config", "-c", required=True, help="Path to YAML config file")
    parser.add_argument("--output", "-o", help="Output markdown file path (default: stdout)")
    args = parser.parse_args()

    # Load config
    config = load_config(args.config)

    if "file-pairs" not in config:
        print("Error: config must contain 'file-pairs' key", file=sys.stderr)
        sys.exit(1)

    # Get base paths (optional)
    src_base = config.get("src_base_path", "")
    tgt_base = config.get("tgt_base_path", "")

    # Process each file pair
    results = []
    for pair in config["file-pairs"]:
        src = pair.get("src", "")
        tgt = pair.get("tgt", "")

        # Join with base paths if provided
        if src_base and not src.startswith("/"):
            src = os.path.join(src_base, src)
        if tgt_base and not tgt.startswith("/"):
            tgt = os.path.join(tgt_base, tgt)

        result = {"src": src, "tgt": tgt}

        src_lines, src_error = read_file_content(src)
        if src_error:
            result["error"] = src_error
            results.append(result)
            continue

        tgt_lines, tgt_error = read_file_content(tgt)
        if tgt_error:
            result["error"] = tgt_error
            results.append(result)
            continue

        diff, stats = generate_diff(src_lines, tgt_lines, src, tgt)
        result["diff"] = diff
        result["stats"] = stats
        results.append(result)

    # Generate report
    report = generate_markdown_report(config, results)

    # Output
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"Report written to: {args.output}")
    else:
        print(report)


if __name__ == "__main__":
    main()
