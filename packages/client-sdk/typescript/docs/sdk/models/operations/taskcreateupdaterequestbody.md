# TaskCreateUpdateRequestBody

## Example Usage

```typescript
import { TaskCreateUpdateRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateUpdateRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                                  | Type                                   | Required                               | Description                            |
| -------------------------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------- |
| `workspacePath`                        | *string*                               | :heavy_check_mark:                     | Workspace path (required)              |
| `taskId`                               | *string*                               | :heavy_check_mark:                     | Task ID or directory (required)        |
| `title`                                | *string*                               | :heavy_minus_sign:                     | Task title                             |
| `description`                          | *string*                               | :heavy_minus_sign:                     | Task description                       |
| `agent`                                | *string*                               | :heavy_minus_sign:                     | Associated agent ID                    |
| `executor`                             | *string*                               | :heavy_minus_sign:                     | Executor type                          |
| `model`                                | *string*                               | :heavy_minus_sign:                     | Model to use                           |
| `priority`                             | *string*                               | :heavy_minus_sign:                     | Priority (urgent/high/medium/low/none) |
| `branch`                               | *string*                               | :heavy_minus_sign:                     | Git branch name                        |
| `baseBranch`                           | *string*                               | :heavy_minus_sign:                     | Base branch (PR target)                |
| `assignee`                             | *string*                               | :heavy_minus_sign:                     | Assignee developer name                |
| `notes`                                | *string*                               | :heavy_minus_sign:                     | Task notes                             |