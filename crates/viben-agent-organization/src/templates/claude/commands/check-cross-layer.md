# Cross-Layer Check

Check if your changes considered all dimensions.

---

## Steps

### 1. Identify Change Scope

```bash
git status
git diff --name-only
```

### 2. Select Applicable Checks

Based on change type:

**Cross-Layer Data Flow** (3+ layers):
- [ ] Read flow: Database -> Service -> API -> UI
- [ ] Write flow: UI -> API -> Service -> Database
- [ ] Types consistent across layers?

**Code Reuse** (constants/config):
- [ ] Search: How many places define this value?
- [ ] If 2+ places -> Extract to shared constant
- [ ] All usages updated?

**New Utility Functions**:
- [ ] Search for existing similar utilities
- [ ] If similar exists, extend instead?

---

## Common Issues

| Issue | Prevention |
|-------|------------|
| Changed one place, missed others | `grep` before changing |
| Type mismatch across layers | Use shared types |
| Similar utility exists | Search before creating |

---

## Output

Report:
1. Which dimensions apply
2. Check results
3. Issues found and fixes
