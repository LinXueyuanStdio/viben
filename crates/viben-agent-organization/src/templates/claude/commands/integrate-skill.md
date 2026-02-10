# Integrate Skill

Integrate a new skill or pattern into the project's spec documentation.

## When to Use

- After learning a new pattern that works well
- After fixing a bug with a non-obvious solution
- After discovering a best practice

## Steps

### 1. Identify the Skill/Pattern

What did you learn? Categories:

- **Frontend Pattern**: Hook pattern, component pattern, state management
- **Backend Pattern**: API pattern, database pattern, error handling
- **Cross-Layer Pattern**: Data flow, integration pattern

### 2. Document the Pattern

Based on category, update the appropriate spec file:

**Frontend**:
```bash
# Open the relevant spec file
cat .viben/spec/frontend/index.md
# Find the most appropriate file to update
```

**Backend**:
```bash
# Open the relevant spec file
cat .viben/spec/backend/index.md
# Find the most appropriate file to update
```

### 3. Add Documentation

Include:
- **Problem**: What issue does this pattern solve?
- **Solution**: How does the pattern work?
- **Example**: Code example showing the pattern
- **When to Use**: Clear criteria for using this pattern

### 4. Verify Integration

```bash
# Ensure documentation is consistent
cat .viben/spec/<area>/index.md
```

---

## Example Format

```markdown
## Pattern Name

### Problem

Brief description of the problem this solves.

### Solution

How the pattern addresses the problem.

### Example

\`\`\`typescript
// Code example here
\`\`\`

### When to Use

- Condition 1
- Condition 2
```
