# PostApiTaskCreateRequestBody

## Example Usage

```typescript
import { PostApiTaskCreateRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskCreateRequestBody = {
  title: "<value>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                                 | Type                                                  | Required                                              | Description                                           |
| ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| `agent`                                               | *string*                                              | :heavy_minus_sign:                                    | Associated agent ID                                   |
| `assignee`                                            | *string*                                              | :heavy_minus_sign:                                    | Assignee developer name                               |
| `branch`                                              | *string*                                              | :heavy_minus_sign:                                    | Custom branch name                                    |
| `description`                                         | *string*                                              | :heavy_minus_sign:                                    | Task description                                      |
| `executor`                                            | *string*                                              | :heavy_minus_sign:                                    | Executor type                                         |
| `model`                                               | *string*                                              | :heavy_minus_sign:                                    | Model to use                                          |
| `priority`                                            | *string*                                              | :heavy_minus_sign:                                    | Priority (urgent/high/medium/low/none)                |
| `slug`                                                | *string*                                              | :heavy_minus_sign:                                    | Task slug (auto-generated from title if not provided) |
| `start`                                               | *boolean*                                             | :heavy_minus_sign:                                    | Auto-start task after creation                        |
| `title`                                               | *string*                                              | :heavy_check_mark:                                    | Task title (required)                                 |
| `workspacePath`                                       | *string*                                              | :heavy_check_mark:                                    | Workspace path (required)                             |
| `worktree`                                            | *boolean*                                             | :heavy_minus_sign:                                    | Run in git worktree                                   |