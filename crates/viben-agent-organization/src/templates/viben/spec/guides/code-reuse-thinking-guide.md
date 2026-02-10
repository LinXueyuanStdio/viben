# Code Reuse Thinking Guide

> A systematic approach to identifying and implementing code reuse.

---

## When to Use This Guide

Use this guide when:
- Creating a new utility function
- Modifying constants/config values
- Seeing similar code in multiple places
- About to copy-paste code

---

## Pre-Implementation Questions

### 1. Does It Already Exist?

Before creating new code:

```bash
# Search for similar utilities
grep -r "functionNamePattern" src/
```

### 2. Should It Be Shared?

| Criteria | Shared | Local |
|----------|--------|-------|
| Used in 2+ places | Yes | No |
| Domain-specific logic | No | Yes |
| Pure utility function | Yes | No |
| Component-specific | No | Yes |

### 3. Where Should It Live?

| Type | Location |
|------|----------|
| Generic utils | `src/utils/` or `lib/` |
| Domain logic | `src/services/domain/` |
| UI components | `src/components/shared/` |
| Constants | `src/constants/` |

---

## Extraction Checklist

When extracting shared code:

- [ ] Search for ALL usages first
- [ ] Create in appropriate shared location
- [ ] Update ALL existing usages
- [ ] Add documentation/comments
- [ ] Consider backward compatibility

---

## Common Mistakes

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Not searching first | Duplicate utilities | Always search before creating |
| Extracting too early | Over-engineering | Wait for 2+ usages |
| Incomplete update | Inconsistent behavior | grep after changes |

---

## After Extraction

- [ ] Run grep to verify no duplicates remain
- [ ] Update imports in all affected files
- [ ] Run tests to verify behavior
