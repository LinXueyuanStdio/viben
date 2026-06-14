# PostApiTaskSetBranchRequestBody

## Example Usage

```typescript
import { PostApiTaskSetBranchRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskSetBranchRequestBody = {
  branch: "<value>",
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `branch`                  | *string*                  | :heavy_check_mark:        | Branch name to set        |
| `taskId`                  | *string*                  | :heavy_check_mark:        | Task ID or directory      |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |