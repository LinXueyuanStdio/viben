# PostApiTaskRemoveContextRequestBody

## Example Usage

```typescript
import { PostApiTaskRemoveContextRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskRemoveContextRequestBody = {
  files: [],
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `files`                   | *string*[]                | :heavy_check_mark:        | File paths to remove      |
| `taskId`                  | *string*                  | :heavy_check_mark:        | Task ID or directory      |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |