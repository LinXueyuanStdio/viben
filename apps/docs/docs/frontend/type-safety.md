---
sidebar_position: 9
title: "Type Safety"
description: "TypeScript patterns and type definitions for Viben frontend"
---

# Type Safety Guidelines

> TypeScript patterns and type definitions for Viben frontend.

## Overview

This document covers TypeScript type definition patterns, Zod schema usage, API type generation, generic component patterns, and type narrowing best practices.

---

## Type Definition Patterns

### Interface vs Type

```typescript
// Use interface for object shapes that may be extended
interface Task {
  id: string;
  title: string;
  status: TaskStatus;
}

interface TaskWithDetails extends Task {
  description: string;
  assignee: User;
}

// Use type for unions, intersections, and computed types
type TaskStatus = "backlog" | "in_progress" | "completed";
type TaskAction = "create" | "update" | "delete";
type PartialTask = Partial<Task>;
type TaskKeys = keyof Task;
```

### Discriminated Unions

```typescript
// Use discriminated unions for state machines
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

function renderState<T>(state: AsyncState<T>) {
  switch (state.status) {
    case "idle":
      return <Idle />;
    case "loading":
      return <Spinner />;
    case "success":
      return <Data data={state.data} />; // TypeScript knows data exists
    case "error":
      return <Error error={state.error} />;
  }
}
```

### Branded Types

```typescript
// Use branded types for type-safe IDs
type TaskId = string & { readonly __brand: "TaskId" };
type UserId = string & { readonly __brand: "UserId" };

function createTaskId(id: string): TaskId {
  return id as TaskId;
}

function getTask(id: TaskId): Task {
  // Can only be called with TaskId, not any string
}

// Error: Argument of type 'string' is not assignable to parameter of type 'TaskId'
getTask("some-string");

// OK
getTask(createTaskId("task-123"));
```

---

## Schema Validation (Zod)

### Basic Schemas

```typescript
import { z } from "zod";

// Define schema
const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  status: z.enum(["backlog", "in_progress", "completed"]),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  createdAt: z.coerce.date(),
});

// Infer type from schema
type Task = z.infer<typeof TaskSchema>;

// Validate data
const result = TaskSchema.safeParse(data);
if (result.success) {
  // result.data is typed as Task
  console.log(result.data.title);
} else {
  // result.error contains validation errors
  console.error(result.error.issues);
}
```

### Form Validation

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const CreateTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
});

type CreateTaskForm = z.infer<typeof CreateTaskSchema>;

function CreateTaskForm() {
  const form = useForm<CreateTaskForm>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      title: "",
      priority: "P2",
    },
  });

  const onSubmit = (data: CreateTaskForm) => {
    // data is fully typed and validated
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register("title")} />
      {form.formState.errors.title && (
        <span>{form.formState.errors.title.message}</span>
      )}
      {/* ... */}
    </form>
  );
}
```

### API Response Validation

```typescript
const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema,
    error: z.string().optional(),
  });

const TaskListResponseSchema = ApiResponseSchema(z.array(TaskSchema));

async function fetchTasks(): Promise<Task[]> {
  const response = await fetch("/api/tasks");
  const json = await response.json();

  const result = TaskListResponseSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`Invalid API response: ${result.error.message}`);
  }

  return result.data.data;
}
```

---

## API Type Generation

### Gateway Client Types

```typescript
// packages/core/src/gateway/client/types.ts
export interface GatewayClient {
  agent: {
    list(params: AgentListParams): Promise<AgentListResponse>;
    get(id: string): Promise<AgentGetResponse>;
    run(params: AgentRunParams): AsyncIterable<AgentEvent>;
  };
  task: {
    list(params: TaskListParams): Promise<TaskListResponse>;
    create(params: TaskCreateParams): Promise<TaskCreateResponse>;
    // ...
  };
}

// Request/Response types match API specs
interface AgentListParams {
  workspace_path: string;
  include_global?: boolean;
}

interface AgentListResponse {
  agents: Agent[];
  total: number;
}
```

### Hook Type Integration

```typescript
// hooks/useAgents.ts
import type { Agent, AgentListParams } from "@viben/core/gateway";

interface UseAgentsOptions extends Omit<AgentListParams, "workspace_path"> {
  enabled?: boolean;
}

interface UseAgentsReturn {
  agents: Agent[];
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
}

export function useAgents(
  workspacePath: string,
  options: UseAgentsOptions = {}
): UseAgentsReturn {
  // Implementation
}
```

---

## Generic Component Patterns

### Generic Props

```typescript
// Generic list component
interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  emptyState?: React.ReactNode;
}

function List<T>({
  items,
  renderItem,
  keyExtractor,
  emptyState,
}: ListProps<T>) {
  if (items.length === 0) {
    return emptyState ?? null;
  }

  return (
    <ul>
      {items.map((item, index) => (
        <li key={keyExtractor(item)}>{renderItem(item, index)}</li>
      ))}
    </ul>
  );
}

// Usage - T is inferred as Task
<List
  items={tasks}
  renderItem={(task) => <TaskCard task={task} />}
  keyExtractor={(task) => task.id}
/>
```

### Generic Select Component

```typescript
interface SelectOption<T> {
  value: T;
  label: string;
}

interface SelectProps<T> {
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
}

function Select<T extends string | number>({
  options,
  value,
  onChange,
  placeholder,
}: SelectProps<T>) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const option = options.find((o) => String(o.value) === e.target.value);
        if (option) onChange(option.value);
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
```

### Polymorphic Components

```typescript
type PolymorphicRef<C extends React.ElementType> =
  React.ComponentPropsWithRef<C>["ref"];

type PolymorphicProps<C extends React.ElementType, Props = {}> = Props &
  Omit<React.ComponentPropsWithoutRef<C>, keyof Props> & {
    as?: C;
    ref?: PolymorphicRef<C>;
  };

interface ButtonOwnProps {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
}

type ButtonProps<C extends React.ElementType = "button"> = PolymorphicProps<
  C,
  ButtonOwnProps
>;

function Button<C extends React.ElementType = "button">({
  as,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps<C>) {
  const Component = as || "button";
  return <Component className={`btn btn-${variant} btn-${size}`} {...props} />;
}

// Usage
<Button>Click me</Button>
<Button as="a" href="/link">Link Button</Button>
<Button as={Link} to="/page">Router Link</Button>
```

---

## Type Narrowing Best Practices

### Type Guards

```typescript
// Custom type guard
function isTask(value: unknown): value is Task {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "title" in value &&
    "status" in value
  );
}

// Usage
function processItem(item: unknown) {
  if (isTask(item)) {
    // item is narrowed to Task
    console.log(item.title);
  }
}

// Discriminated union type guard
function isSuccessResponse<T>(
  response: AsyncState<T>
): response is { status: "success"; data: T } {
  return response.status === "success";
}
```

### Assertion Functions

```typescript
function assertNonNull<T>(
  value: T,
  message = "Value is null or undefined"
): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

function processTask(task: Task | null) {
  assertNonNull(task, "Task must exist");
  // task is narrowed to Task
  console.log(task.title);
}
```

### `in` Operator Narrowing

```typescript
interface Dog {
  bark(): void;
}

interface Cat {
  meow(): void;
}

function makeSound(animal: Dog | Cat) {
  if ("bark" in animal) {
    animal.bark(); // animal is Dog
  } else {
    animal.meow(); // animal is Cat
  }
}
```

### Array Type Guards

```typescript
function isNonEmptyArray<T>(arr: T[]): arr is [T, ...T[]] {
  return arr.length > 0;
}

function processItems(items: Task[]) {
  if (isNonEmptyArray(items)) {
    // items[0] is guaranteed to exist
    console.log(items[0].title);
  }
}
```

### Exhaustiveness Checking

```typescript
type TaskStatus = "backlog" | "in_progress" | "completed";

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "backlog":
      return "Backlog";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    default:
      // If we add a new status and forget to handle it,
      // TypeScript will error here
      return assertNever(status);
  }
}
```

---

## Common Utility Types

```typescript
// Pick specific fields
type TaskSummary = Pick<Task, "id" | "title" | "status">;

// Omit specific fields
type TaskWithoutId = Omit<Task, "id">;

// Make all fields optional
type PartialTask = Partial<Task>;

// Make all fields required
type RequiredTask = Required<Task>;

// Make all fields readonly
type ReadonlyTask = Readonly<Task>;

// Extract types from arrays/promises
type TaskItem = Task[];
type SingleTask = TaskItem[number]; // Task

// Template literal types
type EventName = `on${Capitalize<TaskAction>}`; // "onCreate" | "onUpdate" | "onDelete"

// Conditional types
type IdType<T> = T extends { id: infer U } ? U : never;
type TaskIdType = IdType<Task>; // string
```

---

## Related

- [Component Guidelines](./components.md)
- [Hook Guidelines](./hook-guidelines.md)
- [Quality Guidelines](./quality-guidelines.md)
