# PostApiTaskDeleteRequestBody

## Example Usage

```typescript
import { PostApiTaskDeleteRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskDeleteRequestBody = {
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                    | Type                                     | Required                                 | Description                              |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| `force`                                  | *boolean*                                | :heavy_minus_sign:                       | Force delete even if task is in progress |
| `taskId`                                 | *string*                                 | :heavy_check_mark:                       | Task ID or directory (required)          |
| `workspacePath`                          | *string*                                 | :heavy_check_mark:                       | Workspace path (required)                |