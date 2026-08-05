# TaskCreateValidateContextRequestBody

## Example Usage

```typescript
import { TaskCreateValidateContextRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateValidateContextRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `taskId`                  | *string*                  | :heavy_check_mark:        | Task ID or directory      |