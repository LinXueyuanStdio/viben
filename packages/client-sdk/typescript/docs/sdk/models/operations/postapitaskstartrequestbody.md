# PostApiTaskStartRequestBody

## Example Usage

```typescript
import { PostApiTaskStartRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskStartRequestBody = {
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                              | Type                               | Required                           | Description                        |
| ---------------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| `taskId`                           | *string*                           | :heavy_check_mark:                 | Task ID or directory (required)    |
| `triggerExecution`                 | *boolean*                          | :heavy_minus_sign:                 | Trigger TaskQueueManager execution |
| `workspacePath`                    | *string*                           | :heavy_check_mark:                 | Workspace path (required)          |