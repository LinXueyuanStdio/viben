# TaskCreateDeleteRequestBody

## Example Usage

```typescript
import { TaskCreateDeleteRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateDeleteRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                                    | Type                                     | Required                                 | Description                              |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| `workspacePath`                          | *string*                                 | :heavy_check_mark:                       | Workspace path (required)                |
| `taskId`                                 | *string*                                 | :heavy_check_mark:                       | Task ID or directory (required)          |
| `force`                                  | *boolean*                                | :heavy_minus_sign:                       | Force delete even if task is in progress |