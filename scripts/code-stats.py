#!/usr/bin/env python3
"""
Code Statistics Generator for Viben

Uses pygount to analyze the codebase and generates a JSON file
for the web dashboard at apps/web/public/data/code-stats.json

Usage:
    pnpm code-stats
    # or
    python scripts/code-stats.py
"""

import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    from pygount import SourceAnalysis, ProjectSummary
    from pygount.analysis import SourceScanner
except ImportError:
    print("Error: pygount is not installed. Please run:")
    print("  pip install pygount")
    sys.exit(1)


# Project root directory
PROJECT_ROOT = Path(__file__).parent.parent

# Output path
OUTPUT_PATH = PROJECT_ROOT / "apps" / "web" / "public" / "data" / "code-stats.json"

# Directories to exclude
EXCLUDE_DIRS = {
    # Build & cache
    "node_modules",
    "dist",
    "build",
    "target",
    "__pycache__",
    "coverage",
    ".nyc_output",
    "vendor",
    # Virtual environments
    ".venv",
    "venv",
    "env",
    # Hidden/tool directories
    ".git",
    ".next",
    ".turbo",
    ".vercel",
    ".auto-claude",
    ".claude",
    ".viben",
    ".trellis",
    ".cache",
    ".idea",
    ".vscode",
}

# Files to exclude (lock files, generated files, etc.)
EXCLUDE_FILES = {
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "Cargo.lock",
    "poetry.lock",
    "Gemfile.lock",
    "composer.lock",
    "go.sum",
    ".DS_Store",
}

# Language color mapping
LANG_COLORS = {
    "TypeScript": "#3178C6",
    "TSX": "#61DAFB",
    "JavaScript": "#F7DF1E",
    "JSX": "#61DAFB",
    "Python": "#3776AB",
    "Rust": "#DEA584",
    "Go": "#00ADD8",
    "Markdown": "#083FA1",
    "JSON": "#F59E0B",
    "YAML": "#CB171E",
    "TOML": "#9C4121",
    "HTML": "#E34F26",
    "CSS": "#1572B6",
    "SCSS": "#CC6699",
    "Shell": "#89E051",
    "Bash": "#89E051",
    "SQL": "#E38C00",
    "GraphQL": "#E10098",
    "Dockerfile": "#2496ED",
    "Makefile": "#427819",
    "XML": "#F16529",
    "SVG": "#FFB13B",
    "Plain Text": "#6B7280",
}

# Module color mapping
MODULE_COLORS = {
    "apps/desktop": "#F59E0B",
    "apps/web": "#10B981",
    "apps/docs": "#8B5CF6",
    "apps/cli": "#EC4899",
    "packages/core": "#3B82F6",
    "packages/ui": "#06B6D4",
    "backend/gateway": "#EF4444",
    "backend/mcp-registry": "#F97316",
}

# Desktop directory colors
DESKTOP_DIR_COLORS = {
    "components": "#8B5CF6",
    "pages": "#3B82F6",
    "hooks": "#10B981",
    "lib": "#F59E0B",
    "stores": "#EC4899",
    "types": "#6366F1",
    "utils": "#14B8A6",
    "services": "#F97316",
}


def get_extension(filename: str) -> str:
    """Get file extension without dot."""
    ext = Path(filename).suffix.lower()
    return ext[1:] if ext else ""


def should_exclude(path: Path) -> bool:
    """Check if path should be excluded."""
    parts = path.parts
    # Check excluded directories
    if any(part in EXCLUDE_DIRS for part in parts):
        return True
    # Check excluded files
    if path.name in EXCLUDE_FILES:
        return True
    return False


def get_git_tracked_files(root: Path) -> set[str]:
    """Get set of files tracked by git (respects .gitignore)."""
    try:
        result = subprocess.run(
            ["git", "ls-files"],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
        )
        return set(result.stdout.strip().split("\n")) if result.stdout.strip() else set()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return set()


def is_git_repo(root: Path) -> bool:
    """Check if directory is a git repository."""
    return (root / ".git").exists()


def get_commit_activity(root: Path) -> list[dict]:
    """获取最近 365 天的每日提交次数"""
    try:
        # Get commits from last 365 days
        since_date = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
        result = subprocess.run(
            ["git", "log", f"--since={since_date}", "--format=%ad", "--date=short"],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
        )

        # Count commits per day
        commit_counts = defaultdict(int)
        if result.stdout.strip():
            for line in result.stdout.strip().split("\n"):
                if line:
                    commit_counts[line] += 1

        # Generate all dates in range
        activity = []
        today = datetime.now().date()
        for i in range(365):
            date = (today - timedelta(days=364-i)).strftime("%Y-%m-%d")
            activity.append({
                "date": date,
                "count": commit_counts.get(date, 0)
            })

        return activity
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []


def get_file_churn(root: Path, git_files: set) -> list[dict]:
    """统计最近 90 天文件变更频率"""
    try:
        # Get file changes from last 90 days
        since_date = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
        result = subprocess.run(
            ["git", "log", f"--since={since_date}", "--name-only", "--format="],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
        )

        # Count changes per file
        change_counts = defaultdict(int)
        if result.stdout.strip():
            for line in result.stdout.strip().split("\n"):
                line = line.strip()
                if line and line in git_files:
                    # Exclude files in excluded directories
                    if not should_exclude(Path(line)):
                        change_counts[line] += 1

        # Get last changed date for top files
        churn_data = []
        for path, count in sorted(change_counts.items(), key=lambda x: x[1], reverse=True)[:15]:
            try:
                date_result = subprocess.run(
                    ["git", "log", "-1", "--format=%ad", "--date=short", "--", path],
                    cwd=root,
                    capture_output=True,
                    text=True,
                    check=True,
                )
                last_changed = date_result.stdout.strip() if date_result.stdout.strip() else ""
            except subprocess.CalledProcessError:
                last_changed = ""

            churn_data.append({
                "path": path,
                "changes": count,
                "lastChanged": last_changed,
            })

        return churn_data
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []


def get_code_freshness(root: Path, git_files: set) -> list[dict]:
    """分析文件最后修改时间分布"""
    now = datetime.now()

    # Age buckets: < 1 month, 1-3 months, 3-6 months, 6-12 months, > 1 year
    buckets = {
        "<1月": {"files": 0, "lines": 0, "color": "#10B981", "max_days": 30},
        "1-3月": {"files": 0, "lines": 0, "color": "#3B82F6", "max_days": 90},
        "3-6月": {"files": 0, "lines": 0, "color": "#F59E0B", "max_days": 180},
        "6-12月": {"files": 0, "lines": 0, "color": "#F97316", "max_days": 365},
        ">1年": {"files": 0, "lines": 0, "color": "#EF4444", "max_days": float('inf')},
    }
    bucket_order = ["<1月", "1-3月", "3-6月", "6-12月", ">1年"]

    for file_path in git_files:
        if should_exclude(Path(file_path)):
            continue

        full_path = root / file_path
        if not full_path.exists() or full_path.is_dir():
            continue

        # Get file extension
        ext = get_extension(file_path)
        if not ext:
            continue

        try:
            # Get last modification timestamp from git
            result = subprocess.run(
                ["git", "log", "-1", "--format=%at", "--", file_path],
                cwd=root,
                capture_output=True,
                text=True,
                check=True,
            )
            if not result.stdout.strip():
                continue

            timestamp = int(result.stdout.strip())
            mod_date = datetime.fromtimestamp(timestamp)
            days_old = (now - mod_date).days

            # Count lines
            try:
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = sum(1 for _ in f)
            except Exception:
                continue

            # Assign to bucket
            for label in bucket_order:
                if days_old < buckets[label]["max_days"]:
                    buckets[label]["files"] += 1
                    buckets[label]["lines"] += lines
                    break
        except (subprocess.CalledProcessError, ValueError):
            continue

    return [
        {"label": label, "files": buckets[label]["files"], "lines": buckets[label]["lines"], "color": buckets[label]["color"]}
        for label in bucket_order
    ]


def get_file_size_distribution(all_files: list) -> list[dict]:
    """统计文件行数分布区间"""
    # Size buckets
    buckets = [
        {"range": "0-50", "files": 0, "color": "#10B981", "min": 0, "max": 50},
        {"range": "50-100", "files": 0, "color": "#3B82F6", "min": 50, "max": 100},
        {"range": "100-200", "files": 0, "color": "#F59E0B", "min": 100, "max": 200},
        {"range": "200-500", "files": 0, "color": "#F97316", "min": 200, "max": 500},
        {"range": "500+", "files": 0, "color": "#EF4444", "min": 500, "max": float('inf')},
    ]

    for file_info in all_files:
        lines = file_info["lines"]
        for bucket in buckets:
            if bucket["min"] <= lines < bucket["max"]:
                bucket["files"] += 1
                break

    return [
        {"range": b["range"], "files": b["files"], "color": b["color"]}
        for b in buckets
    ]


def get_module_name(path: Path) -> str | None:
    """Extract module name from path (e.g., apps/desktop, packages/core)."""
    parts = path.parts
    for i, part in enumerate(parts):
        if part in ("apps", "packages", "backend") and i + 1 < len(parts):
            return f"{part}/{parts[i + 1]}"
    return None


def get_desktop_dir(path: Path) -> str | None:
    """Extract desktop app directory name."""
    parts = path.parts
    try:
        # Looking for apps/desktop/src/<dirname>
        desktop_idx = parts.index("desktop")
        if desktop_idx + 2 < len(parts) and parts[desktop_idx + 1] == "src":
            return parts[desktop_idx + 2]
    except (ValueError, IndexError):
        pass
    return None


def get_language_from_ext(ext: str) -> str:
    """Map file extension to language name."""
    ext_map = {
        "ts": "TypeScript",
        "tsx": "TSX",
        "js": "JavaScript",
        "jsx": "JSX",
        "py": "Python",
        "rs": "Rust",
        "go": "Go",
        "md": "Markdown",
        "mdx": "Markdown",
        "json": "JSON",
        "yaml": "YAML",
        "yml": "YAML",
        "toml": "TOML",
        "html": "HTML",
        "css": "CSS",
        "scss": "SCSS",
        "sh": "Shell",
        "bash": "Bash",
        "sql": "SQL",
        "graphql": "GraphQL",
        "gql": "GraphQL",
        "dockerfile": "Dockerfile",
        "makefile": "Makefile",
        "xml": "XML",
        "svg": "SVG",
        "txt": "Plain Text",
    }
    return ext_map.get(ext.lower(), ext.upper() if ext else "Unknown")


def categorize_file(ext: str, lang: str) -> str:
    """Categorize file as code, docs, or config."""
    code_exts = {"ts", "tsx", "js", "jsx", "py", "rs", "go", "css", "scss", "html", "sql", "graphql", "gql"}
    doc_exts = {"md", "mdx", "txt", "rst"}

    if ext.lower() in code_exts:
        return "code"
    elif ext.lower() in doc_exts:
        return "docs"
    else:
        return "config"


def analyze_codebase():
    """Analyze the codebase using pygount."""
    print(f"Analyzing codebase at {PROJECT_ROOT}...")

    # Get git tracked files if in a git repo (respects .gitignore)
    use_git = is_git_repo(PROJECT_ROOT)
    git_files = get_git_tracked_files(PROJECT_ROOT) if use_git else set()

    if use_git:
        print(f"Using git ls-files ({len(git_files)} tracked files, respecting .gitignore)")
    else:
        print("Not a git repository, scanning all files")

    # Data structures
    lang_stats = defaultdict(lambda: {"lines": 0, "files": 0})
    module_stats = defaultdict(lambda: {"lines": 0, "files": 0})
    desktop_dir_stats = defaultdict(lambda: {"lines": 0, "files": 0})
    app_stats = defaultdict(lambda: {"lines": 0, "files": 0})
    category_stats = {"code": 0, "docs": 0, "config": 0}
    all_files = []

    total_lines = 0
    total_files = 0

    # Walk through all files
    for root, dirs, files in os.walk(PROJECT_ROOT):
        # Filter out excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        for filename in files:
            filepath = Path(root) / filename
            rel_path = filepath.relative_to(PROJECT_ROOT)

            # Skip if using git and file is not tracked
            if use_git and str(rel_path) not in git_files:
                continue

            if should_exclude(rel_path):
                continue

            ext = get_extension(filename)
            if not ext:
                continue

            # Count lines
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = sum(1 for _ in f)
            except Exception:
                continue

            if lines == 0:
                continue

            lang = get_language_from_ext(ext)
            module = get_module_name(rel_path)
            desktop_dir = get_desktop_dir(rel_path)
            category = categorize_file(ext, lang)

            # Update stats
            lang_stats[lang]["lines"] += lines
            lang_stats[lang]["files"] += 1
            lang_stats[lang]["ext"] = ext

            if module:
                module_stats[module]["lines"] += lines
                module_stats[module]["files"] += 1

                # App stats (apps/* only)
                if module.startswith("apps/"):
                    app_name = module.split("/")[1]
                    app_stats[app_name]["lines"] += lines
                    app_stats[app_name]["files"] += 1

            if desktop_dir:
                desktop_dir_stats[desktop_dir]["lines"] += lines
                desktop_dir_stats[desktop_dir]["files"] += 1

            category_stats[category] += lines

            all_files.append({
                "path": str(rel_path),
                "lines": lines,
                "ext": ext,
                "lang": lang,
            })

            total_lines += lines
            total_files += 1

    # Sort and prepare output
    languages = sorted(
        [
            {
                "lang": lang,
                "ext": data.get("ext", lang.lower()[:3]),
                "lines": data["lines"],
                "files": data["files"],
                "color": LANG_COLORS.get(lang, "#6B7280"),
            }
            for lang, data in lang_stats.items()
        ],
        key=lambda x: x["lines"],
        reverse=True,
    )[:15]  # Top 15 languages

    modules = sorted(
        [
            {
                "name": name,
                "lines": data["lines"],
                "files": data["files"],
                "color": MODULE_COLORS.get(name, "#6B7280"),
            }
            for name, data in module_stats.items()
        ],
        key=lambda x: x["lines"],
        reverse=True,
    )

    desktop_dirs = sorted(
        [
            {
                "name": name,
                "lines": data["lines"],
                "files": data["files"],
                "color": DESKTOP_DIR_COLORS.get(name, "#6B7280"),
            }
            for name, data in desktop_dir_stats.items()
        ],
        key=lambda x: x["lines"],
        reverse=True,
    )[:10]  # Top 10 directories

    apps = sorted(
        [
            {
                "name": name,
                "lines": data["lines"],
                "files": data["files"],
                "color": MODULE_COLORS.get(f"apps/{name}", "#6B7280"),
            }
            for name, data in app_stats.items()
        ],
        key=lambda x: x["lines"],
        reverse=True,
    )

    top_files = sorted(all_files, key=lambda x: x["lines"], reverse=True)[:20]

    # Calculate density (avg lines per file) for each module
    density = [
        {
            "name": m["name"].replace("apps/", "").replace("packages/", "pkg/").replace("backend/", "be/"),
            "density": round(m["lines"] / m["files"], 1) if m["files"] > 0 else 0,
            "color": m["color"],
        }
        for m in modules
        if m["files"] > 10  # Only modules with significant files
    ]

    result = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "totalLines": total_lines,
            "totalFiles": total_files,
            "totalModules": len(module_stats),
            "codeLines": category_stats["code"],
            "docLines": category_stats["docs"],
            "configLines": category_stats["config"],
        },
        "languages": languages,
        "modules": modules,
        "desktopDirs": desktop_dirs,
        "apps": apps,
        "density": density,
        "categories": [
            {"label": "源代码", "lines": category_stats["code"], "color": "#3B82F6"},
            {"label": "文档", "lines": category_stats["docs"], "color": "#8B5CF6"},
            {"label": "配置", "lines": category_stats["config"], "color": "#F59E0B"},
        ],
        "topFiles": [
            {"path": f["path"], "lines": f["lines"], "ext": f["ext"]}
            for f in top_files
        ],
    }

    return result


def main():
    """Main entry point."""
    # Ensure output directory exists
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Analyze codebase
    stats = analyze_codebase()

    # Write output
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print(f"\nStatistics generated successfully!")
    print(f"  Output: {OUTPUT_PATH}")
    print(f"  Total lines: {stats['summary']['totalLines']:,}")
    print(f"  Total files: {stats['summary']['totalFiles']:,}")
    print(f"  Total modules: {stats['summary']['totalModules']}")


if __name__ == "__main__":
    main()
