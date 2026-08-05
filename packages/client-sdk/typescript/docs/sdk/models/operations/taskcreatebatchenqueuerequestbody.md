# TaskCreateBatchEnqueueRequestBody

## Example Usage

```typescript
import { TaskCreateBatchEnqueueRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateBatchEnqueueRequestBody = {
  workspacePath: "<value>",
  taskDirs: [],
};
```

## Fields

| Field                              | Type                               | Required                           | Description                        |
| ---------------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| `workspacePath`                    | *string*                           | :heavy_check_mark:                 | Workspace path (required)          |
| `taskDirs`                         | *string*[]                         | :heavy_check_mark:                 | Task directories or IDs to enqueue |
| `agentId`                          | *string*                           | :heavy_minus_sign:                 | Agent ID to use for all tasks      |