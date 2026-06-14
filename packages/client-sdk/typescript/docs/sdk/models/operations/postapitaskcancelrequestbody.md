# PostApiTaskCancelRequestBody

## Example Usage

```typescript
import { PostApiTaskCancelRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskCancelRequestBody = {
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                    | Type                                     | Required                                 | Description                              |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| `force`                                  | *boolean*                                | :heavy_minus_sign:                       | Force cancel even if task is in_progress |
| `reason`                                 | *string*                                 | :heavy_minus_sign:                       | Optional cancellation reason             |
| `taskId`                                 | *string*                                 | :heavy_check_mark:                       | Task ID or directory (required)          |
| `workspacePath`                          | *string*                                 | :heavy_check_mark:                       | Workspace path (required)                |