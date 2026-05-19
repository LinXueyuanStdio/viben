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
import re
import subprocess
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

from pygount import SourceAnalysis, ProjectSummary
from pygount import common as pygount_common
from pygount.analysis import SourceScanner


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
    "code-stats.json",
}

# Patterns for low-information files to exclude from Top Files
TOP_FILES_EXCLUDE_PATTERNS = [
    "i18n/locales/",
    "i18n/translations/",
    "locales/",
]

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
    "packages/chat": "#8B5CF6",
    "packages/kanban": "#F97316",
    "packages/editor": "#14B8A6",
    "packages/os": "#6366F1",
    "packages/api-client": "#EF4444",
    "packages/presentation": "#A855F7",
    "packages/editor-components": "#0EA5E9",
    "infra/Yoopta-Editor": "#84CC16",
    "backend/browse-mcp": "#EF4444",
    "backend/plugins": "#F97316",
    "backend/wakeword": "#22D3EE",
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

# Code file extensions (for top files filtering)
CODE_EXTS = {"ts", "tsx", "js", "jsx", "py", "rs", "go", "css", "scss", "html", "sql", "graphql", "gql", "sh", "svelte", "vue"}

# Reverse mapping: language name -> primary file extension
LANG_TO_EXT = {
    "TypeScript": "ts",
    "TSX": "tsx",
    "JavaScript": "js",
    "JSX": "jsx",
    "Python": "py",
    "Rust": "rs",
    "Go": "go",
    "Markdown": "md",
    "JSON": "json",
    "YAML": "yaml",
    "TOML": "toml",
    "HTML": "html",
    "CSS": "css",
    "SCSS": "scss",
    "Shell": "sh",
    "Bash": "sh",
    "Batchfile": "bat",
    "SQL": "sql",
    "GraphQL": "graphql",
    "Dockerfile": "dockerfile",
    "Makefile": "makefile",
    "XML": "xml",
    "SVG": "svg",
    "Plain Text": "txt",
    "IPython": "py",
    "Text only": "txt",
    "HTML+Genshi": "html",
    "CSS+Lasso": "css",
    "JavaScript+Genshi Text": "js",
    "Transact-SQL": "sql",
}

# Normalize pygount's overly specific language names to simpler ones
LANG_NORMALIZE = {
    "IPython": "Python",
    "Text only": "Plain Text",
    "HTML+Genshi": "HTML",
    "CSS+Lasso": "CSS",
    "JavaScript+Genshi Text": "JavaScript",
    "Transact-SQL": "SQL",
    "JavaScript+Lasso": "JavaScript",
    "HTML+Django/Jinja": "HTML",
    "HTML+PHP": "HTML",
    "CSS+Django/Jinja": "CSS",
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


def is_top_file_excluded(path: str) -> bool:
    """Check if file should be excluded from Top Files list."""
    for pattern in TOP_FILES_EXCLUDE_PATTERNS:
        if pattern in path:
            return True
    return False


def metric_sort_key(item: dict, label_key: str = "name") -> tuple:
    """Sort metric rows by descending volume, then stable label tie-breakers."""
    volume = item.get("lines", item.get("files", item.get("count", item.get("changes", 0))))
    return (-volume, str(item.get(label_key, "")))


def generated_payload(stats: dict) -> dict:
    """Return stats without volatile generation metadata for idempotency checks."""
    return {key: value for key, value in stats.items() if key != "generatedAt"}


def get_git_tracked_files(root: Path) -> set[str]:
    """Get set of files tracked by git (respects .gitignore and submodules)."""
    try:
        result = subprocess.run(
            ["git", "ls-files"],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
        )
        tracked_files = set(result.stdout.strip().split("\n")) if result.stdout.strip() else set()

        for rel_path in sorted(tracked_files):
            nested_root = root / rel_path
            if not nested_root.is_dir() or not (nested_root / ".git").exists():
                continue
            nested_result = subprocess.run(
                ["git", "ls-files"],
                cwd=nested_root,
                capture_output=True,
                text=True,
                check=True,
            )
            if not nested_result.stdout.strip():
                continue
            tracked_files.update(
                f"{rel_path}/{nested_file}"
                for nested_file in nested_result.stdout.strip().split("\n")
                if nested_file
            )

        return tracked_files
    except (subprocess.CalledProcessError, FileNotFoundError):
        return set()


def is_git_repo(root: Path) -> bool:
    """Check if directory is a git repository."""
    return (root / ".git").exists()


def get_commit_activity(root: Path) -> list[dict]:
    """获取最近 365 天的每日提交次数"""
    try:
        since_date = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
        result = subprocess.run(
            ["git", "log", f"--since={since_date}", "--format=%ad", "--date=short"],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
        )

        commit_counts = defaultdict(int)
        if result.stdout.strip():
            for line in result.stdout.strip().split("\n"):
                if line:
                    commit_counts[line] += 1

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
    """统计最近 90 天文件变更频率（单次 git 调用同时获取计数和日期）"""
    try:
        since_date = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
        # Single git call: --format=%ad gives date per commit, --name-only gives files
        result = subprocess.run(
            ["git", "log", f"--since={since_date}", "--format=%ad", "--date=short", "--name-only"],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
        )

        change_counts: dict[str, int] = defaultdict(int)
        last_changed_map: dict[str, str] = {}
        current_date = ""

        for line in result.stdout.split("\n"):
            line = line.strip()
            if not line:
                continue
            # Date lines match YYYY-MM-DD format
            if len(line) == 10 and line[4] == '-' and line[7] == '-':
                current_date = line
            elif line in git_files and not should_exclude(Path(line)):
                change_counts[line] += 1
                # First occurrence = most recent date
                if line not in last_changed_map:
                    last_changed_map[line] = current_date

        top_churn = sorted(change_counts.items(), key=lambda x: (-x[1], x[0]))[:15]

        return [
            {"path": path, "changes": count, "lastChanged": last_changed_map.get(path, "")}
            for path, count in top_churn
        ]
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []


def get_code_freshness(root: Path, git_files: set, file_lines: dict[str, int] | None = None) -> list[dict]:
    """分析文件最后修改时间分布（批量获取，性能优化）

    Args:
        file_lines: optional pre-computed {rel_path: line_count} to avoid re-reading files
    """
    now = datetime.now(timezone.utc)

    buckets = {
        "<1月": {"files": 0, "lines": 0, "color": "#10B981", "max_days": 30},
        "1-3月": {"files": 0, "lines": 0, "color": "#3B82F6", "max_days": 90},
        "3-6月": {"files": 0, "lines": 0, "color": "#F59E0B", "max_days": 180},
        "6-12月": {"files": 0, "lines": 0, "color": "#F97316", "max_days": 365},
        ">1年": {"files": 0, "lines": 0, "color": "#EF4444", "max_days": float('inf')},
    }
    bucket_order = ["<1月", "1-3月", "3-6月", "6-12月", ">1年"]

    # Batch get last modification time — bounded to 400 days (covers all buckets)
    since_date = (datetime.now() - timedelta(days=400)).strftime("%Y-%m-%d")
    try:
        result = subprocess.run(
            ["git", "log", f"--since={since_date}", "--format=%at", "--name-only", "--diff-filter=ACMR"],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []

    # Parse: first occurrence of each file gives its latest modification timestamp
    file_timestamps: dict[str, int] = {}
    current_timestamp = None

    for line in result.stdout.split("\n"):
        line = line.strip()
        if not line:
            continue
        # Unix timestamps are 10-digit numbers; filenames with '/' or '.' won't match
        if line.isdigit() and len(line) == 10:
            current_timestamp = int(line)
        elif current_timestamp is not None and line in git_files:
            if line not in file_timestamps:
                file_timestamps[line] = current_timestamp

    # Process files with known timestamps
    for file_path, timestamp in sorted(file_timestamps.items()):
        if should_exclude(Path(file_path)):
            continue

        if file_lines and file_path in file_lines:
            lines = file_lines[file_path]
        else:
            full_path = root / file_path
            if not full_path.exists() or full_path.is_dir():
                continue
            ext = get_extension(file_path)
            if not ext:
                continue
            try:
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = sum(1 for _ in f)
            except Exception:
                continue

        mod_date = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        days_old = (now - mod_date).days

        for label in bucket_order:
            if days_old < buckets[label]["max_days"]:
                buckets[label]["files"] += 1
                buckets[label]["lines"] += lines
                break

    # Files not seen in bounded history are older than 400 days -> ">1年" bucket
    if file_lines:
        for file_path, lines in sorted(file_lines.items()):
            if file_path not in file_timestamps and not should_exclude(Path(file_path)):
                buckets[">1年"]["files"] += 1
                buckets[">1年"]["lines"] += lines

    return [
        {"label": label, "files": buckets[label]["files"], "lines": buckets[label]["lines"], "color": buckets[label]["color"]}
        for label in bucket_order
    ]


def get_file_size_distribution(all_files: list) -> list[dict]:
    """统计文件行数分布区间"""
    buckets = [
        {"range": "0-50", "files": 0, "color": "#10B981", "min": 0, "max": 50},
        {"range": "50-100", "files": 0, "color": "#3B82F6", "min": 50, "max": 100},
        {"range": "100-200", "files": 0, "color": "#F59E0B", "min": 100, "max": 200},
        {"range": "200-500", "files": 0, "color": "#F97316", "min": 200, "max": 500},
        {"range": "500+", "files": 0, "color": "#EF4444", "min": 500, "max": float('inf')},
    ]

    for file_info in sorted(all_files, key=lambda f: f["path"]):
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
        if part == "infra" and i + 1 < len(parts):
            return f"infra/{parts[i + 1]}"
    return None


def get_desktop_dir(path: Path) -> str | None:
    """Extract desktop app directory name."""
    parts = path.parts
    try:
        desktop_idx = parts.index("desktop")
        if desktop_idx + 2 < len(parts) and parts[desktop_idx + 1] == "src":
            return parts[desktop_idx + 2]
    except (ValueError, IndexError):
        pass
    return None


DOC_EXTS = {"md", "mdx", "txt", "rst"}


def categorize_file(ext: str) -> str:
    """Categorize file as code, docs, or config."""
    if ext.lower() in CODE_EXTS:
        return "code"
    elif ext.lower() in DOC_EXTS:
        return "docs"
    else:
        return "config"


def get_architecture(root: Path, module_stats: dict) -> dict:
    """Generate architecture dependency graph from workspace package.json files."""
    # Collect all workspace package names -> module mapping
    workspace_packages: dict[str, str] = {}  # package_name -> module_id

    # Scan all workspace modules (package.json for JS, pyproject.toml for Python)
    module_dirs = []
    for prefix in ["apps", "packages", "backend"]:
        prefix_dir = root / prefix
        if prefix_dir.exists():
            for d in sorted(prefix_dir.iterdir(), key=lambda path: path.name):
                if d.is_dir() and ((d / "package.json").exists() or (d / "pyproject.toml").exists()):
                    module_dirs.append((f"{prefix}/{d.name}", d))

    # Also include infra/Yoopta-Editor
    yoopta_dir = root / "infra" / "Yoopta-Editor"
    if yoopta_dir.exists() and (yoopta_dir / "packages").exists():
        module_dirs.append(("infra/Yoopta-Editor", yoopta_dir))

    # Map package names to module IDs
    for module_id, module_dir in sorted(module_dirs):
        pkg_json = module_dir / "package.json"
        pyproject = module_dir / "pyproject.toml"
        if pkg_json.exists():
            try:
                with open(pkg_json, 'r') as f:
                    pkg = json.load(f)
                name = pkg.get("name", "")
                if name:
                    workspace_packages[name] = module_id
            except (json.JSONDecodeError, OSError):
                pass
        elif pyproject.exists():
            # Python project - extract name from [project] section of pyproject.toml
            try:
                with open(pyproject, 'r') as f:
                    content = f.read()
                in_project_section = False
                for line in content.split("\n"):
                    stripped = line.strip()
                    if stripped == "[project]":
                        in_project_section = True
                        continue
                    if stripped.startswith("[") and stripped != "[project]":
                        if in_project_section:
                            break  # Left [project] section
                        continue
                    if in_project_section and re.match(r'^name\s*=', stripped):
                        value = stripped.split("=", 1)[1].strip().strip('"').strip("'")
                        if value:
                            workspace_packages[value] = module_id
                        break
            except OSError:
                pass

    # Determine layer for each module
    def get_layer(module_id: str) -> str:
        if module_id.startswith("apps/"):
            return "apps"
        elif module_id.startswith("packages/"):
            return "packages"
        elif module_id.startswith("infra/"):
            return "infra"
        elif module_id.startswith("backend/"):
            return "backend"
        return "other"

    # Build nodes
    nodes = []
    for module_id, module_dir in sorted(module_dirs):
        stats = module_stats.get(module_id, {"lines": 0, "files": 0})
        if stats["lines"] == 0 and stats["files"] == 0:
            continue  # Skip empty modules
        label = module_id.split("/")[-1].replace("-", " ").title()
        # Shorten known labels
        label_map = {
            "apps/desktop": "Desktop",
            "apps/web": "Web",
            "apps/cli": "CLI",
            "apps/docs": "Docs",
            "packages/core": "Core",
            "packages/ui": "UI",
            "packages/chat": "Chat",
            "packages/kanban": "Kanban",
            "packages/editor": "Editor",
            "packages/os": "OS",
            "packages/api-client": "API Client",
            "packages/presentation": "Presentation",
            "packages/editor-components": "Editor Comp",
            "infra/Yoopta-Editor": "Yoopta Editor",
            "backend/browse-mcp": "Browse MCP",
            "backend/plugins": "Plugins",
            "backend/wakeword": "Wakeword",
        }
        nodes.append({
            "id": module_id,
            "label": label_map.get(module_id, label),
            "lines": stats["lines"],
            "files": stats["files"],
            "color": MODULE_COLORS.get(module_id, "#6B7280"),
            "layer": get_layer(module_id),
        })

    # Build edges by scanning dependencies
    edges = []
    edge_set: set[tuple[str, str]] = set()
    node_ids = {n["id"] for n in nodes}

    for module_id, module_dir in sorted(module_dirs):
        if module_id not in node_ids:
            continue
        pkg_json = module_dir / "package.json"
        if not pkg_json.exists():
            continue
        try:
            with open(pkg_json, 'r') as f:
                pkg = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue

        # Check dependencies, devDependencies, peerDependencies
        all_deps = {}
        for dep_key in ["dependencies", "devDependencies", "peerDependencies"]:
            all_deps.update(pkg.get(dep_key, {}))

        for dep_name in sorted(all_deps):
            # Only workspace references (workspace:* or packages we know)
            if dep_name in workspace_packages:
                target = workspace_packages[dep_name]
                if target in node_ids and target != module_id:
                    key = (module_id, target)
                    if key not in edge_set:
                        edge_set.add(key)
                        edges.append({"from": module_id, "to": target})

    return {
        "nodes": sorted(nodes, key=lambda node: (node["layer"], node["id"])),
        "edges": sorted(edges, key=lambda edge: (edge["from"], edge["to"])),
        "layers": ["apps", "packages", "infra", "backend"],
    }


def analyze_codebase():
    """Analyze the codebase using pygount SourceScanner + ProjectSummary."""
    print(f"Analyzing codebase at {PROJECT_ROOT}...")

    use_git = is_git_repo(PROJECT_ROOT)
    git_files = get_git_tracked_files(PROJECT_ROOT) if use_git else set()

    if use_git:
        print(f"Using git ls-files ({len(git_files)} tracked files, respecting .gitignore)")
    else:
        print("Not a git repository, scanning all files")

    # SourceScanner for file discovery (handles folder/name skipping)
    # Add $ anchor so "dist" doesn't match "distribute", etc.
    folders_skip = "|".join(re.escape(d) + "$" for d in EXCLUDE_DIRS)
    files_skip = "|".join(re.escape(f) + "$" for f in EXCLUDE_FILES)
    scanner = SourceScanner(
        [str(PROJECT_ROOT)],
        suffixes="*",
        folders_to_skip=pygount_common.regexes_from(f"[{folders_skip}]"),
        name_to_skip=pygount_common.regexes_from(f"[{files_skip}]"),
    )

    # ProjectSummary for global code/doc/empty aggregation
    summary = ProjectSummary()

    # Custom grouping structures
    lang_stats = defaultdict(lambda: {"lines": 0, "files": 0})
    module_stats = defaultdict(lambda: {"lines": 0, "files": 0})
    desktop_dir_stats = defaultdict(lambda: {"lines": 0, "files": 0})
    app_stats = defaultdict(lambda: {"lines": 0, "files": 0})
    category_stats = {"code": 0, "docs": 0, "config": 0}
    all_files = []

    print("Scanning files with pygount...")
    for path_data in scanner.source_paths():
        filepath = Path(path_data.source_path)
        try:
            rel_path = filepath.relative_to(PROJECT_ROOT)
        except ValueError:
            continue

        # Respect .gitignore via git ls-files
        if use_git and str(rel_path) not in git_files:
            continue

        ext = get_extension(filepath.name)
        if not ext:
            continue

        # Use pygount for accurate line analysis
        analysis = SourceAnalysis.from_file(
            str(filepath), group=path_data.group, encoding='utf-8'
        )
        if analysis.language in ('__error__', '__binary__', '__empty__'):
            continue

        lines = analysis.code_count + analysis.documentation_count + analysis.empty_count
        if lines == 0:
            continue

        # Feed into ProjectSummary for global stats
        summary.add(analysis)

        # Normalize pygount's overly specific language names
        raw_lang = analysis.language
        lang = LANG_NORMALIZE.get(raw_lang, raw_lang)
        module = get_module_name(rel_path)
        desktop_dir = get_desktop_dir(rel_path)
        category = categorize_file(ext)

        lang_stats[lang]["lines"] += lines
        lang_stats[lang]["files"] += 1

        if module:
            module_stats[module]["lines"] += lines
            module_stats[module]["files"] += 1

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
            "category": category,
        })

    # Language breakdown (using normalized names)
    languages = sorted(
        [
            {
                "lang": lang,
                "ext": LANG_TO_EXT.get(lang, lang.lower()),
                "lines": data["lines"],
                "files": data["files"],
                "color": LANG_COLORS.get(lang, "#6B7280"),
            }
            for lang, data in lang_stats.items()
        ],
        key=lambda x: (-x["lines"], x["lang"], x["ext"]),
    )[:15]

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
        key=metric_sort_key,
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
        key=metric_sort_key,
    )[:10]

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
        key=metric_sort_key,
    )

    # Top files: only code files, exclude translation/low-info files
    code_files = [
        f for f in all_files
        if f["ext"] in CODE_EXTS and not is_top_file_excluded(f["path"])
    ]
    top_files = sorted(code_files, key=lambda x: (-x["lines"], x["path"], x["ext"]))[:20]

    # Calculate density
    density = [
        {
            "name": m["name"],
            "density": round(m["lines"] / m["files"], 1) if m["files"] > 0 else 0,
            "color": m["color"],
        }
        for m in modules
        if m["files"] > 10
    ]
    density = sorted(density, key=lambda item: (-item["density"], item["name"]))

    # Git-based statistics
    print("Analyzing commit activity...")
    commit_activity = get_commit_activity(PROJECT_ROOT) if use_git else []

    print("Analyzing file churn...")
    file_churn = get_file_churn(PROJECT_ROOT, git_files) if use_git else []

    print("Analyzing code freshness...")
    # Build pre-computed line counts to avoid re-reading files
    file_lines = {f["path"]: f["lines"] for f in all_files}
    code_freshness = get_code_freshness(PROJECT_ROOT, git_files, file_lines) if use_git else []

    print("Analyzing file size distribution...")
    file_size_distribution = get_file_size_distribution(all_files)

    # Architecture dependency graph
    print("Analyzing architecture dependencies...")
    architecture = get_architecture(PROJECT_ROOT, dict(module_stats))

    total_lines = category_stats["code"] + category_stats["docs"] + category_stats["config"]

    result = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "totalLines": total_lines,
            "totalFiles": len(all_files),
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
        "commitActivity": commit_activity,
        "fileChurn": file_churn,
        "codeFreshness": code_freshness,
        "fileSizeDistribution": file_size_distribution,
        "architecture": architecture,
    }

    return result


def main():
    """Main entry point."""
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    stats = analyze_codebase()
    if OUTPUT_PATH.exists():
        try:
            with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
                previous_stats = json.load(f)
            if generated_payload(previous_stats) == generated_payload(stats):
                stats["generatedAt"] = previous_stats.get("generatedAt", stats["generatedAt"])
        except (json.JSONDecodeError, OSError):
            pass

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print(f"\nStatistics generated successfully!")
    print(f"  Output: {OUTPUT_PATH}")
    print(f"  Total lines: {stats['summary']['totalLines']:,}")
    print(f"  Total files: {stats['summary']['totalFiles']:,}")
    print(f"  Total modules: {stats['summary']['totalModules']}")
    print(f"  Architecture nodes: {len(stats['architecture']['nodes'])}")
    print(f"  Architecture edges: {len(stats['architecture']['edges'])}")


if __name__ == "__main__":
    main()
