#!/usr/bin/env python3
"""Generate examples index.html from Jinja2 template."""

import argparse
import json
import sys
from pathlib import Path

try:
    from jinja2 import Environment, FileSystemLoader
except ImportError:
    print("Installing jinja2...", file=sys.stderr)
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "jinja2", "-q"])
    from jinja2 import Environment, FileSystemLoader

EXAMPLE_META = {
    "presentation": {
        "icon": "M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm14 12v4m-6 0h12",
        "description": "Step-based presentation engine with animations and cinematic effects",
    },
    "chat": {
        "icon": "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
        "description": "Real-time chat interface with streaming support and message components",
    },
}

DEFAULT_ICON = "M13 10V3L4 14h7v7l9-11h-7z"


def main():
    parser = argparse.ArgumentParser(description="Generate examples index.html")
    parser.add_argument("--out-dir", required=True, help="Output directory containing example subdirs")
    parser.add_argument("--template-dir", default=None, help="Template directory (default: scripts/templates)")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    if not out_dir.exists():
        print(f"Error: Output directory {out_dir} does not exist", file=sys.stderr)
        sys.exit(1)

    template_dir = Path(args.template_dir) if args.template_dir else Path(__file__).parent / "templates"

    example_dirs = sorted([d for d in out_dir.iterdir() if d.is_dir()])

    examples = []
    for d in example_dirs:
        name = d.name
        meta = EXAMPLE_META.get(name, {})
        examples.append({
            "name": name,
            "icon": meta.get("icon", DEFAULT_ICON),
            "description": meta.get("description", f"Interactive demo for the {name} package"),
        })

    env = Environment(loader=FileSystemLoader(template_dir))
    template = env.get_template("examples-index.html.j2")

    html = template.render(examples=examples)

    index_file = out_dir / "index.html"
    index_file.write_text(html)
    print(f"Generated {index_file}")


if __name__ == "__main__":
    main()
