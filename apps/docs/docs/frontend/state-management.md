---
sidebar_position: 12
title: "State Management"
description: "State management conventions and patterns used in the Viben frontend applications"
---

# State Management

How state is managed in Viben frontend applications.

---

## Overview

Viben Desktop uses **Zustand** for global state management and **React Query** for server state. The architecture follows a clear separation between local component state, global UI state, and server-synchronized state.

---

## State Categories

### Local State

Used for component-specific UI state that doesn't need to be shared:

```typescript
const [isOpen, setIsOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
```

### Global State (Zustand)

Used for application-wide UI state that needs to persist across route changes:

```typescript
// stores/workspace-store.ts
interface WorkspaceStore {
  activeWorkspaceId: string | null;
  setActiveWorkspace: (id: string) => void;
}
```

### Server State (React Query / Gateway Client)

Used for data fetched from the Gateway API:

```typescript
// Fetched via GatewayClient and managed by hooks
const { agents, loading, refresh } = useAgents({ workspacePath });
const { items, groupChats, executors } = useChatList({ workspacePath });
```

### URL State

Used for navigation and deep-linking:

```typescript
// Route parameters drive which workspace/agent/session is active
const { workspaceId, agentId, sessionId } = useParams();
```

---

## When to Use Global State

Promote state to global (Zustand store) when:

1. **Multiple components** need to read/write the same data
2. **Route changes** should not reset the state
3. **Background processes** need to update state that components observe
4. **User preferences** that persist across sessions

Do NOT use global state for:
- Data that only one component uses
- Server data (use React Query/hooks instead)
- Form state (keep in component or form library)

---

## Server State

Server data is cached and synchronized through the Gateway client hooks:

```typescript
// Example: useAgents hook
export function useAgents(options: UseAgentsOptions): UseAgentsReturn {
  // Fetches from GET /api/agent
  // Provides CRUD operations via POST/PATCH/DELETE
  // Auto-refreshes on mutations
}
```

**Key patterns**:
- Data is fetched on component mount
- Mutations trigger automatic refetch
- Loading and error states are exposed
- Stale data is shown while refetching

---

## Common Mistakes

1. **Storing server data in Zustand** - Use hooks that fetch from Gateway instead
2. **Over-globalizing state** - Keep state local unless it truly needs to be shared
3. **Not cleaning up subscriptions** - Always return cleanup functions from useEffect
4. **Mutating state directly** - Always use Zustand's `set` function or React's state setters
