# TaskCancelRequestBody

## Example Usage

```typescript
import { TaskCancelRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCancelRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                                    | Type                                     | Required                                 | Description                              |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| `workspacePath`                          | *string*                                 | :heavy_check_mark:                       | Workspace path (required)                |
| `taskId`                                 | *string*                                 | :heavy_check_mark:                       | Task ID or directory (required)          |
| `reason`                                 | *string*                                 | :heavy_minus_sign:                       | Optional cancellation reason             |
| `force`                                  | *boolean*                                | :heavy_minus_sign:                       | Force cancel even if task is in_progress |