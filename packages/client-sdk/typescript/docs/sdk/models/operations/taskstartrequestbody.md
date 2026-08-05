# TaskStartRequestBody

## Example Usage

```typescript
import { TaskStartRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskStartRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                              | Type                               | Required                           | Description                        |
| ---------------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| `workspacePath`                    | *string*                           | :heavy_check_mark:                 | Workspace path (required)          |
| `taskId`                           | *string*                           | :heavy_check_mark:                 | Task ID or directory (required)    |
| `triggerExecution`                 | *boolean*                          | :heavy_minus_sign:                 | Trigger TaskQueueManager execution |