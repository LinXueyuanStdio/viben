# TaskCreateCreateRequestBody

## Example Usage

```typescript
import { TaskCreateCreateRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateCreateRequestBody = {
  workspacePath: "<value>",
  title: "<value>",
};
```

## Fields

| Field                                                 | Type                                                  | Required                                              | Description                                           |
| ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| `workspacePath`                                       | *string*                                              | :heavy_check_mark:                                    | Workspace path (required)                             |
| `title`                                               | *string*                                              | :heavy_check_mark:                                    | Task title (required)                                 |
| `slug`                                                | *string*                                              | :heavy_minus_sign:                                    | Task slug (auto-generated from title if not provided) |
| `branch`                                              | *string*                                              | :heavy_minus_sign:                                    | Custom branch name                                    |
| `assignee`                                            | *string*                                              | :heavy_minus_sign:                                    | Assignee developer name                               |
| `priority`                                            | *string*                                              | :heavy_minus_sign:                                    | Priority (urgent/high/medium/low/none)                |
| `description`                                         | *string*                                              | :heavy_minus_sign:                                    | Task description                                      |
| `agent`                                               | *string*                                              | :heavy_minus_sign:                                    | Associated agent ID                                   |
| `executor`                                            | *string*                                              | :heavy_minus_sign:                                    | Executor type                                         |
| `model`                                               | *string*                                              | :heavy_minus_sign:                                    | Model to use                                          |
| `start`                                               | *boolean*                                             | :heavy_minus_sign:                                    | Auto-start task after creation                        |
| `worktree`                                            | *boolean*                                             | :heavy_minus_sign:                                    | Run in git worktree                                   |