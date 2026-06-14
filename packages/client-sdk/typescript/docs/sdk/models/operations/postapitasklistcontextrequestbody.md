# PostApiTaskListContextRequestBody

## Example Usage

```typescript
import { PostApiTaskListContextRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskListContextRequestBody = {
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `taskId`                  | *string*                  | :heavy_check_mark:        | Task ID or directory      |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |