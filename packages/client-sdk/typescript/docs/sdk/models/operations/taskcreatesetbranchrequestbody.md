# TaskCreateSetBranchRequestBody

## Example Usage

```typescript
import { TaskCreateSetBranchRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateSetBranchRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
  branch: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `taskId`                  | *string*                  | :heavy_check_mark:        | Task ID or directory      |
| `branch`                  | *string*                  | :heavy_check_mark:        | Branch name to set        |