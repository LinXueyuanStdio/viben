Generate or update project context index files.

This command creates markdown index files in `docs/index/` for AI agents and developers:
- `overview.md` - Project overview with tech stack and structure
- `code-index.md` - Code structure with packages, apps, and key files
- `docs-index.md` - Documentation index organized by category

## Usage

Run the CLI command:

```bash
# Generate index (static analysis only, fast)
viben index generate --no-ai

# Generate index with AI enhancement (slower, requires API)
viben index generate

# Specify custom output directory
viben index generate --output docs/my-index

# Show detailed logging
viben index generate --verbose
```

## When to Use

- After major codebase changes (new packages, apps, or docs)
- When onboarding new team members or AI agents
- To refresh context for AI-assisted development
- Before starting a new development session

## Output

The generated files provide:

1. **overview.md**: Tech stack, project structure tree, module dependencies, quick navigation
2. **code-index.md**: Package details, entry points, exports, key files by type
3. **docs-index.md**: All documentation organized by category with descriptions

These files are auto-generated and should not be manually edited.
