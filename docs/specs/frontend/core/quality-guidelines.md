# Frontend Quality Guidelines

> Code standards, forbidden patterns, and quality requirements for Viben frontend.

## Overview

This document defines the quality standards for Viben frontend code, including linting rules, forbidden patterns, performance requirements, accessibility standards, and testing guidelines.

---

## Linting

### ESLint Configuration

The project uses ESLint with the following key configurations:

```javascript
// eslint.config.mjs
export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
```

### Running Linting

```bash
# Check for lint errors
pnpm lint

# Fix auto-fixable issues
pnpm lint:fix
```

---

## Forbidden Patterns

### TypeScript

| Pattern | Reason | Alternative |
|---------|--------|-------------|
| `any` type | Type safety | Use `unknown` or specific types |
| `@ts-ignore` | Suppresses errors | Fix the type issue or use `@ts-expect-error` with comment |
| Type assertions `as X` | Bypasses checking | Use type guards or refine types |
| Non-null assertions `!` | Runtime risk | Use optional chaining or null checks |

```typescript
// Bad
const data = response as any;
// @ts-ignore
processData(unknownValue);
element!.focus();

// Good
const data: ApiResponse = response;
// @ts-expect-error - Legacy API returns untyped data, tracked in VIBEN-123
processData(unknownValue as unknown);
element?.focus();
```

### React

| Pattern | Reason | Alternative |
|---------|--------|-------------|
| Inline object/array creation in JSX | Re-renders | useMemo or constants |
| Index as key | Poor reconciliation | Unique IDs |
| Direct DOM manipulation | Breaks React model | useRef with state |
| Nested ternaries in JSX | Readability | Early returns or variables |

```tsx
// Bad
<List items={items.filter(x => x.active)} />
{items.map((item, index) => <Item key={index} />)}
{a ? (b ? <X /> : <Y />) : <Z />}

// Good
const activeItems = useMemo(() => items.filter(x => x.active), [items]);
<List items={activeItems} />
{items.map((item) => <Item key={item.id} />)}

// Readable conditional
const renderContent = () => {
  if (!a) return <Z />;
  if (b) return <X />;
  return <Y />;
};
```

### State Management

| Pattern | Reason | Alternative |
|---------|--------|-------------|
| Prop drilling (> 2 levels) | Maintainability | Context or Zustand |
| State in URL for UI state | URL pollution | Local state |
| Sync state with useEffect | Race conditions | Derived state |

```tsx
// Bad - syncing state
useEffect(() => {
  setFilteredItems(items.filter(x => x.matches(search)));
}, [items, search]);

// Good - derived state
const filteredItems = useMemo(
  () => items.filter(x => x.matches(search)),
  [items, search]
);
```

---

## Performance Requirements

### Bundle Size

| Metric | Limit | How to Check |
|--------|-------|--------------|
| Initial JS | < 300KB gzipped | `pnpm build && pnpm analyze` |
| Per-route chunk | < 100KB gzipped | Check build output |
| No duplicate deps | 0 | `pnpm dedupe` |

### Runtime Performance

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.8s |
| Time to Interactive | < 3.9s |
| Cumulative Layout Shift | < 0.1 |
| Largest Contentful Paint | < 2.5s |

### Code-level Performance

```typescript
// Virtualize long lists
import { useVirtualizer } from "@tanstack/react-virtual";

function LargeList({ items }: { items: Item[] }) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });

  return (
    <div ref={parentRef} style={{ height: 400, overflow: "auto" }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: "absolute",
              top: virtualItem.start,
            }}
          >
            {items[virtualItem.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Image Optimization

```tsx
// Use Next.js Image for automatic optimization
import Image from "next/image";

<Image
  src="/hero.png"
  alt="Hero image"
  width={800}
  height={400}
  priority // For above-the-fold images
  placeholder="blur"
/>
```

---

## Accessibility Standards

### WCAG 2.1 AA Compliance

All components must meet WCAG 2.1 Level AA standards.

### Keyboard Navigation

```tsx
// All interactive elements must be keyboard accessible
function MenuItem({ onClick, children }: Props) {
  return (
    <button
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick();
        }
      }}
      tabIndex={0}
      role="menuitem"
    >
      {children}
    </button>
  );
}
```

### ARIA Requirements

```tsx
// Provide proper ARIA attributes
function Modal({ isOpen, onClose, title, children }: Props) {
  return (
    <dialog
      open={isOpen}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      aria-modal="true"
      role="dialog"
    >
      <h2 id="modal-title">{title}</h2>
      <div id="modal-description">{children}</div>
      <button onClick={onClose} aria-label="Close modal">
        X
      </button>
    </dialog>
  );
}
```

### Color Contrast

- Text contrast ratio: >= 4.5:1 for normal text
- Large text contrast ratio: >= 3:1
- Use design system tokens which are pre-validated

### Screen Reader Support

```tsx
// Live regions for dynamic content
function Notification({ message }: { message: string }) {
  return (
    <div role="alert" aria-live="polite">
      {message}
    </div>
  );
}

// Visually hidden text for screen readers
function IconButton({ icon, label, onClick }: Props) {
  return (
    <button onClick={onClick} aria-label={label}>
      <Icon name={icon} aria-hidden="true" />
    </button>
  );
}
```

---

## Testing Requirements

### Coverage Targets

| Type | Target Coverage |
|------|----------------|
| Unit tests | 80% statements |
| Integration tests | Critical paths |
| E2E tests | Happy paths + error cases |

### Unit Testing

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("TaskCard", () => {
  it("displays task title and status", () => {
    render(<TaskCard task={mockTask} />);

    expect(screen.getByText(mockTask.title)).toBeInTheDocument();
    expect(screen.getByText(mockTask.status)).toBeInTheDocument();
  });

  it("calls onStatusChange when status is updated", async () => {
    const onStatusChange = vi.fn();
    render(<TaskCard task={mockTask} onStatusChange={onStatusChange} />);

    await userEvent.click(screen.getByRole("button", { name: /change status/i }));
    await userEvent.click(screen.getByRole("option", { name: /completed/i }));

    expect(onStatusChange).toHaveBeenCalledWith(mockTask.id, "completed");
  });
});
```

### Hook Testing

```typescript
import { renderHook, waitFor } from "@testing-library/react";

describe("useTask", () => {
  it("fetches and returns task data", async () => {
    const { result } = renderHook(() => useTask("task-123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.task).toEqual(expect.objectContaining({
      id: "task-123",
    }));
  });

  it("handles error state", async () => {
    server.use(
      rest.get("/api/task/:id", (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );

    const { result } = renderHook(() => useTask("task-123"));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
```

### E2E Testing

```typescript
import { test, expect } from "@playwright/test";

test("user can create and complete a task", async ({ page }) => {
  await page.goto("/tasks");

  // Create task
  await page.click('[data-testid="create-task-button"]');
  await page.fill('[data-testid="task-title-input"]', "New Task");
  await page.click('[data-testid="submit-task-button"]');

  // Verify created
  await expect(page.locator('text="New Task"')).toBeVisible();

  // Complete task
  await page.click('[data-testid="task-checkbox-New Task"]');
  await expect(page.locator('[data-testid="task-status-New Task"]'))
    .toHaveText("completed");
});
```

---

## Code Review Checklist

Before submitting a PR, verify:

- [ ] No TypeScript errors (`pnpm typecheck`)
- [ ] No lint errors (`pnpm lint`)
- [ ] Tests pass (`pnpm test`)
- [ ] No console.log statements
- [ ] No TODO/FIXME without issue reference
- [ ] Components have proper TypeScript types
- [ ] User-facing text is internationalized
- [ ] Interactive elements are keyboard accessible
- [ ] Loading and error states are handled
- [ ] No prop drilling beyond 2 levels

---

**Related:**
- [Component Guidelines](./components.md)
- [Hook Guidelines](./hook-guidelines.md)
- [Type Safety](./type-safety.md)
- [Design System](./design-system.md)
