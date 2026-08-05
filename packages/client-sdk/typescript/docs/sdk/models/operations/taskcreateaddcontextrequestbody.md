# TaskCreateAddContextRequestBody

## Example Usage

```typescript
import { TaskCreateAddContextRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateAddContextRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
  files: [
    {
      path: "/lib",
    },
  ],
};
```

## Fields

| Field                                                                   | Type                                                                    | Required                                                                | Description                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `workspacePath`                                                         | *string*                                                                | :heavy_check_mark:                                                      | Workspace path (required)                                               |
| `taskId`                                                                | *string*                                                                | :heavy_check_mark:                                                      | Task ID or directory                                                    |
| `files`                                                                 | [operations.Files](../../../sdk/models/operations/files.md)[]           | :heavy_check_mark:                                                      | Files to add with optional reasons                                      |
| `contextType`                                                           | [operations.ContextType](../../../sdk/models/operations/contexttype.md) | :heavy_minus_sign:                                                      | Context file to add to (default: implement)                             |