# Create Command

Create a new slash command for the Viben workflow.

## Steps

### 1. Determine Command Purpose

What should this command do?
- Is it for development workflow?
- Is it for debugging?
- Is it for documentation?

### 2. Create Command File

```bash
# Create in .claude/commands/viben/
touch .claude/commands/viben/<command-name>.md
```

### 3. Command Structure

```markdown
# Command Name

Brief description of what this command does.

## Steps

### 1. First Step

Description and code block.

### 2. Second Step

Description and code block.

---

## Notes

- Important reminders
- Related commands
```

### 4. Update Documentation

If needed, update `.viben/workflow.md` to reference the new command.

---

## Tips

- Keep commands focused and single-purpose
- Include clear step-by-step instructions
- Reference existing commands when appropriate
