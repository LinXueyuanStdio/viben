# TaskCreateSetBaseRequestBody

## Example Usage

```typescript
import { TaskCreateSetBaseRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateSetBaseRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
  baseBranch: "<value>",
};
```

## Fields

| Field                        | Type                         | Required                     | Description                  |
| ---------------------------- | ---------------------------- | ---------------------------- | ---------------------------- |
| `workspacePath`              | *string*                     | :heavy_check_mark:           | Workspace path (required)    |
| `taskId`                     | *string*                     | :heavy_check_mark:           | Task ID or directory         |
| `baseBranch`                 | *string*                     | :heavy_check_mark:           | Base branch name (PR target) |