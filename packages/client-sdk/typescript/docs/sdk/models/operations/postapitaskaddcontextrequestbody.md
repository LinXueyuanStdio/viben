# PostApiTaskAddContextRequestBody

## Example Usage

```typescript
import { PostApiTaskAddContextRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskAddContextRequestBody = {
  files: [
    {
      path: "/lib",
    },
  ],
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                                                   | Type                                                                    | Required                                                                | Description                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `contextType`                                                           | [operations.ContextType](../../../sdk/models/operations/contexttype.md) | :heavy_minus_sign:                                                      | Context file to add to (default: implement)                             |
| `files`                                                                 | [operations.Files](../../../sdk/models/operations/files.md)[]           | :heavy_check_mark:                                                      | Files to add with optional reasons                                      |
| `taskId`                                                                | *string*                                                                | :heavy_check_mark:                                                      | Task ID or directory                                                    |
| `workspacePath`                                                         | *string*                                                                | :heavy_check_mark:                                                      | Workspace path (required)                                               |