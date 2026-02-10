<!-- VIBEN:START -->
# Viben Instructions

This project uses Viben Agent Organization for AI-assisted development.

## Quick Start

```bash
# Get session context
./.viben/scripts/get-context.sh

# Read workflow
cat .viben/workflow.md
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `/viben:start` | Initialize session |
| `/viben:before-backend-dev` | Read backend guidelines |
| `/viben:before-frontend-dev` | Read frontend guidelines |
| `/viben:check-backend` | Verify backend code |
| `/viben:check-frontend` | Verify frontend code |
| `/viben:finish-work` | Pre-commit checklist |
| `/viben:record-session` | Record session |

## Guidelines Location

- **Workflow**: `.viben/workflow.md`
- **Backend specs**: `.viben/spec/backend/`
- **Frontend specs**: `.viben/spec/frontend/`
- **Thinking guides**: `.viben/spec/guides/`

## Important Rules

1. [!] **Read guidelines before coding**
2. [!] **AI should NOT execute git commit**
3. [OK] **Record sessions after work**

<!-- VIBEN:END -->
