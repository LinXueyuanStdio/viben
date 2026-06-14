# PostApiTaskBatchEnqueueRequestBody

## Example Usage

```typescript
import { PostApiTaskBatchEnqueueRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskBatchEnqueueRequestBody = {
  taskDirs: [
    "<value 1>",
    "<value 2>",
  ],
  workspacePath: "<value>",
};
```

## Fields

| Field                              | Type                               | Required                           | Description                        |
| ---------------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| `agentId`                          | *string*                           | :heavy_minus_sign:                 | Agent ID to use for all tasks      |
| `taskDirs`                         | *string*[]                         | :heavy_check_mark:                 | Task directories or IDs to enqueue |
| `workspacePath`                    | *string*                           | :heavy_check_mark:                 | Workspace path (required)          |