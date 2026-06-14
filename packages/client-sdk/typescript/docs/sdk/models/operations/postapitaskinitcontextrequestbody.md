# PostApiTaskInitContextRequestBody

## Example Usage

```typescript
import { PostApiTaskInitContextRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskInitContextRequestBody = {
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `taskId`                  | *string*                  | :heavy_check_mark:        | Task ID or directory      |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |