# PostApiTaskSetBaseRequestBody

## Example Usage

```typescript
import { PostApiTaskSetBaseRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskSetBaseRequestBody = {
  baseBranch: "<value>",
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                        | Type                         | Required                     | Description                  |
| ---------------------------- | ---------------------------- | ---------------------------- | ---------------------------- |
| `baseBranch`                 | *string*                     | :heavy_check_mark:           | Base branch name (PR target) |
| `taskId`                     | *string*                     | :heavy_check_mark:           | Task ID or directory         |
| `workspacePath`              | *string*                     | :heavy_check_mark:           | Workspace path (required)    |