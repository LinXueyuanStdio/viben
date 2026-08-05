# TaskCreateRemoveContextRequestBody

## Example Usage

```typescript
import { TaskCreateRemoveContextRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateRemoveContextRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
  files: [
    "<value 1>",
    "<value 2>",
    "<value 3>",
  ],
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `taskId`                  | *string*                  | :heavy_check_mark:        | Task ID or directory      |
| `files`                   | *string*[]                | :heavy_check_mark:        | File paths to remove      |