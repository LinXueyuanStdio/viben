---
sidebar_position: 7
title: "Hook Guidelines"
description: "Custom hooks and state management patterns for Viben frontend"
---

# Hook Guidelines

> Custom hooks and state management patterns for Viben frontend.

## Overview

This document covers custom hooks naming conventions, state management patterns, data fetching, and performance optimization guidelines.

## Naming Conventions

### Custom Hook Names

All custom hooks must start with `use` prefix:

```typescript
// Good
useAgentSession()
useWorkspaceData()
useTaskStatus()

// Bad
getAgentSession()
fetchWorkspaceData()
taskStatusHook()
```

### Naming Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| `use[Entity]` | Single entity state | `useAgent`, `useTask` |
| `use[Entity]List` | List of entities | `useAgentList`, `useTaskList` |
| `use[Entity][Action]` | Entity actions | `useAgentCreate`, `useTaskUpdate` |
| `use[Feature]` | Feature-specific | `useBackgroundTasks`, `useChatInput` |

---

## State Management

### Local State (useState)

Use for component-level state that doesn't need to be shared:

```typescript
// Simple toggle
const [isOpen, setIsOpen] = useState(false);

// Object state
const [formData, setFormData] = useState<FormData>({
  name: "",
  email: "",
});

// Derived state - prefer useMemo
const filteredItems = useMemo(
  () => items.filter((item) => item.active),
  [items]
);
```

### Complex State (useReducer)

Use for complex state logic with multiple related values:

```typescript
type State = {
  status: "idle" | "loading" | "success" | "error";
  data: Data | null;
  error: Error | null;
};

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: Data }
  | { type: "FETCH_ERROR"; error: Error };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, status: "loading", error: null };
    case "FETCH_SUCCESS":
      return { status: "success", data: action.payload, error: null };
    case "FETCH_ERROR":
      return { status: "error", data: null, error: action.error };
    default:
      return state;
  }
}

function useDataFetcher() {
  const [state, dispatch] = useReducer(reducer, {
    status: "idle",
    data: null,
    error: null,
  });
  // ...
}
```

### Global State (Zustand)

Use Zustand for global state that needs to be shared across components:

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkspaceStore {
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace) => void;
  clearWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      currentWorkspace: null,
      setCurrentWorkspace: (workspace) =>
        set({ currentWorkspace: workspace }),
      clearWorkspace: () => set({ currentWorkspace: null }),
    }),
    {
      name: "workspace-storage",
    }
  )
);

// Usage in component
function WorkspaceSelector() {
  const { currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();
  // ...
}
```

---

## Data Fetching

### SWR Patterns

Use SWR for data fetching with caching and revalidation:

```typescript
import useSWR from "swr";

// Basic fetching
function useAgents(workspacePath: string) {
  const { data, error, isLoading, mutate } = useSWR(
    workspacePath ? `/api/agent?workspace_path=${workspacePath}` : null,
    fetcher
  );

  return {
    agents: data?.agents ?? [],
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

// Conditional fetching
function useTask(taskId: string | undefined) {
  const { data, error } = useSWR(
    taskId ? `/api/task/${taskId}` : null, // null key skips fetching
    fetcher
  );
  return { task: data, isError: error };
}

// Mutation with optimistic update
function useUpdateTask() {
  const { mutate } = useSWRConfig();

  return async (taskId: string, updates: Partial<Task>) => {
    await mutate(
      `/api/task/${taskId}`,
      async (current: Task) => {
        const response = await fetch(`/api/task/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        return response.json();
      },
      {
        optimisticData: (current) => ({ ...current, ...updates }),
        rollbackOnError: true,
      }
    );
  };
}
```

### TanStack Query Patterns

For more complex query scenarios:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Query with type safety
function useAgent(agentId: string) {
  return useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => fetchAgent(agentId),
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutation with cache invalidation
function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
```

---

## Memoization Guidelines

### useMemo

Use for expensive computations:

```typescript
// Good - expensive filter/map operation
const filteredTasks = useMemo(() => {
  return tasks
    .filter((task) => task.status === selectedStatus)
    .map((task) => transformTask(task));
}, [tasks, selectedStatus]);

// Bad - simple reference, not needed
const config = useMemo(() => ({ key: "value" }), []);
// Better: just move outside component or use constant
const config = { key: "value" };
```

### useCallback

Use for callbacks passed to memoized children or dependencies:

```typescript
// Good - callback passed to memoized child
const handleClick = useCallback(
  (id: string) => {
    onSelect(id);
    track("item_selected", { id });
  },
  [onSelect]
);

// Good - callback in useEffect dependency
const fetchData = useCallback(async () => {
  const data = await api.get(endpoint);
  setData(data);
}, [endpoint]);

useEffect(() => {
  fetchData();
}, [fetchData]);

// Bad - simple handler not passed to children
const handleClick = useCallback(() => {
  setIsOpen(true);
}, []); // Just use regular function
```

### When NOT to Memoize

- Simple primitive operations
- Callbacks only used in event handlers
- State setters from useState
- When the component re-renders infrequently anyway

---

## Effect Hooks Best Practices

### useEffect Rules

```typescript
// 1. Always specify dependencies
useEffect(() => {
  document.title = `${count} items`;
}, [count]); // Explicit dependency

// 2. Clean up subscriptions
useEffect(() => {
  const subscription = eventSource.subscribe(handler);
  return () => subscription.unsubscribe();
}, [eventSource]);

// 3. Avoid object/array literals in dependencies
// Bad
useEffect(() => {
  fetchData({ page, limit });
}, [{ page, limit }]); // Creates new object every render!

// Good
useEffect(() => {
  fetchData({ page, limit });
}, [page, limit]);

// 4. Use refs for values that shouldn't trigger re-renders
const latestValue = useRef(value);
useEffect(() => {
  latestValue.current = value;
});
```

### useLayoutEffect

Use when you need to read layout and synchronously re-render:

```typescript
// Measuring DOM elements
useLayoutEffect(() => {
  const { height } = ref.current.getBoundingClientRect();
  setHeight(height);
}, []);
```

---

## Custom Hook Patterns

### Composing Hooks

```typescript
function useAgentWithTasks(agentId: string) {
  const agent = useAgent(agentId);
  const tasks = useAgentTasks(agentId);

  return {
    agent: agent.data,
    tasks: tasks.data,
    isLoading: agent.isLoading || tasks.isLoading,
    isError: agent.isError || tasks.isError,
  };
}
```

### Hook with Options

```typescript
interface UseTasksOptions {
  status?: TaskStatus;
  limit?: number;
  enabled?: boolean;
}

function useTasks(workspacePath: string, options: UseTasksOptions = {}) {
  const { status, limit = 50, enabled = true } = options;

  const params = new URLSearchParams({
    workspace_path: workspacePath,
    ...(status && { status }),
    limit: String(limit),
  });

  return useSWR(
    enabled ? `/api/tasks?${params}` : null,
    fetcher
  );
}
```

### Return Pattern

Always return a consistent shape:

```typescript
interface UseResourceResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | undefined;
  refresh: () => void;
}

function useResource<T>(url: string): UseResourceResult<T> {
  const { data, error, isLoading, mutate } = useSWR<T>(url, fetcher);

  return {
    data,
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}
```

---

## Related

- [Component Guidelines](./components.md)
- [Type Safety](./type-safety.md)
- [Design System](./design-system.md)
