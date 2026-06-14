# PostApiTaskUpdateRequestBody

## Example Usage

```typescript
import { PostApiTaskUpdateRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskUpdateRequestBody = {
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                  | Type                                   | Required                               | Description                            |
| -------------------------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------- |
| `agent`                                | *string*                               | :heavy_minus_sign:                     | Associated agent ID                    |
| `assignee`                             | *string*                               | :heavy_minus_sign:                     | Assignee developer name                |
| `baseBranch`                           | *string*                               | :heavy_minus_sign:                     | Base branch (PR target)                |
| `branch`                               | *string*                               | :heavy_minus_sign:                     | Git branch name                        |
| `description`                          | *string*                               | :heavy_minus_sign:                     | Task description                       |
| `executor`                             | *string*                               | :heavy_minus_sign:                     | Executor type                          |
| `model`                                | *string*                               | :heavy_minus_sign:                     | Model to use                           |
| `notes`                                | *string*                               | :heavy_minus_sign:                     | Task notes                             |
| `priority`                             | *string*                               | :heavy_minus_sign:                     | Priority (urgent/high/medium/low/none) |
| `taskId`                               | *string*                               | :heavy_check_mark:                     | Task ID or directory (required)        |
| `title`                                | *string*                               | :heavy_minus_sign:                     | Task title                             |
| `workspacePath`                        | *string*                               | :heavy_check_mark:                     | Workspace path (required)              |